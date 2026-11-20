/**
 * One provisioning function, called from two places.
 *
 * Before this existed the `checkout.session.completed` branch of the webhook owned the whole flow,
 * so an account only existed if Stripe's webhook arrived first. The owner's 2026-11-20 test payment
 * proved that is not good enough: the browser came back to /signup/success before any account
 * existed, and there was nothing the page could do about it.
 *
 * `provisionCheckoutSession(session)` now holds org → user → subscription → Telnyx number →
 * welcome email, and BOTH callers use it:
 *   • the webhook (after its exactly-once `stripe_events` claim), and
 *   • `GET /api/stripe/session-status`, which the thank-you page polls.
 *
 * Safe to call twice for the same session, three ways over:
 *   1. an in-process promise per session id, so two concurrent polls share one run;
 *   2. the DB guard (`findProvisionedOrgId`), so a webhook that lands after the browser does not
 *      make a second org;
 *   3. the welcome email is skipped when `email_deliveries` already has a `welcome` row for the org.
 *
 * No new dependency and no schema change: every column used here already exists.
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { buyPhoneNumber, type PurchasedNumber } from "./telnyx";
import { createSetPasswordLink } from "./set-password";
import { buildWelcomeEmail } from "./welcome-email";
import { deliverEmail, hasEmailDeliveryOfKind, type SqlFn } from "./email-delivery";
import { DEFAULT_TIMEZONE, normalizeZip, preferredAreaCode, zipRegion } from "./us-zip";

export interface ProvisionResult {
  orgId: string;
  /** The name their callers hear — the org name, exactly as stored. */
  businessName: string;
  firstName: string;
  email: string;
  phoneNumber: string | null;
  pendingPort: boolean;
  /** True when this call found an account that already existed and created nothing. */
  alreadyProvisioned: boolean;
}

export interface ProvisionDeps {
  sql?: SqlFn;
  buyNumber?: (areaCode?: string) => Promise<PurchasedNumber | null>;
  fetchImpl?: typeof fetch;
  /** Owner alert (SMS). Never fatal. */
  alert?: (text: string) => Promise<void>;
  createSetPasswordLink?: (opts: {
    userId: string;
    email: string;
    organizationId?: string | null;
    baseUrl: string;
  }) => Promise<string>;
  /** Send the welcome email and RECORD it in email_deliveries. Returns true only when accepted. */
  deliverWelcome?: (input: { to: string; subject: string; body: string; orgId: string }) => Promise<boolean>;
  /** Has this org already had a `welcome` delivery row? */
  welcomeAlreadySent?: (orgId: string) => Promise<boolean>;
}

export function getSql(): any {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  return neon(dbUrl);
}

/**
 * Where links in customer email should point. Never derived from a header: a webhook has no
 * browser, and a link a customer cannot open is worse than no link.
 */
export function siteBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || "https://www.receptionai.store").replace(/\/+$/, "");
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

/** A phone number for logs: last four digits only. The owner's mobile is never printed in full. */
function maskPhone(input: unknown): string {
  const digits = typeof input === "string" ? input.replace(/[^0-9]/g, "") : "";
  return digits.length >= 4 ? `…${digits.slice(-4)}` : "(none)";
}

/** Stripe sometimes expands `customer` into an object; both shapes must give the same id. */
function customerIdOf(session: any): string {
  const c = session?.customer;
  if (typeof c === "string") return c;
  if (c && typeof c === "object" && typeof c.id === "string") return c.id;
  return "";
}

function subscriptionIdOf(session: any): string {
  const s = session?.subscription;
  if (typeof s === "string") return s;
  if (s && typeof s === "object" && typeof s.id === "string") return s.id;
  return "";
}

function firstNameOf(rawName: unknown, email: string): string {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (name) return name.split(/\s+/)[0];
  const local = (email || "").split("@")[0] || "";
  return local.replace(/[._-]+/g, " ").trim().split(/\s+/)[0] || "";
}

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

