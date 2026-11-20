/**
 * Billing controls — upgrade / cancel / resume, and the once-only three-month credit.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The owner asked (2026-11-19) for "a upgrade option and a cancel option very small available
 * after one month … with a why of canceling to improve our service, and a half month if they
 * keep it for 3 months". Until this file, the Billing page's cancel flow was a mock funnel that
 * could not cancel anything, and nothing could upgrade a plan except buying a second subscription.
 *
 * This module is the ONE implementation of those controls. Both `serve.ts` trees import it (for
 * `GET /api/billing/manage`, `POST /api/billing/cancel`, `POST /api/billing/resume` and
 * `POST /api/billing/claim-credit`) and so do the vite-dev route files under
 * `src/routes/api/billing/`. Keep `site/src/lib/billing-controls.ts` byte-identical to this file.
 *
 * THE RULES THIS FILE OBEYS
 * -------------------------
 *  - FOUNDER50 IS UNTOUCHED. Nothing here reads, changes, expires or caps a promo coupon. The
 *    half-month credit is a separate, once-only customer-balance credit that lands on the invoice
 *    after three months — it exists to soften the price cliff the coupon creates on month 4. A
 *    customer may have both.
 *  - THE CREDIT IS CLAIMED, NEVER AUTOMATIC (owner amendment 2026-11-20). No timer, no cron and no
 *    sweep ever applies it: `claimThreeMonthCredit` is reached only from an authenticated
 *    `POST /api/billing/claim-credit` for the caller's own org. If nobody presses the button,
 *    nothing is credited.
 *  - The gate is 30 days from the FIRST successful payment: the Stripe subscription's `created`,
 *    or the org's first `checkout.session.completed` in `stripe_events`, whichever exists. The
 *    earlier of the two is used, so a customer is never locked out of cancelling because a
 *    webhook arrived late.
 *  - Cancel takes effect at the END of the paid period (`cancel_at_period_end=true`). The
 *    customer keeps what they already paid for, which is what the shipped FAQ promises.
 *  - With no `STRIPE_SECRET_KEY` nothing is written and nothing is cancelled: the call returns a
 *    clear 503 instead of pretending.
 *  - Every write is idempotent: cancelling twice leaves one open cancellation row, resuming clears
 *    it, and the credit is claimed in `subscription_credits` (UNIQUE on organization_id) BEFORE
 *    Stripe is called, so a double-click or a retry can never credit twice.
 *
 * No third-party imports: this module is loaded by the Bun server, by the Vite-built route
 * handlers and by `bun test`, so it must stay dependency-free. Stripe and `fetch` are injected by
 * the caller. The one relative import is `./cancellation`, which owns the cancel disposition and
 * the number lifecycle the owner approved on 2026-11-20 — same rules, no dependencies.
 */
import {
  CANCEL_CHIPS,
  LEGACY_CANCEL_REASONS,
  normalizeDisposition,
  normalizeForwardNumber,
  normalizeReason,
  planNumberLifecycle,
  listOrgNumbers,
  ensureLifecycleTables,
  type CancelDisposition,
} from "./cancellation";

/** The tagged-template shape of `neon(url)`, injected so tests can supply a fake. */
export type SqlTag = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<any[]>;

/** The slice of `fetch` this module uses, injected so tests can stub Stripe. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

/** The six reasons 0017 shipped with. Still accepted so an old client never gets a 400. */
export const CANCEL_REASONS = LEGACY_CANCEL_REASONS;
export type CancelReason = (typeof CANCEL_REASONS)[number];

/**
 * The one-tap chips the cancel dialog shows (owner 2026-11-20). `reason` is OPTIONAL now: the
 * dialog has four chips and no text box, and "Never mind" is the only thing that aborts.
 */
export const CANCEL_REASON_CHIPS = CANCEL_CHIPS;

/** Both controls open after this many days from the first successful payment. */
export const MANAGE_GATE_DAYS = 30;
/** The half-month credit is applied the first time a subscription passes this many days. */
export const CREDIT_AFTER_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The self-serve price ids, so a plan can still be named if its DB row is missing. */
export const PLAN_BY_PRICE_ID: Record<string, string> = {
  price_1TxrHbP7NtNpgQde64Zp1tgM: "Starter",
  price_1TxrJCP7NtNpgQdeNBA9dxqn: "Growth",
  price_1TxrKSP7NtNpgQdeh8Jh1P2Z: "Scale",
};

export type ManageReason =
  | "no_subscription"
  | "no_stripe_key"
  | "stripe_unavailable"
  | "unknown_start"
  | "too_new";

