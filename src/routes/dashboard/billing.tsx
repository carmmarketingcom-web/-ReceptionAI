import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "~/lib/api-client";

export const Route = createFileRoute("/dashboard/billing")({
  component: BillingPage,
});

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$99",
    priceNum: 99,
    aiMinutes: 500,
    phoneLines: 1,
    features: [
      "1 phone line",
      "500 AI-minutes/month",
      "Email notifications & web chat",
      "Basic calendar sync",
      "English & Spanish",
    ],
    stripePaymentLink: "https://buy.stripe.com/6oU5kD6rW2C52Fd1D3aVa02",
    stripePriceId: "price_1TxrHbP7NtNpgQde64Zp1tgM",
  },
  {
    id: "growth",
    name: "Growth",
    price: "$199",
    priceNum: 199,
    aiMinutes: 2000,
    phoneLines: 2,
    features: [
      "2 phone lines",
      "2,000 AI-minutes/month",
      "WhatsApp & Facebook",
      "Advanced analytics",
      "Team management",
      "Priority support",
    ],
    stripePaymentLink: "https://buy.stripe.com/eVq14ng2w90tfrZ4PfaVa03",
    stripePriceId: "price_1TxrJCP7NtNpgQdeNBA9dxqn",
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$399",
    priceNum: 399,
    aiMinutes: 10000,
    phoneLines: 5,
    features: [
      "5+ phone lines",
      "10,000+ AI-minutes/month",
      "Custom AI training",
      "All channels",
      "Dedicated account manager",
      "24/7 priority support",
    ],
    stripePaymentLink: "https://buy.stripe.com/14AaEX03ygsVbbJchHaVa04",
    stripePriceId: "price_1TxrKSP7NtNpgQdeh8Jh1P2Z",
  },
];

// Mock data for the current subscription
const currentPlan = "growth";

const invoices = [
  { id: "INV-2026-07", date: "Jul 1, 2026", amount: "$199.00", status: "paid" },
  { id: "INV-2026-06", date: "Jun 1, 2026", amount: "$199.00", status: "paid" },
  { id: "INV-2026-05", date: "May 1, 2026", amount: "$199.00", status: "paid" },
  { id: "INV-2026-04", date: "Apr 1, 2026", amount: "$199.00", status: "paid" },
  { id: "INV-2026-03", date: "Mar 1, 2026", amount: "$99.00", status: "paid" },
];

function BillingPage() {
  const [showPlans, setShowPlans] = useState(false);
  const activePlanData = plans.find((p) => p.id === currentPlan);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription, view invoices, and update payment methods.
        </p>
      </div>

      {/* Current Plan */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Current Plan</h2>
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900">
                {activePlanData?.name} Plan
              </p>
              <p className="text-sm text-gray-500">
                {activePlanData?.price}/month · {activePlanData?.phoneLines}{" "}
                line{activePlanData && activePlanData.phoneLines > 1 ? "s" : ""}{" "}
                · {activePlanData?.aiMinutes?.toLocaleString()} AI-minutes
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Active
            </span>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowPlans(!showPlans)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {showPlans ? "Hide Plans" : "Change Plan"}
            </button>
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem("receptionai_token");
                  const res = await fetch("/api/stripe/portal", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                  });
                  const data = (await res.json()) as { url?: string; error?: string };
                  if (data.url) window.open(data.url, "_blank");
                } catch { /* fail silently */ }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Manage Billing
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          </div>

          {/* Plan selection cards */}
          {showPlans && (
            <div className="mt-6 grid gap-4 border-t border-gray-100 pt-6 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-xl border p-5 ${
                      isCurrent
                        ? "border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200"
                        : plan.popular
                          ? "border-indigo-200 bg-white shadow-sm"
                          : "border-gray-200 bg-white"
                    }`}
                  >
                    {plan.popular && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                          Popular
                        </span>
                      </div>
                    )}
                    <h3 className="text-base font-bold text-gray-900">
                      {plan.name}
                    </h3>
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {plan.price}
                      </span>
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                    <ul className="mt-3 flex-1 space-y-1.5">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-xs text-gray-600"
                        >
                          <svg
                            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      {isCurrent ? (
                        <span className="block rounded-lg border border-indigo-300 bg-white px-3 py-2 text-center text-xs font-semibold text-indigo-600">
                          Current Plan
                        </span>
                      ) : (
                        <a
                          href={plan.stripePaymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-lg bg-indigo-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          {plan.priceNum > (activePlanData?.priceNum || 0)
                            ? "Upgrade"
                            : "Switch"}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Manage subscription — small, quiet, and gated (owner 2026-11-19) */}
      <ManageSubscription />

      {/* Usage */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Usage This Month
          </h2>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">AI-minutes used</span>
              <span className="font-medium text-gray-900">
                847 / {activePlanData?.aiMinutes?.toLocaleString() || "2,000"}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: "42%" }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              42% of monthly limit used
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Email notifications</span>
              <span className="font-medium text-gray-900">Included in every plan</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Every call summary, missed call, voicemail alert and web-chat callback is emailed to
              you automatically, in the caller's language — no extra charge, nothing to count.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Text (SMS) alerts are an optional add-on, not part of any plan. They are not priced
              here and not delivered yet.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Phone lines</span>
              <span className="font-medium text-gray-900">
                1 / {activePlanData?.phoneLines || "2"}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{
                  width: `${
                    activePlanData
                      ? Math.round((1 / activePlanData.phoneLines) * 100)
                      : 50
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Invoice History
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between px-5 py-3.5"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{inv.id}</p>
                <p className="text-xs text-gray-500">{inv.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {inv.amount}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    inv.status === "paid"
                      ? "bg-green-100 text-green-700"
                      : inv.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                </span>
                <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Annual billing CTA */}
      <div className="rounded-xl bg-indigo-50 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              Save 20% with annual billing
            </p>
            <p className="text-xs text-indigo-700">
              Switch to annual and save{" "}
              {activePlanData
                ? `$${Math.round(activePlanData.priceNum * 0.2 * 12)}`
                : "$240"}{" "}
              per year.
            </p>
          </div>
          <a
            href="https://buy.stripe.com/eVq14ng2w90tfrZ4PfaVa03"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Switch to Annual
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>

      </div>
    </div>
  );
}

