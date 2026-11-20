/**
 * Billing controls (owner 2026-11-19): upgrade / cancel / resume, the 30-day gate, and the
 * once-only three-month half-month credit.
 *
 * Everything Stripe does is stubbed, and Postgres is a fake tagged-template that records what was
 * written — so this test proves the DECISIONS (who may cancel, what is stored, how often a credit
 * can land) without touching a real customer, a real card or the production database.
 *
 * Run: bun run test scripts/billing-controls.test.ts
 */
import { test, expect } from "bun:test";
import {
  CANCEL_REASONS,
  MANAGE_GATE_DAYS,
  CREDIT_AFTER_DAYS,
  getBillingManage,
  cancelSubscription,
  resumeSubscription,
  applyThreeMonthCredits,
  claimThreeMonthCredit,
} from "../src/lib/billing-controls";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const root = await Bun.file(`${REPO}/serve.ts`).text();
const site = await Bun.file(`${REPO}/site/serve.ts`).text();
const rootLib = await Bun.file(`${REPO}/src/lib/billing-controls.ts`).text();
const siteLib = await Bun.file(`${REPO}/site/src/lib/billing-controls.ts`).text();
const rootPage = await Bun.file(`${REPO}/src/routes/dashboard/billing.tsx`).text();
const sitePage = await Bun.file(`${REPO}/site/src/routes/dashboard/billing.tsx`).text();
const rootI18n = await Bun.file(`${REPO}/src/lib/i18n.tsx`).text();
const siteI18n = await Bun.file(`${REPO}/site/src/lib/i18n.tsx`).text();
const migration = await Bun.file(`${REPO}/backend/db/migrations/0017_billing_controls.sql`).text();

const NOW = new Date("2026-11-20T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

// ── Fakes ───────────────────────────────────────────────────────────────────

interface FakeState {
  subRow: any | null;
  creditExists?: boolean;
  firstCheckout?: string | null;
  sweepRows?: any[];
  openCancellationId?: string;
  claimed?: Set<string>;
  writes: string[];
}

function fakeSql(state: FakeState) {
  const claimed = state.claimed || new Set<string>();
  state.claimed = claimed;
  return async (strings: TemplateStringsArray, ...params: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    if (/^CREATE (UNIQUE )?(TABLE|INDEX)/i.test(text)) return [];
    if (/FROM subscriptions s/.test(text) && /ORDER BY s.created_at DESC/.test(text)) {
      return state.subRow ? [state.subRow] : [];
    }
    if (/FROM subscriptions s/.test(text)) return state.sweepRows || [];
    if (/SELECT 1 AS one FROM subscription_credits/.test(text)) {
      return state.creditExists ? [{ one: 1 }] : [];
    }
    if (/SELECT amount_cents FROM subscription_credits/.test(text)) {
      const org = String(params[0] || "");
      return claimed.has(org) ? [{ amount_cents: 9950 }] : [];
    }
    if (/FROM stripe_events/.test(text)) return [{ first_at: state.firstCheckout ?? null }];
    if (/UPDATE subscriptions/.test(text)) {
      state.writes.push("update-subscriptions");
      return [];
    }
    if (/UPDATE subscription_cancellations/.test(text)) {
      state.writes.push("update-cancellation");
      return state.openCancellationId ? [{ id: state.openCancellationId }] : [];
    }
    if (/INSERT INTO subscription_cancellations/.test(text)) {
      state.writes.push("insert-cancellation");
      state.openCancellationId = "cancel-1";
      return [];
    }
    if (/INSERT INTO subscription_credits/.test(text)) {
      const org = String(params[0] || "");
      if (claimed.has(org)) return [];
      claimed.add(org);
      state.writes.push("claim-credit");
      return [{ id: `credit-${org}` }];
    }
    if (/DELETE FROM subscription_credits/.test(text)) {
      state.writes.push("release-credit");
      return [];
    }
    if (/FROM conversations/.test(text)) return [{ calls: 3 }];
    if (/FROM appointments/.test(text)) return [{ bookings: 2 }];
    throw new Error(`unexpected query: ${text.slice(0, 90)}`);
  };
}

function subscription(createdDaysAgo: number, overrides: Record<string, any> = {}) {
  return {
    id: "sub_test_1",
    status: "active",
    created: Math.floor(daysAgo(createdDaysAgo).getTime() / 1000),
    current_period_end: Math.floor(daysAgo(createdDaysAgo - 30).getTime() / 1000),
    cancel_at_period_end: false,
    items: { data: [{ price: { id: "price_1TxrJCP7NtNpgQdeNBA9dxqn", unit_amount: 19900 } }] },
    ...overrides,
  };
}

function subRow(overrides: Record<string, any> = {}) {
  return {
    stripe_subscription_id: "sub_test_1",
    stripe_customer_id: "cus_test_1",
    cancel_at_period_end: false,
    current_period_end: null,
    created_at: daysAgo(120).toISOString(),
    plan_name: "Growth",
    price_monthly_cents: 19900,
    ...overrides,
  };
}

function fakeStripe(opts: { sub?: any; fail?: boolean } = {}) {
  const calls: { method: string; url: string; body?: string }[] = [];
  const fetchImpl = async (url: string, init?: any) => {
    const method = init?.method || "GET";
    calls.push({ method, url, body: init?.body });
    if (opts.fail) {
      return { ok: false, status: 402, json: async () => ({ error: { message: "Your card was declined." } }) };
    }
    if (/\/v1\/subscriptions\/sub_/.test(url) && method === "GET") {
      return { ok: true, status: 200, json: async () => opts.sub ?? subscription(31) };
    }
    if (/\/v1\/subscriptions\/sub_/.test(url) && method === "POST") {
      const cancelAtEnd = String(init?.body || "").includes("cancel_at_period_end=true");
      const base = opts.sub ?? subscription(31);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...base, cancel_at_period_end: cancelAtEnd }),
      };
    }
    if (/\/v1\/customers\/cus_[^/]+\/balance_transactions/.test(url)) {
      return { ok: true, status: 200, json: async () => ({ id: "btxn_test_1" }) };
    }
    throw new Error(`unexpected Stripe call: ${method} ${url}`);
  };
  return { fetchImpl, calls };
}