async function fetchCheckoutLineItems(sessionId: string, fetchImpl: typeof fetch): Promise<any[]> {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key || !sessionId) return [];
  try {
    const res = await fetchImpl(
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
async function resolveCarmCheckout(
  session: any,
  fetchImpl: typeof fetch
): Promise<{ tier: string; rate: string; priceId: string } | null> {
  const items = await fetchCheckoutLineItems(session.id, fetchImpl);
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

/**
 * Has this payment already been provisioned?
 *
 * The event ledger stops the SAME event running twice. This stops the SAME PURCHASE running under
 * a different event id, or once from the webhook and once from the browser: Stripe can send
 * checkout.session.completed and payment_intent.succeeded for one payment, and the thank-you page
 * asks for the same session the webhook is already handling.
 *
 * Three keys, in order — the session id we recorded on the subscription, the Stripe customer, and
 * (last, and only for an org that actually has a subscription) the account email.
 */
export async function findProvisionedOrgId(
  sql: any,
  opts: { stripeCustomerId?: string; checkoutSessionId?: string; email?: string }
): Promise<string | null> {
  const { stripeCustomerId, checkoutSessionId, email } = opts;
  if (checkoutSessionId) {
    const bySession = (await sql`
      SELECT organization_id FROM subscriptions WHERE stripe_subscription_id = ${checkoutSessionId} LIMIT 1
    `) as Array<{ organization_id: string }>;
    if (bySession[0]?.organization_id) return bySession[0].organization_id;
    const bySessionMeta = (await sql`
      SELECT organization_id FROM subscriptions WHERE metadata->>'checkout_session_id' = ${checkoutSessionId} LIMIT 1
    `) as Array<{ organization_id: string }>;
    if (bySessionMeta[0]?.organization_id) return bySessionMeta[0].organization_id;
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
  if (email) {
    // The last resort, for a session whose customer id never made it onto the org. Only an org
    // that already has a subscription counts, so a half-created row can never swallow a payment.
    const byEmail = (await sql`
      SELECT o.id FROM organizations o
      WHERE o.email = ${email}
        AND EXISTS (SELECT 1 FROM subscriptions s WHERE s.organization_id = o.id)
      ORDER BY o.created_at ASC LIMIT 1
    `) as Array<{ id: string }>;
    if (byEmail[0]?.id) return byEmail[0].id;
  }
  return null;
}

/**
 * The number this org ended up with. "Live" is a fact read from the DB, never an assumption — the
 * page and the email must not claim a line that does not exist.
 */
async function describeProvisionedNumber(
  sql: any,
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

/** Everything the thank-you page and the duplicate guard need about an account that exists. */
async function describeExistingOrg(
  sql: any,
  orgId: string,
  fallbackEmail: string
): Promise<ProvisionResult> {
  let businessName = "";
  let email = fallbackEmail;
  let ownerName = "";
  try {
    const rows = (await sql`
      SELECT o.name AS org_name, o.email AS org_email, u.name AS user_name
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'owner'
      WHERE o.id = ${orgId}
      LIMIT 1
    `) as Array<{ org_name: string; org_email: string; user_name: string | null }>;
    if (rows[0]) {
      businessName = rows[0].org_name || "";
      email = rows[0].org_email || fallbackEmail;
      ownerName = rows[0].user_name || "";
    }
  } catch (err) {
    console.warn(`[Stripe] Could not read org ${orgId} for the success page:`, String(err).slice(0, 200));
  }
  const { phoneNumber, pendingPort } = await describeProvisionedNumber(sql, orgId);
  return {
    orgId,
    businessName,
    firstName: firstNameOf(ownerName, email),
    email,
    phoneNumber,
    pendingPort,
    alreadyProvisioned: true,
  };
}

function generateRandomHash(): string {
  return bcrypt.hashSync(crypto.randomUUID(), 10);
}

// ── The one entry point ──────────────────────────────────────────────────────

const inFlight = new Map<string, Promise<ProvisionResult | null>>();

/**
 * Provision (or find) the account for one Stripe Checkout session.
 *
 * Returns null only when the session cannot be provisioned at all (no company name or no email,
 * or an unrecognised one-time Carm price) — every caller treats null as "still not ready".
 */
export async function provisionCheckoutSession(
  session: any,
  deps: ProvisionDeps = {}
): Promise<ProvisionResult | null> {
  const sessionId = typeof session?.id === "string" ? session.id : "";
  if (!sessionId) throw new Error("checkout session has no id — cannot provision or dedupe");

  const running = inFlight.get(sessionId);
  if (running) {
    console.log(`[Stripe] Provisioning already running for session ${sessionId} — joining it`);
    return running;
  }
  const run = provisionSession(session, deps).finally(() => inFlight.delete(sessionId));
  inFlight.set(sessionId, run);
  return run;
}

async function provisionSession(session: any, deps: ProvisionDeps): Promise<ProvisionResult | null> {
  const sql = deps.sql || getSql();
  const alert = deps.alert || defaultOwnerAlert;
  // A one-time (payment mode) checkout — Carm Marketing Payment Links carry no subscription object.
  if (!subscriptionIdOf(session)) {
    return provisionCarmOneTime(session, sql, deps, alert);
  }
  return provisionSelfServe(session, sql, deps, alert);
}

/** Buy a number in the customer's own area code, and fall back to any US number rather than fail. */
async function buyNumberForRegion(
  areaCode: string,
  label: string,
  buy: (areaCode?: string) => Promise<PurchasedNumber | null>
): Promise<PurchasedNumber | null> {
  if (areaCode) {
    const local = await buy(areaCode);
    if (local) {
      console.log(`[Telnyx] Bought local number ${local.phoneNumber} in area code ${areaCode} (${label})`);
      return local;
    }
    console.warn(`[Telnyx] No numbers available in area code ${areaCode} (${label}) — falling back to any US number`);
  } else {
    console.log(`[Telnyx] No area code known (${label}) — buying any US number`);
  }
  const fallback = await buy();
  if (fallback) {
    console.log(`[Telnyx] Bought fallback US number ${fallback.phoneNumber} (${label}, no area-code match)`);
  }
  return fallback;
}

/**
 * The welcome email, sent once per org and recorded in `email_deliveries` (kind `welcome`) so
 * System health can prove a paying customer was emailed.
 */
async function sendWelcomeOnce(
  args: {
    orgId: string;
    name: string;
    businessName: string;
    email: string;
    planLabel: string;
    planNote?: string;
    phoneNumber: string | null;
    pendingPort: boolean;
    setPasswordUrl: string | null;
    label: string;
  },
  deps: ProvisionDeps,
  alert: (text: string) => Promise<void>,
  sql?: any
): Promise<void> {
  const alreadySent = deps.welcomeAlreadySent
    ? await deps.welcomeAlreadySent(args.orgId)
    : await hasEmailDeliveryOfKind(args.orgId, "welcome", sql ? { sql } : {});
  if (alreadySent) {
    console.log(`[Stripe] Welcome email already recorded for org ${args.orgId} — not sending a second one`);
    return;
  }

  const { subject, body } = buildWelcomeEmail({
    name: args.name,
    businessName: args.businessName,
    email: args.email,
    planLabel: args.planLabel,
    planNote: args.planNote || "",
    phoneNumber: args.phoneNumber,
    pendingPort: args.pendingPort,
    setPasswordUrl: args.setPasswordUrl,
    dashboardUrl: `${siteBaseUrl()}/login`,
  });

  const send = deps.deliverWelcome
    ? deps.deliverWelcome
    : (input: { to: string; subject: string; body: string; orgId: string }) =>
        deliverEmail(input.to, input.subject, input.body, "welcome", input.orgId, undefined, sql ? { sql } : {});

  const sent = await send({ to: args.email, subject, body, orgId: args.orgId });
  if (sent) {
    console.log(`[Stripe] Welcome email sent to ${args.email} (${args.label}, number ${args.phoneNumber ? "live" : "pending"})`);
    return;
  }
  // A paying customer who hears nothing from us must never be a silent failure.
  console.error(`[Stripe] WELCOME EMAIL FAILED for ${args.email} (org ${args.orgId}) — the customer has received nothing`);
  await alert(
    `🚨 ReceptionAI: welcome email FAILED\n` +
    `Business: ${args.businessName}\nEmail: ${args.email}\nOrg: ${args.orgId}\n` +
    `They paid and were not emailed. Send them their login details by hand.`
  );
}

// ── Self-serve subscription checkout ────────────────────────────────────────
async function provisionSelfServe(
  session: any,
  sql: any,
  deps: ProvisionDeps,
  alert: (text: string) => Promise<void>
): Promise<ProvisionResult | null> {
  const checkoutSessionId: string = session.id;
  const stripeCustomerId = customerIdOf(session);
  const stripeSubscriptionId = subscriptionIdOf(session);
  const metadata = session.metadata || {};
  const customerDetails = session.customer_details || {};

  // Trimmed: the org name is spoken to every caller, so stray whitespace from the signup form
  // must never reach it. An all-whitespace value falls through to the missing-name guard below.
  const companyName = (metadata.companyName || "").trim();
  const email = metadata.email || customerDetails.email || "";
  const name = metadata.name || customerDetails.name || "";
  const plan = metadata.plan || "starter";
  const useExistingNumber = metadata.useExistingNumber === "true";
  const existingPhoneNumber = metadata.existingPhoneNumber || "";
  const password = metadata.password || "";
  // Their own timezone and their own area code, from the ZIP they gave at signup. Never fatal:
  // a missing or unknown ZIP falls back to the documented defaults and says so in the log.
  const region = resolveRegion(
    metadata.postalCode || customerDetails.address?.postal_code,
    customerDetails.phone,
    `self-serve ${checkoutSessionId}`
  );

  console.log(
    `[Stripe] Checkout completed: session=${checkoutSessionId}, ` +
    `customer=${stripeCustomerId}, plan=${plan}, company="${companyName}", ` +
    `useExisting=${useExistingNumber}`
  );

  if (!companyName || !email) {
    console.warn("[Stripe] Missing companyName or email in metadata — skipping onboarding");
    return null;
  }

  // Already provisioned? One payment, one account — the webhook and the thank-you page must not
  // each create one.
  const alreadyProvisioned = await findProvisionedOrgId(sql, {
    stripeCustomerId: stripeCustomerId || undefined,
    checkoutSessionId,
    email,
  });
  if (alreadyProvisioned) {
    console.log(
      `[Stripe] Checkout ${checkoutSessionId} already provisioned as org ${alreadyProvisioned} — skipping (no second org, user, number or subscription)`
    );
    return describeExistingOrg(sql, alreadyProvisioned, email);
  }

  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);

  // b. Create organization
  await sql`
    INSERT INTO organizations (id, name, slug, email, stripe_customer_id, industry, timezone, locale, postal_code)
    VALUES (${orgId}, ${companyName}, ${slug}, ${email}, ${stripeCustomerId}, 'Service', ${region.timezone}, 'en', ${region.zip || null})
  `;
  console.log(`[Stripe] Created org: ${orgId} — "${companyName}" (timezone ${region.timezone})`);

  // The owner's mobile from Stripe Checkout — the destination for press-3 transfers, post-call
  // summaries, missed-call alerts and callback requests. Only fills an empty column: a number the
  // customer typed themselves is never overwritten.
  if (typeof customerDetails.phone === "string" && customerDetails.phone.trim()) {
    await sql`
      UPDATE organizations SET phone = ${customerDetails.phone.trim()}, updated_at = NOW()
      WHERE id = ${orgId} AND (phone IS NULL OR phone = '')
    `;
    console.log(`[Stripe] Owner mobile stored from checkout: ${maskPhone(customerDetails.phone)}`);
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
  const buy = deps.buyNumber || buyPhoneNumber;
  if (!useExistingNumber) {
    // Buy a new number via Telnyx — in the customer's own area code when we know it.
    console.log(`[Stripe] Buying new phone number via Telnyx (area code ${region.areaCode || "any"})...`);
    const purchased = await buyNumberForRegion(region.areaCode, `org ${orgId}`, buy);

    if (purchased) {
      await sql`
        INSERT INTO phone_numbers (id, organization_id, phone_number, provider, telnyx_number_id, is_active, capabilities)
        VALUES (${crypto.randomUUID()}, ${orgId}, ${purchased.phoneNumber}, 'telnyx', ${purchased.telnyxNumberId}, true, '{"voice":true,"sms":true,"mms":false}'::jsonb)
      `;
      console.log(`[Stripe] Purchased number: ${purchased.phoneNumber} (telnyx: ${purchased.telnyxNumberId})`);
    } else {
      // A charged customer with no phone number is invisible unless we say so out loud.
      console.error(`[Stripe] Failed to buy phone number — org ${orgId} created WITHOUT a number (${email})`);
      await alert(
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

  // g. Create subscription record — carrying the checkout session id, which is the key the
  // duplicate guard reads if the customer id ever goes missing.
  if (stripeSubscriptionId) {
    const planIdMap: Record<string, string> = {
      starter: "starter",
      growth: "growth",
      scale: "scale",
    };

    const planRows = await sql`
      SELECT id FROM subscription_plans WHERE name = ${plan} LIMIT 1
    `;
    const planId = planRows[0]?.id || planIdMap[plan] || null;

    await sql`
      INSERT INTO subscriptions (id, organization_id, plan_id, stripe_subscription_id, stripe_customer_id, status, billing_cycle, metadata)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${planId ? planId : null}, ${stripeSubscriptionId}, ${stripeCustomerId}, 'active', 'monthly', ${JSON.stringify({ source: "self-serve", checkout_session_id: checkoutSessionId, plan })}::jsonb)
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

  // h. The way in and the welcome email.
  //
  // A self-serve buyer chose a password at checkout, so their email carries a login link and no
  // token. If the password never made it into metadata, the hash stored above is unknowable by
  // anyone — the same trap as the Carm path — so they get a single-use set-password link.
  let setPasswordUrl: string | null = null;
  if (!password) {
    try {
      const makeLink = deps.createSetPasswordLink || createSetPasswordLink;
      setPasswordUrl = await makeLink({
        userId,
        email,
        organizationId: orgId,
        baseUrl: siteBaseUrl(),
      });
      console.log(`[Stripe] Set-password link created for ${email} (org ${orgId}, no password at checkout)`);
    } catch (err) {
      console.error(`[Stripe] SET-PASSWORD LINK FAILED for ${email} (org ${orgId}):`, String(err).slice(0, 300));
      await alert(
        `🚨 ReceptionAI: customer has no way to sign in\n` +
        `Business: ${companyName}\nEmail: ${email}\nOrg: ${orgId}\n` +
        `No password at checkout and no set-password link was created. Send them a reset link.`
      );
    }
  }

  const { phoneNumber, pendingPort } = await describeProvisionedNumber(sql, orgId);
  await sendWelcomeOnce(
    {
      orgId,
      name,
      businessName: companyName,
      email,
      planLabel: PLAN_LABELS[plan] || plan,
      phoneNumber,
      pendingPort,
      setPasswordUrl,
      label: "self-serve",
    },
    deps,
    alert,
    sql
  );

  return {
    orgId,
    businessName: companyName,
    firstName: firstNameOf(name, email),
    email,
    phoneNumber,
    pendingPort,
    alreadyProvisioned: false,
  };
}

// ── Carm Marketing one-time (founding) checkout ─────────────────────────────
// Mirrors the self-serve flow: org + admin user + Telnyx number + business hours.
async function provisionCarmOneTime(
  session: any,
  sql: any,
  deps: ProvisionDeps,
  alert: (text: string) => Promise<void>
): Promise<ProvisionResult | null> {
  const checkoutSessionId: string = session.id;
  const stripeCustomerId = customerIdOf(session);
  const customerDetails = session.customer_details || {};
  const email = session.metadata?.email || customerDetails.email || "";
  const name = session.metadata?.name || customerDetails.name || "";
  const amountTotal = session.amount_total || 0;

  console.log(`[Stripe] One-time (Carm) checkout: session=${checkoutSessionId}, customer=${stripeCustomerId}, amount=${amountTotal}`);

  const resolved = await resolveCarmCheckout(session, deps.fetchImpl || fetch);
  if (!resolved) {
    console.warn(`[Stripe] Unrecognized one-time checkout (no matching price metadata) — session=${checkoutSessionId}; skipping provisioning (no crash).`);
    return null;
  }
  const { tier, rate, priceId } = resolved;
  if (!email) {
    console.warn(`[Stripe] Missing customer email for one-time checkout ${checkoutSessionId} — skipping provisioning`);
    return null;
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

  // Already provisioned? One payment must never buy two accounts.
  const alreadyProvisioned = await findProvisionedOrgId(sql, {
    stripeCustomerId: stripeCustomerId || undefined,
    checkoutSessionId,
    email,
  });
  if (alreadyProvisioned) {
    console.log(
      `[Stripe] Carm checkout ${checkoutSessionId} already provisioned as org ${alreadyProvisioned} — skipping (no second org, user, number or subscription)`
    );
    return describeExistingOrg(sql, alreadyProvisioned, email);
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
  const buy = deps.buyNumber || buyPhoneNumber;
  const purchased = await buyNumberForRegion(region.areaCode, `Carm org ${orgId}`, buy);
  if (purchased) {
    await sql`
      INSERT INTO phone_numbers (id, organization_id, phone_number, provider, telnyx_number_id, is_active, capabilities)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${purchased.phoneNumber}, 'telnyx', ${purchased.telnyxNumberId}, true, '{"voice":true,"sms":true,"mms":false}'::jsonb)
    `;
  } else {
    // Same rule as the self-serve path: a paying customer with no number is never silent.
    console.error(`[Stripe] Failed to buy phone number for Carm client — org ${orgId} has no number (${email})`);
    await alert(
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
      VALUES (${crypto.randomUUID()}, ${orgId}, ${planId}, ${checkoutSessionId}, ${stripeCustomerId}, 'active', 'monthly', ${JSON.stringify({ source: isSelfServe ? "self-serve" : "carm", rate, tier, price_id: priceId, amount_total: amountTotal, checkout_session_id: checkoutSessionId })}::jsonb)
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
    const makeLink = deps.createSetPasswordLink || createSetPasswordLink;
    setPasswordUrl = await makeLink({
      userId,
      email,
      organizationId: orgId,
      baseUrl: siteBaseUrl(),
    });
    console.log(`[Stripe] Set-password link created for ${email} (org ${orgId})`);
  } catch (err) {
    // A paid customer with no way in is an emergency, not a log line.
    console.error(`[Stripe] SET-PASSWORD LINK FAILED for ${email} (org ${orgId}):`, String(err).slice(0, 300));
    await alert(
      `🚨 ReceptionAI: Carm client has no set-password link\n` +
      `Business: ${orgName}\nEmail: ${email}\nOrg: ${orgId}\n` +
      `They paid and cannot sign in. Send them a reset link or create the password by hand.`
    );
  }

  const { phoneNumber, pendingPort } = await describeProvisionedNumber(sql, orgId);
  await sendWelcomeOnce(
    {
      orgId,
      name,
      businessName: orgName,
      email,
      planLabel: PLAN_LABELS[plan] || plan,
      planNote: rate === "founding" ? " (founding client rate)" : "",
      phoneNumber,
      pendingPort,
      setPasswordUrl,
      label: isSelfServe ? "self-serve one-time" : "Carm one-time",
    },
    deps,
    alert,
    sql
  );

  return {
    orgId,
    businessName: orgName,
    firstName: firstNameOf(name, email),
    email,
    phoneNumber,
    pendingPort,
    alreadyProvisioned: false,
  };
}

/**
 * Alert the owner over SMS — the SAME mechanism as the support alerts in serve.ts
 * (`SUPPORT_ALERT_TO` / `SUPPORT_ALERT_FROM`, sent through Telnyx). The destination is
 * env-only: the owner's personal number is never written in source.
 *
 * Never throws and never rejects — a provisioning flow must not fail because an alert could not
 * be delivered. A failure is logged loudly with the provider's own error so a charged customer
 * with a broken setup can never be silent.
 */
export async function defaultOwnerAlert(text: string): Promise<void> {
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