export interface BillingManage {
  eligible: boolean;
  reason?: ManageReason;
  plan: string | null;
  /** Monthly plan price in cents, as Stripe bills it. */
  amount: number | null;
  /** ISO instant of the first successful payment. */
  memberSince: string | null;
  /** ISO instant the plan ends, when a cancellation is pending. */
  cancelsAt: string | null;
  /** ISO instant of the paid-through date, whether or not a cancellation is pending. */
  periodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  /** The org's active numbers, so the cancel dialog can name every one of them. */
  numbers: string[];
}

export interface BillingEnv {
  sql: SqlTag;
  stripeKey?: string;
  fetchImpl?: FetchLike;
  now?: Date;
}

export interface ManageDeps extends BillingEnv {
  organizationId: string;
}

export interface CancelDeps extends ManageDeps {
  /** Optional since 2026-11-20: the dialog offers chips and the customer may pick none. */
  reason: string;
  comment?: string | null;
  requestedByEmail?: string | null;
  /** "nowhere" (default) or "forward" — where calls go after the paid month ends. */
  disposition?: string;
  /** The number calls are forwarded to, when `disposition` is "forward". */
  forwardTo?: string | null;
}

export interface CancelResult {
  ok: boolean;
  status: number;
  error?: string;
  plan?: string | null;
  amount?: number | null;
  memberSince?: string | null;
  cancelsAt?: string | null;
  tenureDays?: number | null;
  usage?: { calls: number; bookings: number };
  disposition?: CancelDisposition;
  forwardTo?: string | null;
  /** When forwarding stops, for a "forward" cancellation. */
  forwardUntil?: string | null;
  /** The day the number is released, after the out-of-service window. */
  releaseOn?: string | null;
  numbers?: string[];
}

export interface ResumeResult {
  ok: boolean;
  status: number;
  error?: string;
  cancelsAt?: string | null;
}

export interface CreditSweepResult {
  checked: number;
  applied: number;
  skipped: number;
  errors: number;
  note?: string;
}

/** What `POST /api/billing/claim-credit` answers: the three states the page renders. */
export interface CreditClaimResult {
  status: "applied" | "already_claimed" | "not_eligible";
  /** The half-month credit in cents, when it is known. */
  amountCents: number | null;
  /** The same amount as "$49.50", ready to show. */
  amount: string | null;
  reason?: string;
  error?: string;
  /** The HTTP status the endpoint should answer with. */
  httpStatus: number;
}

/** A failure with the HTTP status the endpoint should answer with. */
export class BillingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BillingError";
    this.status = status;
  }
}

// ─── Stripe (REST, injected fetch) ──────────────────────────────────────────

function encodeForm(params: Record<string, string | number | boolean>): string {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  return body.toString();
}

async function stripeCall(
  env: BillingEnv,
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string | number | boolean>
): Promise<any> {
  const key = String(env.stripeKey || "").trim();
  if (!key) {
    throw new BillingError(
      "Billing is not configured on this server yet, so nothing was changed. Please contact us and we will do it for you.",
      503
    );
  }
  const doFetch: FetchLike = env.fetchImpl || (fetch as unknown as FetchLike);
  const init: { method?: string; headers?: Record<string, string>; body?: string } = {
    method,
    headers: { Authorization: `Bearer ${key}` },
  };
  if (params) {
    init.headers!["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = encodeForm(params);
  }
  let res: { ok: boolean; status: number; json: () => Promise<any> };
  try {
    res = await doFetch(`https://api.stripe.com/v1${path}`, init);
  } catch (err) {
    throw new BillingError(`Stripe could not be reached (${String(err).slice(0, 80)}).`, 502);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.error)) {
    const message =
      (data && data.error && data.error.message) || `Stripe rejected the request (${res.status}).`;
    throw new BillingError(String(message).slice(0, 200), 502);
  }
  return data || {};
}

// ─── Schema on first use (the 0008/0010/0013 pattern) ───────────────────────

let billingTablesReady = false;

/**
 * Issue the two tables the migration also creates, so a deploy that lands before the migration is
 * applied by hand still records a cancellation and still claims a credit exactly once.
 */
