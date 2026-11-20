/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler. Receives events from Stripe and processes:
 * - checkout.session.completed → Full onboarding: create org, user, phone number, subscription
 * - customer.subscription.updated → Update subscription status
 * - customer.subscription.deleted → Mark subscription canceled
 * - invoice.paid / invoice.payment_failed → Update payment status
 *
 * The onboarding body itself lives in `src/lib/provisioning.ts` — the SAME function
 * `GET /api/stripe/session-status` calls, so a payment produces one account whether the webhook
 * or the customer's browser gets there first.
 */


import { createHmac, timingSafeEqual } from "node:crypto";
import { findProvisionedOrgId, getSql, provisionCheckoutSession } from "../../../lib/provisioning";

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

async function processStripeEvent(event: any) {
  switch (event.type) {
    case "checkout.session.completed":
      // The one shared provisioning function — identical to what the thank-you page triggers.
      await provisionCheckoutSession(event.data.object);
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
  const existing = await findProvisionedOrgId(sql, { stripeCustomerId: customerId || undefined });
  if (existing) {
    console.log(`[Stripe] payment_intent.succeeded ${id}: customer ${customerId || "(none)"} already provisioned as org ${existing} — nothing to do`);
    return;
  }

  const session = await fetchCheckoutSessionForPaymentIntent(id);
  if (session) {
    console.log(`[Stripe] payment_intent.succeeded ${id}: resolved checkout session ${session.id} — provisioning from it`);
    await provisionCheckoutSession(session);
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
 * Alert the owner over SMS. Kept here for the one path this file still owns
 * (payment_intent.succeeded with nothing to provision); the provisioning flow has its own copy
 * in src/lib/provisioning.ts.
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