// ── 1. The 30-day gate ──────────────────────────────────────────────────────

test("eligible gate: 29 days after the first payment stays closed, 31 days opens", async () => {
  const { fetchImpl } = fakeStripe({ sub: subscription(29) });
  const state: FakeState = { subRow: subRow(), writes: [] };
  const young = await getBillingManage({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl,
    now: NOW,
    organizationId: "org-1",
  });
  expect(young.eligible).toBe(false);
  expect(young.reason).toBe("too_new");
  expect(young.plan).toBe("Growth");
  expect(young.amount).toBe(19900);

  const { fetchImpl: fetch2 } = fakeStripe({ sub: subscription(31) });
  const old = await getBillingManage({
    sql: fakeSql({ subRow: subRow(), writes: [] }) as any,
    stripeKey: "sk_test_x",
    fetchImpl: fetch2,
    now: NOW,
    organizationId: "org-1",
  });
  expect(old.eligible).toBe(true);
  expect(old.reason).toBeUndefined();
  expect(MANAGE_GATE_DAYS).toBe(30);
});

test("an org with no Stripe subscription (founder plan) is told so, not gated on days", async () => {
  const state: FakeState = { subRow: null, writes: [] };
  const manage = await getBillingManage({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: fakeStripe().fetchImpl,
    now: NOW,
    organizationId: "org-founder",
  });
  expect(manage.eligible).toBe(false);
  expect(manage.reason).toBe("no_subscription");
  expect(state.writes).toEqual([]);
});

test("a Carm one-time checkout id (cs_…) is not a subscription and cannot be cancelled", async () => {
  const state: FakeState = {
    subRow: subRow({ stripe_subscription_id: "cs_test_123", plan_name: "Starter" }),
    writes: [],
  };
  const result = await cancelSubscription({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: fakeStripe().fetchImpl,
    now: NOW,
    organizationId: "org-carm",
    reason: "Too expensive",
  });
  expect(result.ok).toBe(false);
  expect(state.writes).toEqual([]);
});

// ── 2. Cancel needs a real reason ───────────────────────────────────────────

test("cancel refuses a missing or unknown reason and touches nothing", async () => {
  const state: FakeState = { subRow: subRow(), writes: [] };
  const stripe = fakeStripe();

  const missing = await cancelSubscription({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
    reason: "",
  });
  expect(missing.ok).toBe(false);
  expect(missing.status).toBe(400);

  const unknown = await cancelSubscription({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
    reason: "Because",
  });
  expect(unknown.ok).toBe(false);
  expect(unknown.status).toBe(400);
  expect(CANCEL_REASONS.length).toBe(6);
  expect(stripe.calls.length).toBe(0);
  expect(state.writes).toEqual([]);
});

