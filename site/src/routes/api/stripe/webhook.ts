/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler. Receives events from Stripe and processes:
 * - checkout.session.completed → Full onboarding: create org, user, phone number, subscription
 * - customer.subscription.updated → Update subscription status
 * - customer.subscription.deleted → Mark subscription canceled
 * - invoice.paid / invoice.payment_failed → Update payment status
 */


import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { buyPhoneNumber, type PurchasedNumber } from "../../../lib/telnyx";
import { createSetPasswordLink } from "../../../lib/set-password";
import { sendWelcomeEmail } from "../../../lib/welcome-email";
import { DEFAULT_TIMEZONE, normalizeZip, preferredAreaCode, zipRegion } from "../../../lib/us-zip";

/**
 * Where links in customer email should point. Never derived from a header: a webhook has no
 * browser, and a link a customer cannot open is worse than no link.
 */
function siteBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || "https://receptionai.store").replace(/\/+$/, "");
}

/**
 * Where the business is: its timezone and the area code its number should be bought in.
 * The ZIP comes from the signup form (metadata.postalCode); the owner's mobile — which Stripe
 * Checkout collects — is the second opinion for the area code. An unknown ZIP is not an error:
 * the org still gets created, on the documented default timezone, and the miss is logged.
 */
function resolveRegion(rawZip: unknown, customerPhone: unknown, label: string) {
  const zip = normalizeZip(rawZip);
  const region = zip ? zipRegion(zip) : null;
  const timezone = region?.timezone || DEFAULT_TIMEZONE;
  const areaCode = preferredAreaCode(zip, typeof customerPhone === "string" ? customerPhone : "");
  if (!zip) {
    console.warn(`[Stripe] ${label}: no ZIP supplied — defaulting to timezone ${DEFAULT_TIMEZONE}, any-area-code number`);
  } else if (!region) {
    console.warn(`[Stripe] ${label}: ZIP ${zip} not in the region table — defaulting to timezone ${DEFAULT_TIMEZONE}, any-area-code number`);
  } else {
    console.log(`[Stripe] ${label}: ZIP ${zip} → timezone ${timezone}, area code ${areaCode || "(none)"}`);
  }
  return { zip, timezone, areaCode };
}

/**
 * Buy a number in the customer's own area code, and fall back to any US number rather than
 * fail provisioning. Which path was taken is always in the logs.
 */
async function buyNumberForRegion(areaCode: string, label: string): Promise<PurchasedNumber | null> {
  if (areaCode) {
    const local = await buyPhoneNumber(areaCode);
    if (local) {
      console.log(`[Telnyx] Bought local number ${local.phoneNumber} in area code ${areaCode} (${label})`);
      return local;
    }
    console.warn(`[Telnyx] No numbers available in area code ${areaCode} (${label}) — falling back to any US number`);
  } else {
    console.log(`[Telnyx] No area code known (${label}) — buying any US number`);
  }
  const fallback = await buyPhoneNumber();
  if (fallback) {
    console.log(`[Telnyx] Bought fallback US number ${fallback.phoneNumber} (${label}, no area-code match)`);
  }
  return fallback;
}

/** A phone number for logs: last four digits only. The owner's mobile is never printed in full. */
function maskPhone(input: unknown): string {
  const digits = typeof input === "string" ? input.replace(/[^0-9]/g, "") : "";
  return digits.length >= 4 ? `…${digits.slice(-4)}` : "(none)";
}

function verifyStripeSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    const parts: Record<string, string> = {};
    signature.split(",").forEach((part) => {
      const [key, value] = part.split("=");
      parts[key] = value;
    });
    const timestamp = parts["t"];
    const sigV1 = parts["v1"];
    if (!timestamp || !sigV1) return false;

    const eventTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - eventTime > 300) return false;

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    const sigBuffer = Buffer.from(sigV1, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function getSql() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  return neon(dbUrl);
}

/**
 * Alert the owner over SMS — the SAME mechanism as the support alerts in serve.ts
 * (`SUPPORT_ALERT_TO` / `SUPPORT_ALERT_FROM`, sent through Telnyx). The destination is
 * env-only: the owner's personal number is never written in source.
 *
 * Never throws and never rejects — a provisioning flow must not fail because an alert
 * could not be delivered. A failure is logged loudly with the provider's own error so a
 * charged customer with a broken setup can never be silent.
 */
