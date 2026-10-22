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
import { buyPhoneNumber } from "../../../lib/telnyx";
import { sendEmail } from "../../../lib/email";

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
 * POST /api/stripe/webhook
 */
export async function POST({ request }: { request: Request }) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature") || "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret) {
      const valid = verifyStripeSignature(rawBody, signature, webhookSecret);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data: { object: any };
    };

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    // Process the event (uses neon for checkout, drizzle for subscription updates)
    await processStripeEvent(event);

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function processStripeEvent(event: any) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
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
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
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
  const email = customerDetails.email || "";
  const name = customerDetails.name || "";
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
  const plan = mapCarmTierToPlan(tier);
  const companyName = name || email.split("@")[0] || "Business";
  const orgName = `New Carm Client — ${companyName}`;

  console.log(`[Stripe] Provisioning Carm client: tier=${tier} rate=${rate} plan=${plan} org="${orgName}" email=${email}`);

  const sql = getSql();
  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const slug = `carm-${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}`;

  await sql`
    INSERT INTO organizations (id, name, slug, email, stripe_customer_id, industry, timezone, locale)
    VALUES (${orgId}, ${orgName}, ${slug}, ${email}, ${stripeCustomerId}, 'Service', 'America/Chicago', 'en')
  `;

  await sql`
    INSERT INTO users (id, organization_id, email, name, role, password_hash)
    VALUES (${userId}, ${orgId}, ${email}, ${name || "Owner"}, 'owner', ${generateRandomHash()})
  `;

  // Phone number (same as self-serve: buy via Telnyx)
  const purchased = await buyPhoneNumber();
  if (purchased) {
    await sql`
      INSERT INTO phone_numbers (id, organization_id, phone_number, provider, telnyx_number_id, is_active, capabilities)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${purchased.phoneNumber}, 'telnyx', ${purchased.telnyxNumberId}, true, '{"voice":true,"sms":true,"mms":false}'::jsonb)
    `;
  } else {
    console.warn("[Stripe] Failed to buy phone number for Carm client");
  }

  // Subscription record (one-time; no Stripe subscription object).
  const planRows = await sql`SELECT id FROM subscription_plans WHERE name = ${plan} LIMIT 1`;
  const planId = planRows[0]?.id || null;
  if (planId) {
    await sql`
      INSERT INTO subscriptions (id, organization_id, plan_id, stripe_subscription_id, stripe_customer_id, status, billing_cycle, metadata)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${planId}, ${checkoutSessionId}, ${stripeCustomerId}, 'active', 'monthly', ${JSON.stringify({ source: "carm", rate, tier, price_id: priceId, amount_total: amountTotal })}::jsonb)
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

  const companyName = metadata.companyName || "";
  const email = metadata.email || customer_details.email || "";
  const name = metadata.name || customer_details.name || "";
  const plan = metadata.plan || "starter";
  const useExistingNumber = metadata.useExistingNumber === "true";
  const existingPhoneNumber = metadata.existingPhoneNumber || "";
  const password = metadata.password || "";

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

  // b. Create organization
  await sql`
    INSERT INTO organizations (id, name, slug, email, stripe_customer_id, industry, timezone, locale)
    VALUES (${orgId}, ${companyName}, ${slug}, ${email}, ${stripeCustomerId}, 'Service', 'America/Chicago', 'en')
  `;
  console.log(`[Stripe] Created org: ${orgId} — "${companyName}"`);

  // c. Create user (owner) with password hash
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  await sql`
    INSERT INTO users (id, organization_id, email, name, role, password_hash)
    VALUES (${userId}, ${orgId}, ${email}, ${name}, 'owner', ${passwordHash || generateRandomHash()})
  `;
  console.log(`[Stripe] Created user: ${userId} — ${email}${password ? " (with password)" : " (no password in metadata)"}`);

  // d/e. Phone number provisioning
  if (!useExistingNumber) {
    // Buy a new number via Telnyx
    console.log(`[Stripe] Buying new phone number via Telnyx...`);
    const purchased = await buyPhoneNumber();

    if (purchased) {
      await sql`
        INSERT INTO phone_numbers (id, organization_id, phone_number, provider, telnyx_number_id, is_active, capabilities)
        VALUES (${crypto.randomUUID()}, ${orgId}, ${purchased.phoneNumber}, 'telnyx', ${purchased.telnyxNumberId}, true, '{"voice":true,"sms":true,"mms":false}'::jsonb)
      `;
      console.log(`[Stripe] Purchased number: ${purchased.phoneNumber} (telnyx: ${purchased.telnyxNumberId})`);
    } else {
      console.warn("[Stripe] Failed to buy phone number — org created without number");
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

  // h. Send welcome email
  try {
    // Get the phone number for the welcome email
    const phoneRows = await sql`
      SELECT phone_number FROM phone_numbers
      WHERE organization_id = ${orgId} AND is_active = true
      LIMIT 1
    `;
    const phoneNumber = phoneRows[0]?.phone_number || "Your number is being provisioned";
    const pendingPort = !!(await sql`
      SELECT 1 FROM phone_numbers WHERE organization_id = ${orgId} AND metadata->>'status' = 'pending_port' LIMIT 1
    `).length;

    const phoneLine = pendingPort
      ? `📞 Your phone number (${existingPhoneNumber}) is being ported — we'll notify you when it's live.`
      : `📞 Your phone number: ${phoneNumber}`;

    const keepYourNumberSection = pendingPort
      ? `Porting can take a few days. To make sure you don't miss a call during the port window, forward your old number to your new ReceptionAI number in the meantime — reply to this email and we'll help you set it up.`
      : `Keep your old number:
You can keep your old number by forwarding it to your new one — it takes about 5 minutes at your current phone provider and there's no downtime.

Here's how (steps vary slightly by provider):
• Call forwarding at your carrier: on your old phone, dial *72 followed by your new ReceptionAI number and press call. (If *72 doesn't work on your provider, contact them and ask for unconditional call forwarding to ${phoneNumber}.)
• Or via your provider's web/app portal: find "Call forwarding" / "Forward all calls" and set it to ${phoneNumber}.

Callers keep calling the number they already know, and the AI receptionist still answers 24/7. To turn it off later, dial *73.`;

    const welcomeBody = `Hi ${name},

Your AI receptionist is live and ready to answer calls!

${phoneLine}
🔗 Dashboard: https://receptionai.store/login
📖 Getting started: https://receptionai.store/getting-started

Quick start:
1. Log in at https://receptionai.store/login
2. Complete your setup (2 min)
3. Start receiving calls

${keepYourNumberSection}

Your 14-day free trial starts now. Cancel anytime.

Questions? Reply to this email.

— Team ReceptionAI`;

    sendEmail(email, "Welcome to ReceptionAI 🎉 — Your AI receptionist is live", welcomeBody);
    console.log(`[Stripe] Welcome email sent to ${email}`);
  } catch (err) {
    console.warn("[Stripe] Failed to send welcome email:", String(err).slice(0, 200));
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