// ── 3. Cancel sets cancel_at_period_end, once ───────────────────────────────

test("cancel sets cancel_at_period_end=true, stores the reason once, and reports the end date", async () => {
  const state: FakeState = { subRow: subRow(), writes: [] };
  const stripe = fakeStripe({ sub: subscription(31) });
  const deps = {
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
    reason: "Too expensive",
    comment: "Too many calls for the price.",
    requestedByEmail: "owner@example.com",
  };

  const first = await cancelSubscription(deps);
  expect(first.ok).toBe(true);
  const post = stripe.calls.filter((c) => c.method === "POST");
  expect(post.length).toBe(1);
  expect(post[0].body).toContain("cancel_at_period_end=true");
  expect(state.writes).toContain("update-subscriptions");
  expect(state.writes).toContain("insert-cancellation");
  expect(first.cancelsAt).not.toBe(null);
  expect(first.usage).toEqual({ calls: 3, bookings: 2 });

  // Cancelling again updates the one open row — it never adds a second.
  const second = await cancelSubscription(deps);
  expect(second.ok).toBe(true);
  expect(state.writes.filter((w) => w === "insert-cancellation").length).toBe(1);
  expect(state.writes).toContain("update-cancellation");
});

test("resume clears cancel_at_period_end and stamps the open cancellation", async () => {
  const state: FakeState = { subRow: subRow({ cancel_at_period_end: true }), writes: [] };
  const stripe = fakeStripe({ sub: subscription(31, { cancel_at_period_end: true }) });
  const result = await resumeSubscription({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
  });
  expect(result.ok).toBe(true);
  const post = stripe.calls.filter((c) => c.method === "POST");
  expect(post.length).toBe(1);
  expect(post[0].body).toContain("cancel_at_period_end=false");
  expect(state.writes).toContain("update-subscriptions");
  expect(state.writes).toContain("update-cancellation");
});

// ── 4. No Stripe key: a clean error and no write ────────────────────────────

test("with no STRIPE_SECRET_KEY nothing is cancelled, stored or credited", async () => {
  const state: FakeState = { subRow: subRow(), writes: [] };
  const stripe = fakeStripe();

  const manage = await getBillingManage({
    sql: fakeSql(state) as any,
    stripeKey: "",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
  });
  expect(manage.eligible).toBe(false);
  expect(manage.reason).toBe("no_stripe_key");

  const cancelled = await cancelSubscription({
    sql: fakeSql(state) as any,
    stripeKey: "",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
    reason: "Too expensive",
  });
  expect(cancelled.ok).toBe(false);
  expect(cancelled.status).toBe(503);
  expect(String(cancelled.error)).toContain("not configured");

  const resumed = await resumeSubscription({
    sql: fakeSql(state) as any,
    stripeKey: "",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
  });
  expect(resumed.ok).toBe(false);
  expect(resumed.status).toBe(503);

  const sweep = await applyThreeMonthCredits({
    sql: fakeSql(state) as any,
    stripeKey: "",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
  });
  expect(sweep.applied).toBe(0);
  expect(sweep.note).toBe("no_stripe_key");

  expect(stripe.calls.length).toBe(0);
  expect(state.writes).toEqual([]);
});

// ── 5. The half-month credit: once, after 90 days, never twice ──────────────

test("the three-month credit applies half a month once and never a second time", async () => {
  const state: FakeState = {
    subRow: null,
    writes: [],
    sweepRows: [
      {
        organization_id: "org-old",
        stripe_subscription_id: "sub_old",
        stripe_customer_id: "cus_old",
        created_at: daysAgo(100).toISOString(),
        plan_name: "Growth",
        price_monthly_cents: 19900,
      },
    ],
  };
  const stripe = fakeStripe({ sub: subscription(100) });

  const first = await applyThreeMonthCredits({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
  });
  expect(first.applied).toBe(1);
  expect(first.errors).toBe(0);
  const credit = stripe.calls.find((c) => /balance_transactions/.test(c.url));
  expect(credit).toBeDefined();
  expect(credit!.body).toContain("amount=-9950"); // half of $199.00
  expect(state.writes).toContain("claim-credit");

  // A second sweep (a restart, or tomorrow's pass) claims nothing and credits nothing.
  const second = await applyThreeMonthCredits({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
  });
  expect(second.applied).toBe(0);
  expect(stripe.calls.filter((c) => /balance_transactions/.test(c.url)).length).toBe(1);
});