async function sendOwnerAlert(text: string): Promise<void> {
  const to = process.env.SUPPORT_ALERT_TO || "";
  const from = process.env.SUPPORT_ALERT_FROM || "";
  const apiKey = process.env.TELNYX_API_KEY || "";
  if (!to || !from || !apiKey) {
    console.error(
      `[Stripe] OWNER ALERT NOT SENT (SUPPORT_ALERT_TO / SUPPORT_ALERT_FROM / TELNYX_API_KEY not all set): ${text}`
    );
    return;
  }
  try {
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        text,
        ...(process.env.TELNYX_CONNECTION_ID ? { messaging_profile_id: process.env.TELNYX_CONNECTION_ID } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[Stripe] OWNER ALERT SMS REJECTED (${res.status}): ${detail.slice(0, 200)} — alert was: ${text}`
      );
      return;
    }
    console.log(`[Stripe] Owner alert sent: ${text.replace(/\s+/g, " ").slice(0, 90)}`);
  } catch (err) {
    console.error(`[Stripe] OWNER ALERT SMS FAILED: ${String(err).slice(0, 200)} — alert was: ${text}`);
  }
}

/**
 * POST /api/stripe/webhook
 *
 * Exactly-once, by construction:
 *   1. the event id is CLAIMED in `stripe_events` (UNIQUE) before any work happens;
 *   2. a duplicate delivery returns 200 immediately and touches nothing — never 500, because a
 *      500 makes Stripe retry the same duplicate forever;
 *   3. a genuine failure releases the claim and answers 500 so Stripe's own retry can really
 *      retry, and the provisioning guards below stop that retry from creating a second account.
 */
export async function POST({ request }: { request: Request }) {
  let event: { id?: string; type?: string; data?: { object: any } } | null = null;
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature") || "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret) {
      const valid = verifyStripeSignature(rawBody, signature, webhookSecret);
      if (!valid) {
        // Logged, not silent: a 400 here is otherwise indistinguishable from a 404 in Stripe's
        // dashboard. The signature itself is never printed.
        console.warn(
          `[Stripe Webhook] REJECTED: signature check failed (header ${signature ? "present" : "missing"}, ${rawBody.length} body bytes)`
        );
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } else {
      // Without the secret nothing can be verified, so every delivery is trusted as-is. That is
      // the only way a deploy that lands before the env var still provisions customers, but it
      // must never be silent — anyone could POST a fake payment.
      console.warn("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not set — signature NOT verified");
    }

    event = JSON.parse(rawBody) as { id?: string; type?: string; data?: { object: any } };

    const eventId = typeof event?.id === "string" ? event.id.trim() : "";
    const eventType = typeof event?.type === "string" ? event.type : "unknown";
    if (!eventId) {
      // Without an id there is nothing to dedupe on, and processing unlabelled events is how
      // duplicate accounts get made. Refuse loudly instead of guessing.
      console.error("[Stripe Webhook] REJECTED: event has no id — cannot guarantee it runs once", JSON.stringify(event).slice(0, 300));
      return new Response(
        JSON.stringify({ error: "Event id missing" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[Stripe Webhook] Received event ${eventType} (${eventId})`);

    const claim = await claimStripeEvent(eventId, eventType, event);
    if (claim === "duplicate") {
      console.log(`[Stripe Webhook] Duplicate delivery of ${eventId} (${eventType}) — already processed, doing nothing`);
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      await processStripeEvent(event);
      await markStripeEventProcessed(eventId);
    } catch (err) {
      // Nothing was completed, so give the event back: Stripe's retry must be able to run it.
      await releaseStripeEventClaim(eventId, err);
      throw err;
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Loud, and labelled with the event so the log line can be traced to a Stripe delivery.
    console.error(
      `[Stripe Webhook] FAILED event=${event?.id ?? "unknown"} type=${event?.type ?? "unknown"}:`,
      String(error).slice(0, 500)
    );
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Claim an event for processing. The UNIQUE constraint on stripe_event_id is the lock: two
 * deliveries of the same event can both reach this line and only one INSERT returns a row.
 *
 * Returns "unavailable" (and says so loudly) if the ledger table is missing, so a deploy that
 * lands before the migration still provisions customers instead of failing every payment —
 * degraded duplicate protection is better than no account.
 */
async function claimStripeEvent(
  eventId: string,
  eventType: string,
  payload: unknown
): Promise<"claimed" | "duplicate" | "unavailable"> {
  const sql = getSql();
  try {
    const rows = (await sql`
      INSERT INTO stripe_events (stripe_event_id, event_type, payload)
      VALUES (${eventId}, ${eventType}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (stripe_event_id) DO NOTHING
      RETURNING id
    `) as Array<{ id: string }>;
    return rows.length > 0 ? "claimed" : "duplicate";
  } catch (err) {
    const message = String(err);
    if (/does not exist|undefined_table|42P01/i.test(message)) {
      console.error(
        `[Stripe Webhook] IDEMPOTENCY UNAVAILABLE — stripe_events is missing, so event ${eventId} (${eventType}) is being processed WITHOUT duplicate protection. Apply backend/db/migrations/0006_stripe_webhook_idempotency.sql.`
      );
      return "unavailable";
    }
    throw err;
  }
}

async function markStripeEventProcessed(eventId: string): Promise<void> {
  try {
    const sql = getSql();
    await sql`UPDATE stripe_events SET processed_at = NOW() WHERE stripe_event_id = ${eventId}`;
  } catch (err) {
    // The work is done; failing to stamp the audit row must not turn a good run into a retry.
    console.error(`[Stripe Webhook] Could not stamp processed_at for ${eventId}:`, String(err).slice(0, 200));
  }
}

/** Hand the event back so a Stripe retry can genuinely re-run it. */
async function releaseStripeEventClaim(eventId: string, cause: unknown): Promise<void> {
  try {
    const sql = getSql();
    await sql`DELETE FROM stripe_events WHERE stripe_event_id = ${eventId} AND processed_at IS NULL`;
    console.error(`[Stripe Webhook] Released claim on ${eventId} after failure — a retry will re-run it:`, String(cause).slice(0, 200));
  } catch (err) {
    console.error(`[Stripe Webhook] Could not release claim on ${eventId}:`, String(err).slice(0, 200));
  }
}

/**
 * Has this payment already been provisioned?
 *
 * The event ledger stops the SAME event running twice. This stops the SAME PURCHASE running
 * under a different event id — Stripe can send checkout.session.completed and
 * payment_intent.succeeded for one payment, and a retry can arrive with a fresh id.
 */
async function findProvisionedOrgId(
  sql: ReturnType<typeof getSql>,
  opts: { stripeCustomerId?: string; checkoutSessionId?: string }
): Promise<string | null> {
  const { stripeCustomerId, checkoutSessionId } = opts;
  if (checkoutSessionId) {
    const bySession = (await sql`
      SELECT organization_id FROM subscriptions WHERE stripe_subscription_id = ${checkoutSessionId} LIMIT 1
    `) as Array<{ organization_id: string }>;
    if (bySession[0]?.organization_id) return bySession[0].organization_id;
  }
  if (stripeCustomerId) {
    const byCustomer = (await sql`
      SELECT id FROM organizations WHERE stripe_customer_id = ${stripeCustomerId} LIMIT 1
    `) as Array<{ id: string }>;
    if (byCustomer[0]?.id) return byCustomer[0].id;
    const subByCustomer = (await sql`
      SELECT organization_id FROM subscriptions WHERE stripe_customer_id = ${stripeCustomerId} LIMIT 1
    `) as Array<{ organization_id: string }>;
    if (subByCustomer[0]?.organization_id) return subByCustomer[0].organization_id;
  }
  return null;
}

/**
 * The number this org ended up with, for the welcome email. "Live" is a fact read from the DB,
 * never an assumption — the email must not claim a line that does not exist.
 */
async function describeProvisionedNumber(
  sql: ReturnType<typeof getSql>,
  orgId: string
): Promise<{ phoneNumber: string | null; pendingPort: boolean }> {
  try {
    const rows = (await sql`
      SELECT phone_number, is_active, metadata FROM phone_numbers
      WHERE organization_id = ${orgId}
      ORDER BY created_at ASC
      LIMIT 5
    `) as Array<{ phone_number: string; is_active: boolean | string; metadata: any }>;
    const active = rows.find((r) => r.is_active === true || r.is_active === "1");
    return {
      phoneNumber: active?.phone_number || null,
      pendingPort: rows.some((r) => (r.metadata?.status || "") === "pending_port"),
    };
  } catch (err) {
    console.error(`[Stripe] Could not read phone numbers for org ${orgId}:`, String(err).slice(0, 200));
    return { phoneNumber: null, pendingPort: false };
  }
}

async function processStripeEvent(event: any) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object);
      break;
    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type} (${event.id})`);
  }
}

/**
 * payment_intent.succeeded — the second half of a Carm one-time payment.
 *
 * Stripe sends this alongside checkout.session.completed for a Payment Link, under its own
 * event id, so it must never provision on its own: it either finds the org the checkout
 * already created (and does nothing) or, if the checkout event was somehow missed, resolves
 * the checkout session for this payment intent and provisions from it. If it can resolve
 * neither, the owner is told — a paid customer is never left without an account silently.
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const id = paymentIntent?.id || "";
  const customerId =
    typeof paymentIntent?.customer === "string"
      ? paymentIntent.customer
      : paymentIntent?.customer?.id || "";

  // Subscription invoices are handled by invoice.paid; they are not one-time purchases.
  if (paymentIntent?.invoice) {
    console.log(`[Stripe] payment_intent.succeeded ${id}: belongs to invoice ${paymentIntent.invoice} — invoice.paid handles it`);
    return;
  }

  const sql = getSql();
  const existing = await findProvisionedOrgId(sql, { stripeCustomerId: customerId });
  if (existing) {
    console.log(`[Stripe] payment_intent.succeeded ${id}: customer ${customerId || "(none)"} already provisioned as org ${existing} — nothing to do`);
    return;
  }

  const session = await fetchCheckoutSessionForPaymentIntent(id);
  if (session) {
    console.log(`[Stripe] payment_intent.succeeded ${id}: resolved checkout session ${session.id} — provisioning from it`);
    await handleCarmOneTimeCheckout(session);
    return;
  }

  console.error(`[Stripe] payment_intent.succeeded ${id}: paid, but no organization and no checkout session could be resolved (customer ${customerId || "unknown"})`);
  await sendOwnerAlert(
    `🚨 ReceptionAI: payment received, account NOT created\n` +
    `Payment intent: ${id}\n` +
    `Stripe customer: ${customerId || "unknown"}\n` +
    `Amount: ${typeof paymentIntent?.amount_received === "number" ? paymentIntent.amount_received / 100 : "?"}\n` +
    `Create the account by hand (or refund) — the customer has paid and has nothing.`
  );
}

/** Ask Stripe which checkout session produced this payment intent. Read-only, never fatal. */
async function fetchCheckoutSessionForPaymentIntent(paymentIntentId: string): Promise<any | null> {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key || !paymentIntentId) return null;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions?payment_intent=${encodeURIComponent(paymentIntentId)}&limit=1&expand[]=data.line_items`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) {
      console.warn(`[Stripe] checkout session lookup failed (${res.status}) for payment intent ${paymentIntentId}`);
      return null;
    }
    const data = await res.json().catch(() => null);
    const session = data?.data?.[0] || null;
    if (session && Array.isArray(session.line_items?.data)) session.line_items_expanded = true;
    return session;
  } catch (err) {
    console.warn(`[Stripe] checkout session lookup threw for ${paymentIntentId}:`, String(err).slice(0, 200));
    return null;
  }
}