// ─── Manage subscription (owner 2026-11-19) ─────────────────────────────────
// The owner asked for "a upgrade option and a cancel option very small available after one month
// … with a why of canceling". Everything here is read from GET /api/billing/manage and acted on
// through /api/billing/cancel, /api/billing/resume and /api/billing/claim-credit — real Stripe
// calls, org-scoped.
//
// Nothing renders before 30 days from the first payment, and a business with no Stripe
// subscription (the founder org, a Carm one-time buyer) is told so instead of being shown a
// control that cannot work. Upgrade opens the Stripe billing portal, which is the supported path
// for a plan change. Cancel runs to the END of the paid period and names that exact date, so the
// customer keeps what they already paid for. The half-month credit is CLAIMED, never automatic
// (owner amendment 2026-11-20): the button appears only when it is genuinely claimable, and it
// names the amount. FOUNDER50 is untouched either way.
const CANCEL_REASONS = [
  "Too expensive",
  "Not enough calls",
  "Missing a feature",
  "Closing the business",
  "Going elsewhere",
  "Other",
];

interface BillingManage {
  eligible: boolean;
  reason?: string;
  plan: string | null;
  amount: number | null;
  memberSince: string | null;
  cancelsAt: string | null;
  periodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  creditApplied: boolean;
  creditEligible: boolean;
  creditAmountCents: number | null;
}

interface ClaimResult {
  status: "applied" | "already_claimed" | "not_eligible";
  amountCents: number | null;
  amount: string | null;
  reason?: string;
  error?: string;
}

function fmtDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** The exact last day of the paid month, spelled out: "December 19, 2026". */
function fmtUntil(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function usd(cents: number | null): string {
  return typeof cents === "number" && cents > 0 ? `$${(cents / 100).toFixed(2)}` : "";
}

function ManageSubscription() {
  const [manage, setManage] = useState<BillingManage | null>(null);
  const [loadError, setLoadError] = useState("");
  const [panel, setPanel] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [claimed, setClaimed] = useState<ClaimResult | null>(null);

  const load = async () => {
    try {
      const next = await api.get<BillingManage>("/api/billing/manage");
      setManage(next);
      setLoadError("");
    } catch {
      setLoadError("Could not load your billing details.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openPortal = async () => {
    setError("");
    setBusy("portal");
    try {
      const res = await api.post<{ url?: string }>("/api/stripe/portal");
      if (res?.url) window.open(res.url, "_blank");
      else setError("The billing portal did not return a link. Try again in a minute.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the billing portal.");
    } finally {
      setBusy("");
    }
  };

  const submitCancel = async () => {
    if (!reason) {
      setError("Choose a reason for cancelling.");
      return;
    }
    setBusy("cancel");
    setError("");
    try {
      await api.post("/api/billing/cancel", { reason, comment: comment.trim() || undefined });
      await load();
      setPanel(false);
      setComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel the subscription.");
    } finally {
      setBusy("");
    }
  };

  const undoCancel = async () => {
    setBusy("undo");
    setError("");
    try {
      await api.post("/api/billing/resume");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo the cancellation.");
    } finally {
      setBusy("");
    }
  };

  // The half-month credit is claimed by the customer — nothing applies it on its own.
  const claimCredit = async () => {
    setBusy("credit");
    setError("");
    try {
      const result = await api.post<ClaimResult>("/api/billing/claim-credit");
      setClaimed(result);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply the credit. Nothing was changed.");
    } finally {
      setBusy("");
    }
  };

  if (loadError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Manage subscription</h2>
        <p className="mt-1 text-xs text-gray-500">{loadError}</p>
      </div>
    );
  }

  if (!manage) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Manage subscription</h2>
        <p className="mt-1 text-xs text-gray-400">Loading…</p>
      </div>
    );
  }

  const shell = (children: React.ReactNode) => (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Manage subscription</h2>
      {children}
    </div>
  );

  if (manage.reason === "no_subscription") {
    return shell(
      <p className="mt-1 text-xs text-gray-500">
        You are on the founder plan; there is nothing to manage.
      </p>
    );
  }

  if (!manage.eligible) {
    const line =
      manage.reason === "too_new"
        ? "Upgrade and cancel open after your first month."
        : manage.reason === "stripe_unavailable"
          ? "We could not reach Stripe just now — try again in a minute."
          : manage.reason === "no_stripe_key"
            ? "Billing controls are not switched on yet. Message us from Help & support and we will do it for you."
            : "There is nothing to manage on this plan.";
    return shell(<p className="mt-1 text-xs text-gray-500">{line}</p>);
  }

  const price = manage.amount ? `$${(manage.amount / 100).toFixed(0)}/month` : "";
  const memberSince = fmtDay(manage.memberSince);
  // The last day of the month they have already paid for — the date cancelling runs to.
  const paidUntil = fmtUntil(manage.periodEndsAt || manage.cancelsAt);
  const creditAmount = usd(manage.creditAmountCents ?? (manage.amount ? Math.round(manage.amount / 2) : null));

  return shell(
    <>
      <p className="mt-1 text-xs text-gray-500">
        {manage.plan || "Your plan"}
        {price ? ` · ${price}` : ""}
        {memberSince ? ` · member since ${memberSince}` : ""}
      </p>

      {/* Claim your half-month credit — only when it is really claimable (owner 2026-11-20). */}
      {manage.creditEligible && !manage.creditApplied && !manage.cancelAtPeriodEnd && (
        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
          <button
            onClick={claimCredit}
            disabled={busy !== ""}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === "credit" ? "Claiming…" : `Claim your half-month credit${creditAmount ? ` (${creditAmount})` : ""}`}
          </button>
          <p className="mt-2 text-xs text-gray-600">
            You have been with us for three months{creditAmount ? `, so ${creditAmount} — half a month — is yours` : ""}.
            It is not applied automatically: press the button and it is credited to your next invoice, once.
          </p>
          {claimed?.status === "applied" && (
            <p className="mt-1 text-xs font-medium text-green-700">
              Applied{claimed.amount ? ` — ${claimed.amount}` : ""}. It comes off your next invoice.
            </p>
          )}
        </div>
      )}

      {manage.creditApplied && !manage.creditEligible && (
        <p className="mt-2 text-xs text-gray-500">
          Half-month credit claimed — it comes off your next invoice.
        </p>
      )}

      {manage.cancelAtPeriodEnd ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-700">
            Active until {paidUntil || "the last day of the month you have paid for"}. You can undo this until then.
          </p>
          <button
            onClick={undoCancel}
            disabled={busy !== ""}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "undo" ? "Undoing…" : "Undo"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={openPortal}
            disabled={busy !== ""}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "portal" ? "Opening…" : "Upgrade"}
          </button>
          <button
            onClick={() => {
              setPanel(!panel);
              setError("");
            }}
            className="text-xs font-medium text-gray-400 hover:text-red-500"
          >
            Cancel subscription
          </button>
        </div>
      )}

      {panel && !manage.cancelAtPeriodEnd && (
        <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <label className="block text-xs font-medium text-gray-700">
            Why are you cancelling? <span className="text-red-500">*</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
            >
              <option value="">Choose a reason</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Anything else? (optional)
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
              placeholder="What could we have done better?"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={submitCancel}
              disabled={busy !== "" || !reason}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy === "cancel" ? "Cancelling…" : "Confirm cancellation"}
            </button>
            <button
              onClick={() => {
                setPanel(false);
                setError("");
              }}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Keep my plan
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Your plan stays active until {paidUntil || "the last day of the month you have paid for"}.
            Cancelling does not end service early and nothing is prorated back. The first month is
            not refundable, whichever day you cancel.
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      {error && !panel && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </>
  );
}
