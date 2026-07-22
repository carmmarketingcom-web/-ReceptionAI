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
import { buyPhoneNumber } from "../../../lib/telnyx";

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
async function handleCheckoutCompleted(session: any) {
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

  // c. Create user (owner)
  await sql`
    INSERT INTO users (id, organization_id, email, name, role)
    VALUES (${userId}, ${orgId}, ${email}, ${name}, 'owner')
  `;
  console.log(`[Stripe] Created user: ${userId} — ${email}`);

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