/**
 * Handle checkout.session.completed — FULL ONBOARDING FLOW:
 * a. Extract metadata from the checkout session
 * b. Create organization
 * c. Create user (admin/owner)
 * d. If !useExistingNumber: buy phone number via Telnyx → insert into phone_numbers
 * e. If useExistingNumber: insert existingPhoneNumber with status 'pending_port'
 * f. Store stripeCustomerId on organization
 * g. Create subscription record
 */
// ── Carm Marketing one-time (founding) checkout detection ──────────────
// Carm Marketing sells done-for-you plans via one-time Payment Links.
// Plan tier is encoded in the Stripe *price* metadata (plan_tier, rate),
// not in the session metadata (Payment Links don't carry session metadata).
const CARM_PRICE_ID_MAP: Record<string, { tier: string; rate: string; fee?: boolean }> = {
  "price_1UQbimDqebBmBAbiCEqpXbSE": { tier: "starter", rate: "founding" },
  "price_1UQbimDqebBmBAbixJIL7zIJ": { tier: "pro", rate: "founding" },
  "price_1UQbilDqebBmBAbilu2uxOsf": { tier: "growth", rate: "founding" },
  "price_1UQbilDqebBmBAbicvA3Q9Yu": { tier: "setup", rate: "founding", fee: true },
};

