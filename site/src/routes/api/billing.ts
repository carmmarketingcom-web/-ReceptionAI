/**
 * GET  /api/billing/plans       — Return subscription plans with Stripe payment links
 * GET  /api/billing/subscription — Return current subscription status + usage
 * POST /api/billing/portal      — Return Stripe Customer Portal URL
 *
 * All endpoints require authentication.
 */


import { authenticate } from "../../../lib/middleware";
import { getDb, isMockMode } from "../../../db/index";
import { subscriptions, subscriptionPlans, usageRecords } from "../../../db/schema/index";
import { eq, and, gte, lte } from "drizzle-orm";

// ─── Plan definitions with Stripe payment links ─────────────────────────────

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    displayName: "Starter",
    priceMonthly: 99,
    priceAnnual: 79,
    includedPhoneLines: 1,
    includedAiMinutes: 500,
    includedSmsMessages: 200,
    features: [
      "1 phone line",
      "500 AI-minutes/month",
      "SMS & web chat",
      "Basic calendar sync",
      "English & Spanish support",
      "Email support",
    ],
    stripePriceId: "price_1TtXMGDqebBmBAbi165hKXK9",
    stripePaymentLink: "https://buy.stripe.com/6oU5kD6rW2C52Fd1D3aVa02",
    cta: "Start Free Trial",
  },
  {
    id: "growth",
    name: "Growth",
    displayName: "Growth",
    priceMonthly: 199,
    priceAnnual: 159,
    includedPhoneLines: 2,
    includedAiMinutes: 2000,
    includedSmsMessages: 1000,
    features: [
      "2 phone lines",
      "2,000 AI-minutes/month",
      "WhatsApp & Facebook integration",
      "Advanced analytics dashboard",
      "Team management",
      "Priority email & chat support",
    ],
    stripePriceId: "price_1TtXMGDqebBmBAbiqd7ybQzy",
    stripePaymentLink: "https://buy.stripe.com/eVq14ng2w90tfrZ4PfaVa03",
    cta: "Start Free Trial",
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    displayName: "Scale",
    priceMonthly: 399,
    priceAnnual: 319,
    includedPhoneLines: 5,
    includedAiMinutes: 10000,
    includedSmsMessages: 5000,
    features: [
      "Unlimited phone lines (5+ add-on)",
      "10,000+ AI-minutes/month",
      "Custom AI response training",
      "All channels included",
      "Dedicated account manager",
      "24/7 priority phone support",
    ],
    stripePriceId: "price_1TtXMGDqebBmBAbidd4SJgki",
    stripePaymentLink: "https://buy.stripe.com/14AaEX03ygsVbbJchHaVa04",
    cta: "Contact Sales",
  },
];

// ─── GET /api/billing/plans ─────────────────────────────────────────────────

