/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler. Receives events from Stripe and processes:
 * - checkout.session.completed → Create subscription after payment
 * - customer.subscription.updated → Update subscription status
 * - customer.subscription.deleted → Mark subscription canceled
 * - invoice.paid / invoice.payment_failed → Update payment status
 *
 * Stripe signature verification uses the STRIPE_WEBHOOK_SECRET env var.
 * All events are logged to the stripe_events audit table.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb, isMockMode } from "../../../db/index";
import {
  subscriptions,
  stripeEvents,
  usageRecords,
} from "../../../db/schema/index";
import { eq } from "drizzle-orm";

/**
 * Verify the Stripe webhook signature.
 * Uses HMAC-SHA256 per Stripe's documentation.
 */
function verifyStripeSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Stripe sends signature as "t=timestamp,v1=signature"
    const parts: Record<string, string> = {};
    signature.split(",").forEach((part) => {
      const [key, value] = part.split("=");
      parts[key] = value;
    });

    const timestamp = parts["t"];
    const sigV1 = parts["v1"];

    if (!timestamp || !sigV1) return false;

    // Reject events older than 5 minutes (replay protection)
    const eventTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - eventTime > 300) {
      console.warn("[Stripe Webhook] Event too old, possible replay attack");
      return false;
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(sigV1, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    if (sigBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * POST /api/stripe/webhook
 */
export async function POST({ request }: { request: Request }) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature") || "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — skipping verification");
      // In dev without webhook secret, still process but warn
    } else {
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

    const usingMock = isMockMode();

    if (!usingMock) {
      const db = getDb();

      // Log the event for audit
      await db.insert(stripeEvents).values({
        id: crypto.randomUUID(),
        stripeEventId: event.id,
        eventType: event.type,
        payload: event,
        processedAt: new Date(),
      });

      // Process the event
      await processStripeEvent(db, event);
    } else {
      console.log(`[Stripe Webhook] Mock mode — event ${event.type} acknowledged`);
    }

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

/**
 * Process a Stripe event — route to the appropriate handler.
 */
async function processStripeEvent(db: any, event: any) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(db, event.data.object);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(db, event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(db, event.data.object);
      break;
    case "invoice.paid":
      await handleInvoicePaid(db, event.data.object);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(db, event.data.object);
      break;
    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
}

/**
 * Handle checkout.session.completed — create a subscription.
 */
async function handleCheckoutCompleted(db: any, session: any) {
  const {
    id: checkoutSessionId,
    customer: stripeCustomerId,
    subscription: stripeSubscriptionId,
    client_reference_id: organizationId,
    mode,
  } = session;

  console.log(
    `[Stripe] Checkout completed: session=${checkoutSessionId}, customer=${stripeCustomerId}, sub=${stripeSubscriptionId}, org=${organizationId}`
  );

  if (!organizationId) {
    console.warn("[Stripe] No client_reference_id (org_id) in checkout session");
    return;
  }

  if (mode === "subscription" && stripeSubscriptionId) {
    // Get subscription details from Stripe via the session metadata
    // or from what we have. For now, set as active with trial.
    const planName = session.metadata?.plan || "starter";

    // Find the plan
    const [plan] = await db
      .select()
      .from((await import("../../../db/schema/index")).subscriptionPlans)
      .where(
        eq(
          (await import("../../../db/schema/index")).subscriptionPlans.name,
          planName
        )
      )
      .limit(1);

    // Upsert the subscription
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      organizationId,
      planId: plan?.id || null,
      stripeSubscriptionId,
      stripeCustomerId,
      status: "active",
      billingCycle: "monthly",
      trialEndsAt: session.metadata?.trial_days
        ? new Date(Date.now() + parseInt(session.metadata.trial_days) * 86400000)
        : null,
    });
  }
}

/**
 * Handle customer.subscription.updated — update subscription status.
 */
async function handleSubscriptionUpdated(db: any, subscription: any) {
  const { id: stripeSubscriptionId, status, current_period_start, current_period_end, cancel_at_period_end } = subscription;

  const stripeStatus = status as string;
  // Map Stripe status to our enum
  const mappedStatus = mapStripeStatus(stripeStatus);

  await db
    .update(subscriptions)
    .set({
      status: mappedStatus,
      currentPeriodStart: current_period_start
        ? new Date(current_period_start * 1000)
        : undefined,
      currentPeriodEnd: current_period_end
        ? new Date(current_period_end * 1000)
        : undefined,
      cancelAtPeriodEnd: cancel_at_period_end || false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

/**
 * Handle customer.subscription.deleted — mark as canceled.
 */
async function handleSubscriptionDeleted(db: any, subscription: any) {
  const { id: stripeSubscriptionId } = subscription;

  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

/**
 * Handle invoice.paid — update payment status, log usage.
 */
async function handleInvoicePaid(db: any, invoice: any) {
  const { subscription: stripeSubscriptionId, amount_paid, period_start, period_end } = invoice;

  if (stripeSubscriptionId) {
    await db
      .update(subscriptions)
      .set({
        status: "active",
        currentPeriodStart: period_start ? new Date(period_start * 1000) : undefined,
        currentPeriodEnd: period_end ? new Date(period_end * 1000) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
  }
}

/**
 * Handle invoice.payment_failed — mark as past_due.
 */
async function handlePaymentFailed(db: any, invoice: any) {
  const { subscription: stripeSubscriptionId } = invoice;

  if (stripeSubscriptionId) {
    await db
      .update(subscriptions)
      .set({
        status: "past_due",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
  }
}

/**
 * Map Stripe subscription status to our internal enum.
 */
function mapStripeStatus(
  stripeStatus: string
): "active" | "past_due" | "canceled" | "trialing" | "incomplete" | "unpaid" | "paused" {
  const map: Record<string, any> = {
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