export async function ensureBillingTables(sql: SqlTag): Promise<boolean> {
  if (billingTablesReady) return true;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_cancellations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        stripe_subscription_id text NULL,
        reason text NOT NULL,
        comment text NULL,
        requested_by_email text NULL,
        effective_at timestamptz NULL,
        resumed_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS subscription_cancellations_org_created_idx
        ON subscription_cancellations (organization_id, created_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS subscription_credits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        stripe_subscription_id text NULL,
        amount_cents integer NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT NOW(),
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS subscription_credits_org_key
        ON subscription_credits (organization_id)
    `;
    billingTablesReady = true;
    return true;
  } catch (err) {
    console.error("[Billing] could not ensure billing tables:", String(err).slice(0, 200));
    return false;
  }
}

// ─── Reading the subscription ───────────────────────────────────────────────

export interface SubscriptionRow {
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  created_at: string | null;
  plan_name: string | null;
  price_monthly_cents: number | null;
}

/** The org's newest subscription row, with its plan's name and monthly price. */
export async function readSubscriptionRow(
  sql: SqlTag,
  organizationId: string
): Promise<SubscriptionRow | null> {
  const rows = (await sql`
    SELECT s.stripe_subscription_id,
           s.stripe_customer_id,
           s.cancel_at_period_end,
           s.current_period_end,
           s.created_at,
           p.display_name AS plan_name,
           p.price_monthly_cents
    FROM subscriptions s
    LEFT JOIN subscription_plans p ON p.id = s.plan_id
    WHERE s.organization_id = ${organizationId}
    ORDER BY s.created_at DESC
    LIMIT 1
  `) as SubscriptionRow[];
  return rows[0] || null;
}

/** A real Stripe subscription id — a Carm one-time checkout stores its `cs_…` session there. */
export function isStripeSubscriptionId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("sub_");
}

async function firstCheckoutAt(sql: SqlTag, stripeCustomerId: string): Promise<string | null> {
  if (!stripeCustomerId) return null;
  try {
    const rows = (await sql`
      SELECT MIN(created_at) AS first_at
      FROM stripe_events
      WHERE event_type = 'checkout.session.completed'
        AND payload->'data'->'object'->>'customer' = ${stripeCustomerId}
    `) as Array<{ first_at: string | null }>;
    return rows[0]?.first_at || null;
  } catch {
    // stripe_events missing or unreadable: the subscription row's own created_at still answers.
    return null;
  }
}

function toIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  if (typeof value === "string" && value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function reasonMessage(reason: ManageReason | undefined): string {
  switch (reason) {
    case "no_stripe_key":
      return "Billing is not configured on this server yet, so nothing was changed. Please contact us and we will do it for you.";
    case "no_subscription":
      return "This business has no paid subscription to manage.";
    case "stripe_unavailable":
      return "We could not reach Stripe just now, so nothing was changed. Please try again in a minute.";
    case "too_new":
      return `Upgrade and cancel open ${MANAGE_GATE_DAYS} days after your first payment.`;
    case "unknown_start":
      return "We cannot tell when this subscription started, so the controls stay closed. Please contact us.";
    default:
      return "This subscription cannot be managed from here.";
  }
}

/** What the Billing page shows. Never throws for a missing subscription or a missing key. */
export async function getBillingManage(deps: ManageDeps): Promise<BillingManage> {
  const now = deps.now || new Date();
  const empty: BillingManage = {
    eligible: false,
    plan: null,
    amount: null,
    memberSince: null,
    cancelsAt: null,
    periodEndsAt: null,
    cancelAtPeriodEnd: false,
    numbers: [],
  };

  await ensureBillingTables(deps.sql);
  // The cancel dialog names every number that will stop answering, so it is read here once.
  empty.numbers = (await listOrgNumbers(deps.sql, deps.organizationId)).map((n) => n.phoneNumber);

  let row: SubscriptionRow | null = null;
  try {
    row = await readSubscriptionRow(deps.sql, deps.organizationId);
  } catch (err) {
    console.error("[Billing] could not read subscription:", messageOf(err).slice(0, 200));
    row = null;
  }

  const dbPlan = row?.plan_name || null;
  const dbAmount = typeof row?.price_monthly_cents === "number" ? row.price_monthly_cents : null;

  if (!row || !isStripeSubscriptionId(row.stripe_subscription_id)) {
    // The founder org, a Carm one-time buyer and a brand-new org all land here.
    return { ...empty, plan: dbPlan, amount: dbAmount, reason: "no_subscription" };
  }

  const subId = String(row.stripe_subscription_id);

  if (!String(deps.stripeKey || "").trim()) {
    return {
      ...empty,
      plan: dbPlan,
      amount: dbAmount,
      cancelAtPeriodEnd: row.cancel_at_period_end === true,
      cancelsAt: row.cancel_at_period_end === true ? toIso(row.current_period_end) : null,
      periodEndsAt: toIso(row.current_period_end),
      reason: "no_stripe_key",
    };
  }

  let stripeSub: any = null;
  let stripeError = false;
  try {
    stripeSub = await stripeCall(deps, "GET", `/subscriptions/${encodeURIComponent(subId)}`);
  } catch (err) {
    stripeError = true;
    console.error("[Billing] Stripe subscription read failed:", messageOf(err).slice(0, 200));
  }

  const itemPrice = stripeSub?.items?.data?.[0]?.price || null;
  const stripeAmount = typeof itemPrice?.unit_amount === "number" ? itemPrice.unit_amount : null;
  const priceId = typeof itemPrice?.id === "string" ? itemPrice.id : "";
  const cancelAtPeriodEnd = stripeSub
    ? stripeSub.cancel_at_period_end === true
    : row.cancel_at_period_end === true;
  const periodEndIso = toIso(stripeSub?.current_period_end) ?? toIso(row.current_period_end);

  // First successful payment: the earlier of Stripe's subscription `created` and this org's first
  // checkout event — "whichever exists". The subscription row's own created_at is only the last
  // resort when neither is readable, because it is a row timestamp, not proof of a payment. Never
  // `organizations.created_at` at all.
  const candidates: number[] = [];
  if (stripeSub && typeof stripeSub.created === "number") candidates.push(stripeSub.created * 1000);
  const firstCheckout = await firstCheckoutAt(deps.sql, String(row.stripe_customer_id || ""));
  const firstCheckoutMs = firstCheckout ? new Date(firstCheckout).getTime() : NaN;
  if (Number.isFinite(firstCheckoutMs)) candidates.push(firstCheckoutMs);
  const rowCreatedMs = row.created_at ? new Date(row.created_at).getTime() : NaN;
  if (candidates.length === 0 && Number.isFinite(rowCreatedMs)) candidates.push(rowCreatedMs);

  const startedAt = candidates.length ? new Date(Math.min(...candidates)) : null;
  const ageDays = startedAt ? (now.getTime() - startedAt.getTime()) / DAY_MS : null;

  const plan = dbPlan || PLAN_BY_PRICE_ID[priceId] || null;
  const amount = stripeAmount ?? dbAmount;
  const base: BillingManage = {
    eligible: false,
    plan,
    amount,
    memberSince: startedAt ? startedAt.toISOString() : null,
    cancelsAt: cancelAtPeriodEnd ? periodEndIso : null,
    periodEndsAt: periodEndIso,
    cancelAtPeriodEnd,
    numbers: empty.numbers,
  };

  if (stripeError) return { ...base, reason: "stripe_unavailable" };
  if (ageDays === null) return { ...base, reason: "unknown_start" };
  if (ageDays < MANAGE_GATE_DAYS) return { ...base, reason: "too_new" };
  return { ...base, eligible: true };
}

// ─── Usage, for the team email ──────────────────────────────────────────────

/** Calls answered and appointments booked for this org in the last `days` days. Real counts. */
export async function recentUsage(
  sql: SqlTag,
  organizationId: string,
  days = 30
): Promise<{ calls: number; bookings: number }> {
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  let calls = 0;
  let bookings = 0;
  try {
    const rows = (await sql`
      SELECT COUNT(*)::int AS calls FROM conversations
      WHERE organization_id = ${organizationId} AND type = 'call' AND started_at >= ${since}::timestamptz
    `) as Array<{ calls: number }>;
    calls = Number(rows[0]?.calls || 0);
  } catch {
    calls = 0;
  }
  try {
    const rows = (await sql`
      SELECT COUNT(*)::int AS bookings FROM appointments
      WHERE organization_id = ${organizationId} AND created_at >= ${since}::timestamptz
    `) as Array<{ bookings: number }>;
    bookings = Number(rows[0]?.bookings || 0);
  } catch {
    bookings = 0;
  }
  return { calls, bookings };
}

// ─── Cancel ─────────────────────────────────────────────────────────────────

/**
 * Cancel at the end of the paid period, record why, and hand back what the team email needs.
 *
 * Idempotent: a second call re-states the same `cancel_at_period_end=true` and updates the one
 * open cancellation row instead of adding a second one.
 */
export async function cancelSubscription(deps: CancelDeps): Promise<CancelResult> {
  // The reason is OPTIONAL (owner 2026-11-20): the dialog shows four chips and the customer may
  // pick none. Whatever arrives is normalised to one of the chips, one of the legacy reasons, or
  // "Not given" — never rejected for being empty.
  const reason = normalizeReason(deps.reason);
  const disposition = normalizeDisposition(deps.disposition);
  const forwardTo = disposition === "forward" ? normalizeForwardNumber(deps.forwardTo) : null;
  if (disposition === "forward" && !forwardTo) {
    return {
      ok: false,
      status: 400,
      error: "Enter the phone number calls should be forwarded to, or choose that callers hear the number is no longer in service.",
    };
  }
  if (!String(deps.stripeKey || "").trim()) {
    return { ok: false, status: 503, error: reasonMessage("no_stripe_key") };
  }

  const manage = await getBillingManage(deps);
  if (!manage.eligible) {
    return {
      ok: false,
      status: manage.reason === "no_stripe_key" || manage.reason === "stripe_unavailable" ? 503 : 403,
      error: reasonMessage(manage.reason),
    };
  }

  let row: SubscriptionRow | null = null;
  try {
    row = await readSubscriptionRow(deps.sql, deps.organizationId);
  } catch (err) {
    return { ok: false, status: 500, error: `Could not read the subscription: ${messageOf(err).slice(0, 120)}` };
  }
  const subId = String(row?.stripe_subscription_id || "");
  if (!isStripeSubscriptionId(subId)) {
    return { ok: false, status: 403, error: reasonMessage("no_subscription") };
  }

  let updated: any;
  try {
    updated = await stripeCall(deps, "POST", `/subscriptions/${encodeURIComponent(subId)}`, {
      cancel_at_period_end: "true",
    });
  } catch (err) {
    return { ok: false, status: err instanceof BillingError ? err.status : 502, error: messageOf(err) };
  }

  const cancelsAt = toIso(updated?.current_period_end) ?? manage.cancelsAt ?? toIso(row?.current_period_end);

  try {
    await deps.sql`
      UPDATE subscriptions
      SET cancel_at_period_end = true, updated_at = NOW()
      WHERE organization_id = ${deps.organizationId} AND stripe_subscription_id = ${subId}
    `;
  } catch (err) {
    console.error("[Billing] cancel: local subscription mirror not updated:", messageOf(err).slice(0, 160));
  }

  const comment = String(deps.comment || "").trim().slice(0, 2000) || null;
  const requestedByEmail = String(deps.requestedByEmail || "").trim() || null;
  // The schedule the sweep will run: end of the paid month, then forward (30d) or straight to the
  // out-of-service message (14d), then release. Nothing is stored in number_lifecycle yet — that
  // happens the moment service actually ends, so a customer who resumes leaves no trace.
  const plan = planNumberLifecycle({
    mode: disposition,
    forwardTo,
    serviceEndsAt: cancelsAt || new Date().toISOString(),
    numbers: manage.numbers || [],
  });
  try {
    await ensureBillingTables(deps.sql);
    await ensureLifecycleTables(deps.sql as any);
    const existing = (await deps.sql`
      UPDATE subscription_cancellations
      SET reason = ${reason},
          comment = ${comment},
          requested_by_email = ${requestedByEmail},
          effective_at = ${cancelsAt},
          disposition = ${disposition},
          forward_to = ${forwardTo},
          service_ended_at = NULL,
          updated_at = NOW()
      WHERE organization_id = ${deps.organizationId} AND resumed_at IS NULL
      RETURNING id
    `) as any[];
    if (existing.length === 0) {
      await deps.sql`
        INSERT INTO subscription_cancellations
          (organization_id, stripe_subscription_id, reason, comment, requested_by_email, effective_at, disposition, forward_to)
        VALUES (${deps.organizationId}, ${subId}, ${reason}, ${comment}, ${requestedByEmail}, ${cancelsAt}, ${disposition}, ${forwardTo})
      `;
    }
  } catch (err) {
    // The Stripe cancellation is what stops the money; a failed note must not undo it.
    console.error("[Billing] cancel: reason not stored:", messageOf(err).slice(0, 200));
  }

  const usage = await recentUsage(deps.sql, deps.organizationId);
  const tenureDays = manage.memberSince
    ? Math.max(0, Math.round(((deps.now || new Date()).getTime() - new Date(manage.memberSince).getTime()) / DAY_MS))
    : null;

  return {
    ok: true,
    status: 200,
    plan: manage.plan,
    amount: manage.amount,
    memberSince: manage.memberSince,
    cancelsAt,
    tenureDays,
    usage,
    disposition,
    forwardTo,
    forwardUntil: plan[0]?.forwardUntil || null,
    releaseOn: plan[0]?.releaseAt || null,
    numbers: manage.numbers || [],
  };
}

// ─── Resume ─────────────────────────────────────────────────────────────────

/** Undo a pending cancellation. Idempotent: resuming twice is one Stripe call the second time. */
export async function resumeSubscription(deps: ManageDeps): Promise<ResumeResult> {
  if (!String(deps.stripeKey || "").trim()) {
    return { ok: false, status: 503, error: reasonMessage("no_stripe_key") };
  }

  let row: SubscriptionRow | null = null;
  try {
    row = await readSubscriptionRow(deps.sql, deps.organizationId);
  } catch (err) {
    return { ok: false, status: 500, error: `Could not read the subscription: ${messageOf(err).slice(0, 120)}` };
  }
  const subId = String(row?.stripe_subscription_id || "");
  if (!isStripeSubscriptionId(subId)) {
    return { ok: false, status: 400, error: reasonMessage("no_subscription") };
  }

  try {
    await stripeCall(deps, "POST", `/subscriptions/${encodeURIComponent(subId)}`, {
      cancel_at_period_end: "false",
    });
  } catch (err) {
    return { ok: false, status: err instanceof BillingError ? err.status : 502, error: messageOf(err) };
  }

  try {
    await deps.sql`
      UPDATE subscriptions
      SET cancel_at_period_end = false, updated_at = NOW()
      WHERE organization_id = ${deps.organizationId} AND stripe_subscription_id = ${subId}
    `;
  } catch (err) {
    console.error("[Billing] resume: local subscription mirror not updated:", messageOf(err).slice(0, 160));
  }

  try {
    await ensureBillingTables(deps.sql);
    await deps.sql`
      UPDATE subscription_cancellations
      SET resumed_at = NOW(), updated_at = NOW()
      WHERE organization_id = ${deps.organizationId} AND resumed_at IS NULL
    `;
  } catch (err) {
    console.error("[Billing] resume: cancellation row not cleared:", messageOf(err).slice(0, 200));
  }

  // If the paid month had already run out and the number was on its way to the out-of-service
  // message (or to release), resuming puts the business back in service: the org stops being
  // "ended" and any number that has NOT been released yet is taken off the schedule. A number
  // that is already released cannot come back — it is a new number at that point.
  try {
    await deps.sql`
      UPDATE organizations SET service_ended_at = NULL, updated_at = NOW()
      WHERE id = ${deps.organizationId} AND service_ended_at IS NOT NULL
    `;
    await deps.sql`
      DELETE FROM number_lifecycle
      WHERE organization_id = ${deps.organizationId} AND released_at IS NULL
    `;
  } catch {
    // The lifecycle tables may not exist on an older database; nothing to undo there.
  }

  return { ok: true, status: 200, cancelsAt: null };
}

// ─── The three-month credit (claimed, never automatic) ──────────────────────

/**
 * Apply the half-month credit ONCE for one org — or for every eligible org when no
 * `organizationId` filter is given.
 *
 * NOTHING CALLS THIS ON A TIMER ANY MORE (owner amendment 2026-11-20): the credit is applied only
 * when the customer presses "Claim your half-month credit", which reaches `claimThreeMonthCredit`
 * below. This function is kept as the one place that talks to Stripe about the credit, and the
 * optional `organizationId` narrows it to the caller's own org.
 *
 * The claim is the INSERT into `subscription_credits` (UNIQUE on organization_id): only the run
 * that wins the insert calls Stripe, and if Stripe rejects it the claim is released so a retry can
 * work. A cancelled subscription is never credited.
 */
export async function applyThreeMonthCredits(
  env: BillingEnv & {
    organizationId?: string;
    notify?: (subject: string, body: string) => Promise<void> | void;
  }
): Promise<CreditSweepResult> {
  const result: CreditSweepResult = { checked: 0, applied: 0, skipped: 0, errors: 0 };
  if (!String(env.stripeKey || "").trim()) {
    return { ...result, note: "no_stripe_key" };
  }
  await ensureBillingTables(env.sql);

  const now = env.now || new Date();
  const onlyOrg = env.organizationId ? String(env.organizationId) : null;
  let rows: any[] = [];
  try {
    rows = (await env.sql`
      SELECT s.organization_id,
             s.stripe_subscription_id,
             s.stripe_customer_id,
             s.created_at,
             p.display_name AS plan_name,
             p.price_monthly_cents
      FROM subscriptions s
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.status = 'active'
        AND LEFT(s.stripe_subscription_id, 4) = 'sub_'
        AND s.stripe_customer_id IS NOT NULL
        AND COALESCE(s.cancel_at_period_end, false) = false
        AND (${onlyOrg}::text IS NULL OR s.organization_id::text = ${onlyOrg}::text)
        AND NOT EXISTS (
          SELECT 1 FROM subscription_credits c WHERE c.organization_id = s.organization_id
        )
      ORDER BY s.created_at ASC
      LIMIT 25
    `) as any[];
  } catch (err) {
    return { ...result, errors: 1, note: `query failed: ${messageOf(err).slice(0, 120)}` };
  }

  for (const row of rows) {
    result.checked++;
    const organizationId = String(row.organization_id || "");
    const subId = String(row.stripe_subscription_id || "");
    const customerId = String(row.stripe_customer_id || "");
    if (!organizationId || !customerId) {
      result.skipped++;
      continue;
    }

    // Stripe knows when the subscription really started and what it really bills.
    let stripeSub: any = null;
    try {
      stripeSub = await stripeCall(env, "GET", `/subscriptions/${encodeURIComponent(subId)}`);
    } catch (err) {
      console.error(`[Billing] credit: Stripe read failed for ${organizationId}:`, messageOf(err).slice(0, 160));
    }

    const startedMs =
      typeof stripeSub?.created === "number"
        ? stripeSub.created * 1000
        : row.created_at
          ? new Date(row.created_at).getTime()
          : NaN;
    if (!Number.isFinite(startedMs)) {
      result.skipped++;
      continue;
    }
    const ageDays = (now.getTime() - startedMs) / DAY_MS;
    if (ageDays < CREDIT_AFTER_DAYS) {
      result.skipped++;
      continue;
    }
    if (stripeSub?.status && stripeSub.status !== "active") {
      result.skipped++;
      continue;
    }

    const unitAmount =
      typeof stripeSub?.items?.data?.[0]?.price?.unit_amount === "number"
        ? stripeSub.items.data[0].price.unit_amount
        : null;
    const monthly = unitAmount ?? (typeof row.price_monthly_cents === "number" ? row.price_monthly_cents : null);
    const amountCents = monthly ? Math.round(monthly / 2) : 0;
    if (!amountCents || amountCents <= 0) {
      result.errors++;
      console.error(`[Billing] credit: no monthly price known for org ${organizationId} — nothing applied`);
      continue;
    }

    // Claim first, then spend. Only the run that inserts the row may credit.
    let claimId = "";
    try {
      const claimed = (await env.sql`
        INSERT INTO subscription_credits (organization_id, stripe_subscription_id, amount_cents, applied_at)
        VALUES (${organizationId}, ${subId}, ${amountCents}, NOW())
        ON CONFLICT (organization_id) DO NOTHING
        RETURNING id
      `) as Array<{ id: string }>;
      claimId = claimed[0]?.id || "";
    } catch (err) {
      result.errors++;
      console.error(`[Billing] credit: claim failed for ${organizationId}:`, messageOf(err).slice(0, 160));
      continue;
    }
    if (!claimId) {
      // Another run got there first (or it was applied before). Never credit twice.
      result.skipped++;
      continue;
    }

    try {
      await stripeCall(env, "POST", `/customers/${encodeURIComponent(customerId)}/balance_transactions`, {
        amount: -amountCents,
        currency: "usd",
        description: "ReceptionAI: half-month credit after three months",
      });
    } catch (err) {
      result.errors++;
      try {
        await env.sql`DELETE FROM subscription_credits WHERE id = ${claimId}`;
      } catch {
        /* the claim stays; the team is told below */
      }
      console.error(`[Billing] credit: Stripe balance credit FAILED for ${organizationId}:`, messageOf(err).slice(0, 200));
      if (env.notify) {
        await env.notify(
          "Billing: three-month credit FAILED",
          `Org ${organizationId} (${row.plan_name || "plan"}) passed ${CREDIT_AFTER_DAYS} days but Stripe rejected the ` +
            `$${(amountCents / 100).toFixed(2)} customer-balance credit: ${messageOf(err).slice(0, 200)}`
        );
      }
      continue;
    }

    result.applied++;
    if (env.notify) {
      await env.notify(
        "Billing: three-month credit applied",
        `Org ${organizationId} (${row.plan_name || "plan"}) has been a paying customer for ` +
          `${Math.floor(ageDays)} days. A $${(amountCents / 100).toFixed(2)} credit (half a month) was ` +
          `applied to their Stripe customer balance and lands on their next invoice. Applied once only.`
      );
    }
  }

  return result;
}

// ─── Claim the credit (owner amendment 2026-11-20) ──────────────────────────

function money(cents: number | null): string | null {
  return typeof cents === "number" && cents > 0 ? `$${(cents / 100).toFixed(2)}` : null;
}

/** The org's credit row, if one exists. The amount is what was actually applied. */
async function readCreditRow(
  sql: SqlTag,
  organizationId: string
): Promise<{ amount_cents: number | null } | null> {
  try {
    const rows = (await sql`
      SELECT amount_cents FROM subscription_credits WHERE organization_id = ${organizationId} LIMIT 1
    `) as Array<{ amount_cents: number | null }>;
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * The customer pressed "Claim your half-month credit".
 *
 * The owner's amendment (2026-11-20): the credit is applied ONLY when the customer asks for it.
 * There is no timer, no cron and no sweep anywhere that reaches Stripe about this credit — this
 * function is the only path, and the endpoint that calls it is authenticated and scoped to the
 * caller's own organization.
 *
 * Answers one of three states, and nothing else:
 *   applied         — Stripe took the customer-balance credit just now, recorded once
 *   already_claimed — a credit row already exists; nothing more is applied, ever
 *   not_eligible    — no live subscription, under 90 days, cancelled, or no price known
 */
export async function claimThreeMonthCredit(
  deps: ManageDeps & { notify?: (subject: string, body: string) => Promise<void> | void }
): Promise<CreditClaimResult> {
  await ensureBillingTables(deps.sql);

  // Already claimed? Say so with the amount that was really applied. Never apply twice.
  const already = await readCreditRow(deps.sql, deps.organizationId);
  if (already) {
    const cents = typeof already.amount_cents === "number" ? already.amount_cents : null;
    return { status: "already_claimed", amountCents: cents, amount: money(cents), httpStatus: 200 };
  }

  if (!String(deps.stripeKey || "").trim()) {
    return {
      status: "not_eligible",
      amountCents: null,
      amount: null,
      reason: "no_stripe_key",
      error: reasonMessage("no_stripe_key"),
      httpStatus: 503,
    };
  }

  let row: SubscriptionRow | null = null;
  try {
    row = await readSubscriptionRow(deps.sql, deps.organizationId);
  } catch (err) {
    return {
      status: "not_eligible",
      amountCents: null,
      amount: null,
      reason: "unreadable",
      error: `Could not read the subscription: ${messageOf(err).slice(0, 120)}`,
      httpStatus: 500,
    };
  }
  if (!row || !isStripeSubscriptionId(row.stripe_subscription_id)) {
    return {
      status: "not_eligible",
      amountCents: null,
      amount: null,
      reason: "no_subscription",
      httpStatus: 200,
    };
  }
  if (row.cancel_at_period_end === true) {
    return {
      status: "not_eligible",
      amountCents: null,
      amount: null,
      reason: "cancelled",
      httpStatus: 200,
    };
  }

  // One org only: the claim can never touch anybody else's subscription.
  const applied = await applyThreeMonthCredits({
    sql: deps.sql,
    stripeKey: deps.stripeKey,
    fetchImpl: deps.fetchImpl,
    now: deps.now,
    organizationId: deps.organizationId,
    notify: deps.notify,
  });

  if (applied.note === "no_stripe_key") {
    return {
      status: "not_eligible",
      amountCents: null,
      amount: null,
      reason: "no_stripe_key",
      error: reasonMessage("no_stripe_key"),
      httpStatus: 503,
    };
  }

  if (applied.applied > 0) {
    const claimed = await readCreditRow(deps.sql, deps.organizationId);
    const cents = typeof claimed?.amount_cents === "number" ? claimed.amount_cents : null;
    return { status: "applied", amountCents: cents, amount: money(cents), httpStatus: 200 };
  }

  // Another press won the race (or the row landed between the two reads).
  const raced = await readCreditRow(deps.sql, deps.organizationId);
  if (raced) {
    const cents = typeof raced.amount_cents === "number" ? raced.amount_cents : null;
    return { status: "already_claimed", amountCents: cents, amount: money(cents), httpStatus: 200 };
  }

  if (applied.errors > 0) {
    return {
      status: "not_eligible",
      amountCents: null,
      amount: null,
      reason: "stripe_failed",
      error:
        "Stripe could not apply the credit just now, so nothing was changed. Try again in a minute — if it keeps failing, message us from Help & support.",
      httpStatus: 502,
    };
  }

  return {
    status: "not_eligible",
    amountCents: null,
    amount: null,
    reason: "too_young",
    httpStatus: 200,
  };
}