export async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route to the correct handler based on the path
    if (path === "/api/billing/plans" || url.searchParams.get("type") === "plans") {
      return handleGetPlans();
    }

    // Default: get subscription
    return handleGetSubscription(request);
  } catch (error) {
    console.error("[Billing API] Error:", error);
    return new Response(
      JSON.stringify({ error: "Billing request failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleGetPlans() {
  return new Response(
    JSON.stringify({
      plans: PLANS,
      annualDiscount: "Save 20% with annual billing",
      trialDays: 14,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleGetSubscription(request: Request) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const usingMock = isMockMode();

  if (usingMock) {
    // Return mock subscription data
    return new Response(
      JSON.stringify({
        subscription: {
          id: "sub_mock_001",
          planId: "growth",
          planName: "Growth",
          status: "active",
          billingCycle: "monthly",
          priceMonthly: 199,
          currentPeriodStart: new Date(Date.now() - 15 * 86400000).toISOString(),
          currentPeriodEnd: new Date(Date.now() + 15 * 86400000).toISOString(),
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
        },
        usage: {
          aiMinutesUsed: 847,
          aiMinutesLimit: 2000,
          aiMinutesPercent: 42,
          phoneLinesUsed: 1,
          phoneLinesLimit: 2,
          phoneLinesPercent: 50,
          smsUsed: 342,
          smsLimit: 1000,
          smsPercent: 34,
        },
        plans: PLANS,
        invoices: [
          { id: "INV-2026-07", date: "Jul 1, 2026", amount: "$199.00", status: "paid", pdfUrl: null },
          { id: "INV-2026-06", date: "Jun 1, 2026", amount: "$199.00", status: "paid", pdfUrl: null },
          { id: "INV-2026-05", date: "May 1, 2026", amount: "$199.00", status: "paid", pdfUrl: null },
          { id: "INV-2026-04", date: "Apr 1, 2026", amount: "$199.00", status: "paid", pdfUrl: null },
          { id: "INV-2026-03", date: "Mar 1, 2026", amount: "$99.00", status: "paid", pdfUrl: null },
        ],
        stripeCustomerPortalUrl: "https://billing.stripe.com/p/login/test",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Production: query from DB
  const db = getDb();
  const orgId = authResult.organizationId;

  const [subscription] = await db
    .select({
      id: subscriptions.id,
      planId: subscriptions.planId,
      status: subscriptions.status,
      billingCycle: subscriptions.billingCycle,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      stripeCustomerId: subscriptions.stripeCustomerId,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      trialEndsAt: subscriptions.trialEndsAt,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      planName: subscriptionPlans.name,
      planDisplayName: subscriptionPlans.displayName,
      planPriceMonthly: subscriptionPlans.priceMonthlyCents,
      planAiMinutes: subscriptionPlans.includedAiMinutes,
      planPhoneLines: subscriptionPlans.includedPhoneLines,
      planSmsMessages: subscriptionPlans.includedSmsMessages,
    })
    .from(subscriptions)
    .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(eq(subscriptions.organizationId, orgId))
    .limit(1);

  // Get current month's usage
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const usageRows = await db
    .select()
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.organizationId, orgId),
        gte(usageRecords.recordedAt, monthStart)
      )
    );

  const aiMinutesUsed = usageRows
    .filter((r) => r.recordType === "ai_minutes")
    .reduce((sum, r) => sum + Number(r.quantity), 0);

  const smsUsed = usageRows
    .filter((r) => r.recordType === "sms_outbound" || r.recordType === "sms_inbound")
    .reduce((sum, r) => sum + Number(r.quantity), 0);

  return new Response(
    JSON.stringify({
      subscription: subscription
        ? {
            id: subscription.id,
            planId: subscription.planName,
            planName: subscription.planDisplayName,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            priceMonthly: subscription.planPriceMonthly
              ? Number(subscription.planPriceMonthly) / 100
              : null,
            currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
            trialEndsAt: subscription.trialEndsAt?.toISOString(),
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      usage: {
        aiMinutesUsed,
        aiMinutesLimit: subscription?.planAiMinutes || 500,
        aiMinutesPercent: subscription?.planAiMinutes
          ? Math.round((aiMinutesUsed / subscription.planAiMinutes) * 100)
          : 0,
        phoneLinesUsed: 1,
        phoneLinesLimit: subscription?.planPhoneLines || 1,
        phoneLinesPercent: subscription?.planPhoneLines
          ? Math.round((1 / subscription.planPhoneLines) * 100)
          : 100,
        smsUsed,
        smsLimit: subscription?.planSmsMessages || 200,
        smsPercent: subscription?.planSmsMessages
          ? Math.round((smsUsed / subscription.planSmsMessages) * 100)
          : 0,
      },
      plans: PLANS,
      invoices: [],
      stripeCustomerPortalUrl: subscription?.stripeCustomerId
        ? `https://billing.stripe.com/p/login/${subscription.stripeCustomerId}`
        : null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// ─── POST /api/billing/portal ───────────────────────────────────────────────

export async function POST({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const url = new URL(request.url);

    // Route: /api/billing/change-plan
    if (url.pathname === "/api/billing/change-plan") {
      return handleChangePlan(request, authResult);
    }

    // Default: portal
    const portalUrl = "https://billing.stripe.com/p/login/test";
    return new Response(
      JSON.stringify({
        url: portalUrl,
        message: "Redirecting to Stripe Customer Portal...",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Billing Portal] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create portal session" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleChangePlan(request: Request, authResult: any) {
  try {
    const body = await request.json() as { plan?: string };
    const { plan } = body;

    if (!plan) {
      return new Response(
        JSON.stringify({ error: "Plan is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const validPlans = ["basic", "starter", "growth", "scale"];
    if (!validPlans.includes(plan)) {
      return new Response(
        JSON.stringify({ error: "Invalid plan" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // In production, update Stripe subscription here
    // For now, return success
    return new Response(
      JSON.stringify({
        success: true,
        message: `Plan changed to ${plan === "basic" ? "Basic at $69/mo (first year, then $99/mo)" : plan}`,
        plan,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Billing Change Plan] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to change plan" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