const PLAN_LABELS: Record<string, string> = { starter: "Starter", growth: "Growth", scale: "Scale" };

// Map Carm tier → self-serve plan name (provisioning parity).
function mapCarmTierToPlan(tier: string): string {
  switch (tier) {
    case "pro": return "growth";
    case "growth": return "scale";
    case "starter":
    default: return "starter";
  }
}

async function fetchCheckoutLineItems(sessionId: string): Promise<any[]> {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key || !sessionId) return [];
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=10&expand[]=data.price`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return data?.data || [];
  } catch (e) {
    console.warn("[Stripe] line_items fetch failed", String(e).slice(0, 120));
    return [];
  }
}

// Determine the Carm tier/rate for a one-time checkout session.
// Returns null if it's not a recognizable Carm checkout (graceful fallback).
async function resolveCarmCheckout(session: any): Promise<{ tier: string; rate: string; priceId: string } | null> {
  const items = await fetchCheckoutLineItems(session.id);
  for (const item of items) {
    const price = item?.price || {};
    const priceId = price.id || "";
    const tier = price.metadata?.plan_tier || "";
    const rate = price.metadata?.rate || "";
    if (tier && !price.metadata?.fee) {
      return { tier, rate: rate || "founding", priceId };
    }
    const known = CARM_PRICE_ID_MAP[priceId];
    if (known && !known.fee) {
      return { tier: known.tier, rate: known.rate, priceId };
    }
  }
  return null;
}

// Provision an org for a one-time Carm Marketing (founding client) payment.
// Mirrors the self-serve flow: org + admin user + Telnyx number + business hours.
async function handleCarmOneTimeCheckout(session: any): Promise<void> {
  const checkoutSessionId = session.id;
  const stripeCustomerId = session.customer || "";
  const customerDetails = session.customer_details || {};
  const email = session.metadata?.email || customerDetails.email || "";
  const name = session.metadata?.name || customerDetails.name || "";
  const amountTotal = session.amount_total || 0;

  console.log(`[Stripe] One-time (Carm) checkout: session=${checkoutSessionId}, customer=${stripeCustomerId}, amount=${amountTotal}`);

  const resolved = await resolveCarmCheckout(session);
  if (!resolved) {
    console.warn(`[Stripe] Unrecognized one-time checkout (no matching price metadata) — session=${checkoutSessionId}; skipping provisioning (no crash).`);
    return;
  }
  const { tier, rate, priceId } = resolved;
  if (!email) {
    console.warn(`[Stripe] Missing customer email for one-time checkout ${checkoutSessionId} — skipping provisioning`);
    return;
  }
  const meta = session.metadata || {};
  const isSelfServe = !!(meta.email && meta.plan);
  // Timezone + area code from the customer's own ZIP. Carm payment links carry no ZIP, so this
  // path can legitimately fall through to the defaults — logged, never fatal.
  const region = resolveRegion(
    meta.postalCode || customerDetails.address?.postal_code,
    customerDetails.phone,
    "Carm one-time"
  );
  const plan = isSelfServe
    ? (["starter", "growth", "scale"].includes(meta.plan) ? meta.plan : "starter")
    : (rate === "standard" ? tier : mapCarmTierToPlan(tier));
  // The org name is what the AI says out loud ("Thanks for calling {name}"), so it must be the
  // customer's own business name — never a staff-facing label like "New Carm Client — …".
  // Fall back to the customer's name, then the email local part, before a generic placeholder.
  const companyName = (meta.companyName || "").trim() || name || email.split("@")[0] || "Business";
  const orgName = companyName;
  const passwordHash = meta.password ? await bcrypt.hash(meta.password, 10) : generateRandomHash();

  console.log(`[Stripe] Provisioning client: tier=${tier} rate=${rate} plan=${plan} org="${orgName}" email=${email}`);

  const sql = getSql();

  // Already provisioned? One payment must never buy two accounts. This catches the same
  // purchase arriving under a different event id (payment_intent.succeeded next to
  // checkout.session.completed, or a retry that Stripe re-labelled).
  const alreadyProvisioned = await findProvisionedOrgId(sql, {
    stripeCustomerId: stripeCustomerId || undefined,
    checkoutSessionId,
  });
  if (alreadyProvisioned) {
    console.log(
      `[Stripe] Carm checkout ${checkoutSessionId} already provisioned as org ${alreadyProvisioned} — skipping (no second org, user, number or subscription)`
    );
    await sendOwnerAlert(
      `⚠️ ReceptionAI: duplicate Carm provisioning attempt blocked\n` +
      `Session: ${checkoutSessionId}\n` +
      `Stripe customer: ${stripeCustomerId || "unknown"}\n` +
      `Existing org: ${alreadyProvisioned}\n` +
      `Nothing was created. Check Stripe for a duplicate charge for ${email}.`
    );
    return;
  }

  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const slug = `${isSelfServe ? "" : "carm-"}${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}`;

  await sql`
    INSERT INTO organizations (id, name, slug, email, stripe_customer_id, industry, timezone, locale, postal_code)
    VALUES (${orgId}, ${orgName}, ${slug}, ${email}, ${stripeCustomerId}, 'Service', ${region.timezone}, 'en', ${region.zip || null})
  `;

  // The owner's mobile, collected by Stripe Checkout: it is the destination for press-3
  // transfers, post-call summaries and missed-call alerts. Never overwrite a value that is
  // already set — the customer's own entry in Settings wins.
  if (typeof customerDetails.phone === "string" && customerDetails.phone.trim()) {
    await sql`
      UPDATE organizations SET phone = ${customerDetails.phone.trim()}, updated_at = NOW()
      WHERE id = ${orgId} AND (phone IS NULL OR phone = '')
    `;
    console.log(`[Stripe] Owner mobile stored from checkout: ${maskPhone(customerDetails.phone)}`);
  }

  await sql`
    INSERT INTO users (id, organization_id, email, name, role, password_hash)
    VALUES (${userId}, ${orgId}, ${email}, ${name || "Owner"}, 'owner', ${passwordHash})
  `;

  // Phone number (same as self-serve: buy via Telnyx, in the customer's area code when known)
  const purchased = await buyNumberForRegion(region.areaCode, `Carm org ${orgId}`);
  if (purchased) {
    await sql`
      INSERT INTO phone_numbers (id, organization_id, phone_number, provider, telnyx_number_id, is_active, capabilities)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${purchased.phoneNumber}, 'telnyx', ${purchased.telnyxNumberId}, true, '{"voice":true,"sms":true,"mms":false}'::jsonb)
    `;
  } else {
    // Same rule as the self-serve path: a paying customer with no number is never silent.
    console.error(`[Stripe] Failed to buy phone number for Carm client — org ${orgId} has no number (${email})`);
    await sendOwnerAlert(
      `🚨 ReceptionAI: number purchase FAILED (Carm client)\n` +
      `Business: ${orgName}\n` +
      `Email: ${email}\n` +
      `Stripe customer: ${stripeCustomerId || "unknown"}\n` +
      `Plan: ${plan} (${rate})\n` +
      `They have paid and have no phone number. Buy a number for org ${orgId} or refund.`
    );
  }

  // Subscription record (one-time; no Stripe subscription object).
  const planRows = await sql`SELECT id FROM subscription_plans WHERE name = ${plan} LIMIT 1`;
  const planId = planRows[0]?.id || null;
  if (planId) {
    await sql`
      INSERT INTO subscriptions (id, organization_id, plan_id, stripe_subscription_id, stripe_customer_id, status, billing_cycle, metadata)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${planId}, ${checkoutSessionId}, ${stripeCustomerId}, 'active', 'monthly', ${JSON.stringify({ source: isSelfServe ? "self-serve" : "carm", rate, tier, price_id: priceId, amount_total: amountTotal })}::jsonb)
    `;
  }

  // Default business hours (Mon-Fri 9-5)
  for (let day = 1; day <= 5; day++) {
    await sql`
      INSERT INTO business_hours (id, organization_id, day_of_week, open_time, close_time, is_closed)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${String(day)}, '09:00', '17:00', false)
    `;
  }
  for (const day of [0, 6]) {
    await sql`
      INSERT INTO business_hours (id, organization_id, day_of_week, is_closed)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${String(day)}, true)
    `;
  }

  console.log(`[Stripe] Carm onboarding complete for org ${orgId} (${orgName})`);

  // ── The way in ────────────────────────────────────────────────────────────────────────────
  // This buyer never chose a password, so the hash above is unknowable by design. Without a
  // link they cannot reach the dashboard they paid for: that was the defect. A single-use,
  // 7-day set-password link in their welcome email is the fix.
  let setPasswordUrl: string | null = null;
  try {
    setPasswordUrl = await createSetPasswordLink({
      userId,
      email,
      organizationId: orgId,
      baseUrl: siteBaseUrl(),
    });
    console.log(`[Stripe] Set-password link created for ${email} (org ${orgId})`);
  } catch (err) {
    // A paid customer with no way in is an emergency, not a log line.
    console.error(`[Stripe] SET-PASSWORD LINK FAILED for ${email} (org ${orgId}):`, String(err).slice(0, 300));
    await sendOwnerAlert(
      `🚨 ReceptionAI: Carm client has no set-password link\n` +
      `Business: ${orgName}\nEmail: ${email}\nOrg: ${orgId}\n` +
      `They paid and cannot sign in. Send them a reset link or create the password by hand.`
    );
  }

  const { phoneNumber, pendingPort } = await describeProvisionedNumber(sql, orgId);
  const sent = await sendWelcomeEmail({
    name,
    businessName: orgName,
    email,
    planLabel: PLAN_LABELS[plan] || plan,
    planNote: rate === "founding" ? " (founding client rate)" : "",
    phoneNumber,
    pendingPort,
    setPasswordUrl,
    dashboardUrl: `${siteBaseUrl()}/login`,
  });
  if (sent) {
    console.log(`[Stripe] Welcome email sent to ${email} (Carm one-time, set-password link ${setPasswordUrl ? "included" : "MISSING"})`);
  } else {
    console.error(
      `[Stripe] WELCOME EMAIL FAILED for ${email} (org ${orgId}) — this Carm customer has received nothing; contact them manually`
    );
  }
}

async function handleCheckoutCompleted(session: any) {
  // One-time (payment mode) checkout — Carm Marketing Payment Links carry no subscription object.
  if (!session.subscription) {
    await handleCarmOneTimeCheckout(session).catch((err) =>
      console.error("[Stripe] Carm one-time checkout failed:", String(err).slice(0, 300))
    );
    return;
  }
  const {
    id: checkoutSessionId,
    customer: stripeCustomerId,
    subscription: stripeSubscriptionId,
    metadata = {},
    customer_details = {},
  } = session;

  // Trimmed: the org name is spoken to every caller, so stray whitespace from the signup form
  // must never reach it. An all-whitespace value falls through to the missing-name guard below.
  const companyName = (metadata.companyName || "").trim();
  const email = metadata.email || customer_details.email || "";
  const name = metadata.name || customer_details.name || "";
  const plan = metadata.plan || "starter";
  const useExistingNumber = metadata.useExistingNumber === "true";
  const existingPhoneNumber = metadata.existingPhoneNumber || "";
  const password = metadata.password || "";
  // Their own timezone and their own area code, from the ZIP they gave at signup. Never fatal:
  // a missing or unknown ZIP falls back to the documented defaults and says so in the log.
  const region = resolveRegion(
    metadata.postalCode || customer_details.address?.postal_code,
    customer_details.phone,
    `self-serve ${checkoutSessionId}`
  );

  console.log(
    `[Stripe] Checkout completed: session=${checkoutSessionId}, ` +
    `customer=${stripeCustomerId}, plan=${plan}, company="${companyName}", ` +
    `useExisting=${useExistingNumber}`
  );

  if (!companyName || !email) {
    console.warn("[Stripe] Missing companyName or email in metadata — skipping onboarding");
    return;
  }

  const sql = getSql();
  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);

  // Already provisioned? Same rule as the Carm path: one payment, one account. A retry that
  // arrives under a different event id must not create a second org, number or subscription.
  const alreadyProvisioned = await findProvisionedOrgId(sql, {
    stripeCustomerId: typeof stripeCustomerId === "string" ? stripeCustomerId : undefined,
    checkoutSessionId,
  });
  if (alreadyProvisioned) {
    console.log(
      `[Stripe] Checkout ${checkoutSessionId} already provisioned as org ${alreadyProvisioned} - skipping (no second org, user, number or subscription)`
    );
    await sendOwnerAlert(
      `⚠️ ReceptionAI: duplicate self-serve provisioning attempt blocked\n` +
      `Session: ${checkoutSessionId}\n` +
      `Stripe customer: ${stripeCustomerId || "unknown"}\n` +
      `Existing org: ${alreadyProvisioned}\n` +
      `Nothing was created. Check Stripe for a duplicate charge for ${email}.`
    );
    return;
  }

  // b. Create organization
  await sql`
    INSERT INTO organizations (id, name, slug, email, stripe_customer_id, industry, timezone, locale, postal_code)
    VALUES (${orgId}, ${companyName}, ${slug}, ${email}, ${stripeCustomerId}, 'Service', ${region.timezone}, 'en', ${region.zip || null})
  `;
  console.log(`[Stripe] Created org: ${orgId} — "${companyName}" (timezone ${region.timezone})`);

  // The owner's mobile from Stripe Checkout — the destination for press-3 transfers, post-call
  // summaries, missed-call alerts and callback requests. Only fills an empty column: a number the
  // customer typed themselves is never overwritten.
  if (typeof customer_details.phone === "string" && customer_details.phone.trim()) {
    await sql`
      UPDATE organizations SET phone = ${customer_details.phone.trim()}, updated_at = NOW()
      WHERE id = ${orgId} AND (phone IS NULL OR phone = '')
    `;
    console.log(`[Stripe] Owner mobile stored from checkout: ${maskPhone(customer_details.phone)}`);
  } else {
    console.warn(`[Stripe] No owner mobile from checkout for org ${orgId} — the setup step must collect it`);
  }

  // c. Create user (owner) with password hash
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  await sql`
    INSERT INTO users (id, organization_id, email, name, role, password_hash)
    VALUES (${userId}, ${orgId}, ${email}, ${name}, 'owner', ${passwordHash || generateRandomHash()})
  `;
  console.log(`[Stripe] Created user: ${userId} — ${email}${password ? " (with password)" : " (no password in metadata)"}`);

  // d/e. Phone number provisioning
  if (!useExistingNumber) {
    // Buy a new number via Telnyx — in the customer's own area code when we know it.
    console.log(`[Stripe] Buying new phone number via Telnyx (area code ${region.areaCode || "any"})...`);
    const purchased = await buyNumberForRegion(region.areaCode, `org ${orgId}`);

    if (purchased) {
      await sql`
        INSERT INTO phone_numbers (id, organization_id, phone_number, provider, telnyx_number_id, is_active, capabilities)
        VALUES (${crypto.randomUUID()}, ${orgId}, ${purchased.phoneNumber}, 'telnyx', ${purchased.telnyxNumberId}, true, '{"voice":true,"sms":true,"mms":false}'::jsonb)
      `;
      console.log(`[Stripe] Purchased number: ${purchased.phoneNumber} (telnyx: ${purchased.telnyxNumberId})`);
    } else {
      // A charged customer with no phone number is invisible unless we say so out loud.
      console.error(`[Stripe] Failed to buy phone number — org ${orgId} created WITHOUT a number (${email})`);
      await sendOwnerAlert(
        `🚨 ReceptionAI: number purchase FAILED\n` +
        `Business: ${companyName}\n` +
        `Email: ${email}\n` +
        `Stripe customer: ${stripeCustomerId || "unknown"}\n` +
        `Plan: ${plan}\n` +
        `They have been charged and have no phone number. Buy a number for org ${orgId} or refund.`
      );
    }
  } else if (existingPhoneNumber) {
    // Store existing number as pending port
    await sql`
      INSERT INTO phone_numbers (id, organization_id, phone_number, provider, is_active, capabilities, metadata)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${existingPhoneNumber}, 'telnyx', false, '{"voice":false,"sms":false,"mms":false}'::jsonb, '{"status":"pending_port"}'::jsonb)
    `;
    console.log(`[Stripe] Stored existing number as pending_port: ${existingPhoneNumber}`);
  }

  // f. stripeCustomerId is already stored on the org (see b)

  // g. Create subscription record
  if (stripeSubscriptionId) {
    const planIdMap: Record<string, string> = {
      starter: "starter",
      growth: "growth",
      scale: "scale",
    };

    // Find plan ID from DB or use the plan name directly
    const planRows = await sql`
      SELECT id FROM subscription_plans WHERE name = ${plan} LIMIT 1
    `;
    const planId = planRows[0]?.id || planIdMap[plan] || null;

    await sql`
      INSERT INTO subscriptions (id, organization_id, plan_id, stripe_subscription_id, stripe_customer_id, status, billing_cycle)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${planId ? planId : null}, ${stripeSubscriptionId}, ${stripeCustomerId}, 'active', 'monthly')
    `;
    console.log(`[Stripe] Created subscription: ${stripeSubscriptionId}`);
  }

  // Create default business hours (Mon-Fri 9-5)
  for (let day = 1; day <= 5; day++) {
    await sql`
      INSERT INTO business_hours (id, organization_id, day_of_week, open_time, close_time, is_closed)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${String(day)}, '09:00', '17:00', false)
    `;
  }
  for (const day of [0, 6]) {
    await sql`
      INSERT INTO business_hours (id, organization_id, day_of_week, is_closed)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${String(day)}, true)
    `;
  }

  console.log(`[Stripe] Onboarding complete for org ${orgId}`);

  // h. Send the welcome email - and only claim what is actually true.
  //
  // A self-serve buyer chose a password at checkout, so their email carries a login link and no
  // token. If the password never made it into metadata, the hash stored above is unknowable by
  // anyone - the same trap as the Carm path - so they get a single-use set-password link.
  let setPasswordUrl: string | null = null;
  if (!password) {
    try {
      setPasswordUrl = await createSetPasswordLink({
        userId,
        email,
        organizationId: orgId,
        baseUrl: siteBaseUrl(),
      });
      console.log(`[Stripe] Set-password link created for ${email} (org ${orgId}, no password at checkout)`);
    } catch (err) {
      console.error(`[Stripe] SET-PASSWORD LINK FAILED for ${email} (org ${orgId}):`, String(err).slice(0, 300));
      await sendOwnerAlert(
        `🚨 ReceptionAI: customer has no way to sign in\n` +
        `Business: ${companyName}\nEmail: ${email}\nOrg: ${orgId}\n` +
        `No password at checkout and no set-password link was created. Send them a reset link.`
      );
    }
  }

  const { phoneNumber, pendingPort } = await describeProvisionedNumber(sql, orgId);
  const sent = await sendWelcomeEmail({
    name,
    businessName: companyName,
    email,
    planLabel: PLAN_LABELS[plan] || plan,
    phoneNumber,
    pendingPort,
    setPasswordUrl,
    dashboardUrl: `${siteBaseUrl()}/login`,
  });
  if (sent) {
    console.log(`[Stripe] Welcome email sent to ${email} (number ${phoneNumber ? "live" : "pending"})`);
  } else {
    console.error(
      `[Stripe] WELCOME EMAIL FAILED for ${email} (org ${orgId}) - the customer has received nothing; contact them manually`
    );
  }
}

/**
 * Handle customer.subscription.updated — update subscription status.
 */
async function handleSubscriptionUpdated(subscription: any) {
  const { id: stripeSubscriptionId, status, current_period_start, current_period_end, cancel_at_period_end } = subscription;
  const mappedStatus = mapStripeStatus(status);

  const sql = getSql();
  await sql`
    UPDATE subscriptions
    SET status = ${mappedStatus},
        current_period_start = ${current_period_start ? new Date(current_period_start * 1000).toISOString() : null},
        current_period_end = ${current_period_end ? new Date(current_period_end * 1000).toISOString() : null},
        cancel_at_period_end = ${cancel_at_period_end || false},
        updated_at = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
}