test("the credit waits until 90 days and is not applied to a cancelled subscription", async () => {
  expect(CREDIT_AFTER_DAYS).toBe(90);
  const youngState: FakeState = {
    subRow: null,
    writes: [],
    sweepRows: [
      {
        organization_id: "org-young",
        stripe_subscription_id: "sub_young",
        stripe_customer_id: "cus_young",
        created_at: daysAgo(60).toISOString(),
        plan_name: "Starter",
        price_monthly_cents: 9900,
      },
    ],
  };
  const youngStripe = fakeStripe({ sub: subscription(60) });
  const young = await applyThreeMonthCredits({
    sql: fakeSql(youngState) as any,
    stripeKey: "sk_test_x",
    fetchImpl: youngStripe.fetchImpl,
    now: NOW,
  });
  expect(young.applied).toBe(0);
  expect(young.skipped).toBe(1);
  expect(youngState.writes).toEqual([]);
  expect(youngStripe.calls.filter((c) => /balance_transactions/.test(c.url)).length).toBe(0);

  // The sweep's own query excludes cancelled subscriptions — pinned here so it cannot drift.
  const sweepQuery = rootLib.slice(rootLib.indexOf("FROM subscriptions s"), rootLib.indexOf("LIMIT 25"));
  expect(sweepQuery).toContain("s.status = 'active'");
  expect(sweepQuery).toContain("COALESCE(s.cancel_at_period_end, false) = false");
});

test("a rejected Stripe credit releases the claim so a later sweep can try again", async () => {
  const state: FakeState = {
    subRow: null,
    writes: [],
    sweepRows: [
      {
        organization_id: "org-old",
        stripe_subscription_id: "sub_old",
        stripe_customer_id: "cus_old",
        created_at: daysAgo(100).toISOString(),
        plan_name: "Growth",
        price_monthly_cents: 19900,
      },
    ],
  };
  const result = await applyThreeMonthCredits({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: fakeStripe({ fail: true }).fetchImpl,
    now: NOW,
  });
  expect(result.applied).toBe(0);
  expect(result.errors).toBe(1);
  expect(state.writes).toContain("release-credit");
});

// ── 5b. The credit is CLAIMED on request, never applied by a timer ──────────

test("claiming the credit applies it once and then answers already_claimed", async () => {
  const state: FakeState = {
    subRow: subRow(),
    writes: [],
    sweepRows: [
      {
        organization_id: "org-1",
        stripe_subscription_id: "sub_test_1",
        stripe_customer_id: "cus_test_1",
        created_at: daysAgo(100).toISOString(),
        plan_name: "Growth",
        price_monthly_cents: 19900,
      },
    ],
  };
  const stripe = fakeStripe({ sub: subscription(100) });
  const deps = {
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
  };

  const first = await claimThreeMonthCredit(deps);
  expect(first.status).toBe("applied");
  expect(first.amountCents).toBe(9950);
  expect(first.amount).toBe("$99.50");
  expect(stripe.calls.filter((c) => /balance_transactions/.test(c.url)).length).toBe(1);
  expect(state.writes).toContain("claim-credit");

  const second = await claimThreeMonthCredit({ ...deps, sql: fakeSql(state) as any });
  expect(second.status).toBe("already_claimed");
  expect(second.amountCents).toBe(9950);
  expect(stripe.calls.filter((c) => /balance_transactions/.test(c.url)).length).toBe(1);
});

test("the credit cannot be claimed before 90 days or without a Stripe key", async () => {
  const state: FakeState = { subRow: subRow(), writes: [] };
  const stripe = fakeStripe({ sub: subscription(60) });

  const young = await claimThreeMonthCredit({
    sql: fakeSql(state) as any,
    stripeKey: "sk_test_x",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
  });
  expect(young.status).toBe("not_eligible");
  expect(stripe.calls.filter((c) => /balance_transactions/.test(c.url)).length).toBe(0);
  expect(state.writes).toEqual([]);

  const noKey = await claimThreeMonthCredit({
    sql: fakeSql(state) as any,
    stripeKey: "",
    fetchImpl: stripe.fetchImpl,
    now: NOW,
    organizationId: "org-1",
  });
  expect(noKey.status).toBe("not_eligible");
  expect(noKey.httpStatus).toBe(503);
  expect(state.writes).toEqual([]);
});

// ── 6. Both trees, the page and the FAQ stay in step ────────────────────────

