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

  // Trimmed: the org name is spoken to every caller, so stray whitespace from the signup form
  // must never reach it. An all-whitespace value falls through to the missing-name guard below.
  const companyName = (metadata.companyName || "").trim();
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

  // h. Send the welcome email — and only claim what is actually true.
  //
  // "Live" is a fact we have to check, not a thing to promise: the receptionist can only
  // answer if a phone_numbers row exists for this org. When the Telnyx purchase failed, or
  // the customer's number is still being ported, the email says exactly that instead of
  // telling a customer their line is answering calls.
  try {
    const numberRows = (await sql`
      SELECT phone_number, is_active, metadata FROM phone_numbers
      WHERE organization_id = ${orgId}
      ORDER BY created_at ASC
      LIMIT 5
    `) as Array<{ phone_number: string; is_active: boolean | string; metadata: any }>;

    const activeRow = numberRows.find((r) => r.is_active === true || r.is_active === "1");
    const phoneNumber = activeRow?.phone_number || "";
    const isLive = !!phoneNumber;
    const pendingPort = numberRows.some((r) => (r.metadata?.status || "") === "pending_port");

    const phoneLine = isLive
      ? `📞 Your phone number: ${phoneNumber}`
      : pendingPort
        ? `📞 Your phone number (${existingPhoneNumber}) is being ported — we'll email you the moment it's live.`
        : `📞 Your phone number is being set up. We'll email it to you as soon as it's live — nothing for you to do.`;

    const keepYourNumberSection = isLive
      ? `Keep your old number:
You can keep your old number by forwarding it to your new one — it takes about 5 minutes at your current phone provider and there's no downtime.

Here's how (steps vary slightly by provider):
• Call forwarding at your carrier: on your old phone, dial *72 followed by your new ReceptionAI number and press call. (If *72 doesn't work on your provider, contact them and ask for unconditional call forwarding to ${phoneNumber}.)
• Or via your provider's web/app portal: find "Call forwarding" / "Forward all calls" and set it to ${phoneNumber}.

Callers keep calling the number they already know, and the AI receptionist still answers 24/7. To turn it off later, dial *73.`
      : `We'll send you the call-forwarding steps (*72 to turn it on, *73 to turn it off) together with your number, so you can keep the number your customers already know.`;

    const statusLine = isLive
      ? "Your AI receptionist is live and ready to answer calls!"
      : "Your account is ready. Your AI receptionist starts answering as soon as your phone number is live — we'll email you the number the moment we have it.";

    const welcomeBody = `Hi ${name},

${statusLine}

${phoneLine}
🔗 Finish your setup (2 min): https://receptionai.store/setup
🔗 Dashboard: https://receptionai.store/login
📖 Getting started: https://receptionai.store/getting-started

Quick start:
1. Log in at https://receptionai.store/login
2. Finish your setup at https://receptionai.store/setup — hours, services, and the mobile number we should transfer calls to
3. Start receiving calls

${keepYourNumberSection}

Your plan is live. Cancel anytime.

Questions? Reply to this email.

— Team ReceptionAI`;

    const subject = isLive
      ? "Welcome to ReceptionAI 🎉 — your AI receptionist is live"
      : "Welcome to ReceptionAI — your account is ready (your number is on the way)";

    // Awaited on purpose: fire-and-forget hid every delivery failure. If this returns
    // false the customer has heard nothing from us, and that has to be in the logs.
    const sent = await sendEmail(email, subject, welcomeBody);
    if (sent) {
      console.log(`[Stripe] Welcome email sent to ${email} (number ${isLive ? "live" : "pending"})`);
    } else {
      console.error(
        `[Stripe] WELCOME EMAIL FAILED for ${email} (org ${orgId}) — the customer has received nothing; contact them manually`
      );
    }
  } catch (err) {
    console.error(
      `[Stripe] Welcome email threw for ${email} (org ${orgId}):`,
      String(err).slice(0, 300)
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