async function handleSubscriptionDeleted(subscription: any) {
  const { id: stripeSubscriptionId } = subscription;
  const sql = getSql();
  await sql`
    UPDATE subscriptions
    SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
}

async function handleInvoicePaid(invoice: any) {
  const { subscription: stripeSubscriptionId, period_start, period_end } = invoice;
  if (!stripeSubscriptionId) return;
  const sql = getSql();
  await sql`
    UPDATE subscriptions
    SET status = 'active',
        current_period_start = ${period_start ? new Date(period_start * 1000).toISOString() : null},
        current_period_end = ${period_end ? new Date(period_end * 1000).toISOString() : null},
        updated_at = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
}

async function handlePaymentFailed(invoice: any) {
  const { subscription: stripeSubscriptionId } = invoice;
  if (!stripeSubscriptionId) return;
  const sql = getSql();
  await sql`
    UPDATE subscriptions
    SET status = 'past_due', updated_at = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
}

function mapStripeStatus(
  stripeStatus: string
): string {
  const map: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    trialing: "trialing",
    incomplete: "incomplete",
    incomplete_expired: "incomplete",
    unpaid: "unpaid",
    paused: "paused",
  };
  return map[stripeStatus] || "incomplete";
}

function generateRandomHash(): string {
  return bcrypt.hashSync(crypto.randomUUID(), 10);
}