test("the billing-controls lib and the three handlers are identical in both trees", () => {
  expect(rootLib).toBe(siteLib);
  const start = 'if (pathname === "/api/billing/manage" && req.method === "GET") {';
  const end = "// ── Billing API";
  const grab = (src: string) => {
    const a = src.indexOf(start);
    const b = src.indexOf(end, a);
    expect(a).toBeGreaterThan(-1);
    return src.slice(a, b);
  };
  const a = grab(root);
  const b = grab(site);
  expect(a).toBe(b);
  // Auth before any DB work, and no coupon logic anywhere near the billing controls.
  expect(a.indexOf("requireOrgAuth")).toBeLessThan(a.indexOf("DATABASE_URL"));
  expect(a).toContain("cancelSubscription(");
  expect(a).toContain("resumeSubscription(");
  expect(a).not.toContain("FOUNDER50");
  expect(a).not.toContain("coupon");
  // No timer, cron or sweep may ever apply the credit (owner amendment 2026-11-20): the customer
  // claims it from the Billing page, and that endpoint is the only path.
  expect(root).not.toContain("runThreeMonthCreditSweep");
  expect(site).not.toContain("runThreeMonthCreditSweep");
  expect(root).not.toContain("lastCreditSweepDay");
  expect(site).not.toContain("lastCreditSweepDay");
  expect(a).toContain('"/api/billing/claim-credit"');
  expect(a).toContain("claimThreeMonthCredit(");
});

test("the Billing page gates the controls and asks why, in both trees", () => {
  expect(rootPage).toBe(sitePage);
  expect(rootPage).toContain("/api/billing/manage");
  expect(rootPage).toContain("/api/billing/cancel");
  expect(rootPage).toContain("/api/billing/resume");
  expect(rootPage).toContain("Upgrade and cancel open after your first month.");
  expect(rootPage).toContain("You are on the founder plan; there is nothing to manage.");
  expect(rootPage).toContain("Your plan stays active until");
  expect(rootPage).toContain("You can undo this until then.");
  // The credit is claimed, never automatic, and the button names the amount.
  expect(rootPage).toContain("/api/billing/claim-credit");
  expect(rootPage).toContain("Claim your half-month credit");
  expect(rootPage).toContain("Active until ");
  for (const reason of CANCEL_REASONS) expect(rootPage).toContain(`"${reason}"`);
  // The mock funnel that could not cancel anything is gone.
  expect(rootPage).not.toContain("CancelSection");
  expect(rootPage).not.toContain("$69/mo");
});

test("FAQ answers 4 and 5 describe what the code does, in both languages", () => {
  expect(rootI18n).toBe(siteI18n);
  const faq4 = rootI18n.slice(rootI18n.indexOf('"faq.n4.a"'), rootI18n.indexOf('"faq.n5.q"'));
  const faq5 = rootI18n.slice(rootI18n.indexOf('"faq.n5.a"'), rootI18n.indexOf('"faq.n6.q"'));
  // Upgrade: the portal, and never a second subscription.
  expect(faq4).toContain("billing portal");
  expect(faq4).toContain("portal de Stripe");
  // Cancel: after the first month, a required reason, runs to the end of the paid month.
  expect(faq5).toContain("After your first month");
  expect(faq5).toContain("Después de tu primer mes");
  expect(faq5).toContain("end of the month you have already paid for");
  expect(faq5).toContain("al final del mes que ya pagaste");
  // The credit is stated in both languages, and it is CLAIMED, never automatic.
  expect(faq5).toContain("half-month credit");
  expect(faq5).toContain("crédito de medio mes");
  expect(faq5).toContain("it is not automatic");
  expect(faq5).toContain("no es automático");
  expect(faq5).toContain("Claim your half-month credit");
  expect(faq5).toContain("reclamar tu crédito de medio mes");
  expect(faq5).toContain("last day of that month");
  expect(faq5).toContain("último día de ese mes");
  // Nothing still claims the cancel button is missing or that it is done by email.
  expect(faq5).not.toContain("not live yet");
  expect(faq5).not.toContain("todavía no está activo");
});

test("migration 0017 creates both tables with the once-only credit index", () => {
  expect(migration).toContain("CREATE TABLE IF NOT EXISTS subscription_cancellations");
  expect(migration).toContain("CREATE TABLE IF NOT EXISTS subscription_credits");
  expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS subscription_credits_org_key");
  expect(migration).toContain("(organization_id)");
});
