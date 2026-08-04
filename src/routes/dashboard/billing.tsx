import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "~/lib/api-client";
import { useConversations, useAppointments } from "~/lib/hooks/use-data";

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
    smsMessages: 200,
    features: [
      "1 phone line",
      "500 AI-minutes/month",
      "SMS & web chat",
      "Basic calendar sync",
      "English & Spanish",
    ],
    stripePaymentLink: "https://buy.stripe.com/6oU5kD6rW2C52Fd1D3aVa02",
    stripePriceId: "price_1TtXMGDqebBmBAbi165hKXK9",
  },
  {
    id: "growth",
    name: "Growth",
    price: "$199",
    priceNum: 199,
    aiMinutes: 2000,
    phoneLines: 2,
    smsMessages: 1000,
    features: [
      "2 phone lines",
      "2,000 AI-minutes/month",
      "WhatsApp & Facebook",
      "Advanced analytics",
      "Team management",
      "Priority support",
    ],
    stripePaymentLink: "https://buy.stripe.com/eVq14ng2w90tfrZ4PfaVa03",
    stripePriceId: "price_1TtXMGDqebBmBAbiqd7ybQzy",
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$399",
    priceNum: 399,
    aiMinutes: 10000,
    phoneLines: 5,
    smsMessages: 5000,
    features: [
      "5+ phone lines",
      "10,000+ AI-minutes/month",
      "Custom AI training",
      "All channels",
      "Dedicated account manager",
      "24/7 priority support",
    ],
    stripePaymentLink: "https://buy.stripe.com/14AaEX03ygsVbbJchHaVa04",
    stripePriceId: "price_1TtXMGDqebBmBAbidd4SJgki",
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
              <span className="text-gray-700">SMS messages</span>
              <span className="font-medium text-gray-900">
                342 / {activePlanData?.smsMessages?.toLocaleString() || "1,000"}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: "34%" }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              34% of monthly limit used
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

        {/* Cancel / Downgrade Section */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">Manage Subscription</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <CancelSection />
          </div>
        </div>
      </div>
    </div>
  );
}

function CancelSection() {
  const { data: conversationsData } = useConversations(200, 0);
  const { data: appointmentsData } = useAppointments({ limit: 200 });

  const conversations = conversationsData?.conversations || [];
  const appointments = appointmentsData?.appointments || [];

  const today = new Date().toISOString().slice(0, 10);
  const monthCalls = conversations.filter((c: any) => c.createdAt?.startsWith(today.slice(0, 7))).length;
  const monthBookings = appointments.filter((a: any) => a.createdAt?.startsWith(today.slice(0, 7))).length;

  // Flow state: -1 = hidden, 0 = "Cancel" link, then 1-6 = layers
  const [layer, setLayer] = useState(-1);
  const [pauseMonths, setPauseMonths] = useState(1);
  const [surveyAnswer, setSurveyAnswer] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(""); // "paused" | "downgraded" | "cancelled"

  if (done) {
    const messages: Record<string, { title: string; sub: string }> = {
      paused: { title: "✅ Paused!", sub: `We'll resume your service in ${pauseMonths} month${pauseMonths > 1 ? "s" : ""}. Your data is saved.` },
      downgraded: { title: "✅ Downgraded to Basic ($69/mo—first year)", sub: "$69/mo for the first 12 months, then $99/mo after. Cancel anytime." },
      cancelled: { title: "Subscription Canceled", sub: "Your service will end at the end of your billing period. We're sorry to see you go." },
    };
    const msg = messages[done] || messages.cancelled;
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">✅</div>
        <p className="mt-3 text-sm font-semibold text-green-700">{msg.title}</p>
        <p className="mt-1 text-xs text-gray-500">{msg.sub}</p>
      </div>
    );
  }

  const handleDowngrade = async () => {
    setDowngrading(true);
    setError("");
    try {
      await api.post("/api/billing/change-plan", { plan: "basic" });
      setDone("downgraded");
    } catch {
      setError("Failed to change plan. Please try again.");
    } finally {
      setDowngrading(false);
    }
  };

  const closeAll = () => { setLayer(-1); setConfirmed(false); setSurveyAnswer(""); };

  return (
    <div>
      {layer === -1 && (
        <button onClick={() => setLayer(0)} className="text-sm font-medium text-gray-400 hover:text-red-500">
          Cancel Subscription
        </button>
      )}

      {/* Layer 0: Usage Stats */}
      {layer === 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">
            {monthCalls > 0
              ? `Your AI receptionist answered ${monthCalls} call${monthCalls !== 1 ? "s" : ""} and booked ${monthBookings} appointment${monthBookings !== 1 ? "s" : ""} this month.`
              : "Your AI receptionist is live and ready to answer calls."}
          </p>
          <p className="text-sm text-gray-600">Are you sure you want to cancel?</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setLayer(1)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Yes, continue</button>
            <button onClick={closeAll} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Keep My Subscription</button>
          </div>
        </div>
      )}

      {/* Layer 1: Pause */}
      {layer === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">Going on vacation or taking a break?</p>
          <p className="text-xs text-gray-500">Pause your subscription instead of canceling. Your data and phone number are saved.</p>
          <div className="flex gap-3">
            {[1, 2, 3].map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${pauseMonths === m ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                <input type="radio" name="pause" checked={pauseMonths === m} onChange={() => setPauseMonths(m)} className="sr-only" />
                {m} month{m > 1 ? "s" : ""}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setDone("paused")} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Pause Subscription</button>
            <button onClick={() => setLayer(2)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">No, continue canceling</button>
            <button onClick={closeAll} className="text-sm text-gray-400 hover:text-gray-600">Keep my subscription</button>
          </div>
        </div>
      )}

      {/* Layer 2: Annual */}
      {layer === 2 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">Switch to annual billing and save 20%</p>
          <p className="text-xs text-gray-500">$99/mo → <span className="font-semibold text-green-700">$79/mo</span> billed annually ($948/yr)</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setLayer(3)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Switch to Annual</button>
            <button onClick={() => setLayer(3)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">No thanks, continue</button>
            <button onClick={closeAll} className="text-sm text-gray-400 hover:text-gray-600">Keep my subscription</button>
          </div>
        </div>
      )}

      {/* Layer 3: $69 downgrade (existing) */}
      {layer === 3 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">Before you go... keep your AI receptionist for just $69/mo — first year only. Then $99/mo. Cancel anytime.</p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <ul className="space-y-1 text-xs text-gray-600">
              <li className="flex items-center gap-2"><span className="text-green-500">✅</span> $69/mo for your first year</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✅</span> Keep all your current features</li>
              <li className="flex items-center gap-2"><span className="text-amber-500">⚠️</span> After 12 months: $99/mo automatically</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✅</span> Cancel anytime — no contract</li>
            </ul>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
              <span className="text-xs text-gray-600">I understand this is $69/mo for the first year only, then $99/mo</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleDowngrade} disabled={!confirmed || downgrading} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {downgrading ? "Changing plan..." : "Confirm Downgrade"}
              </button>
              <button onClick={() => setLayer(4)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">No thanks</button>
              <button onClick={closeAll} className="text-sm text-gray-400 hover:text-gray-600">Keep my subscription</button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </div>
      )}

      {/* Layer 4: Exit Survey */}
      {layer === 4 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">We're sorry to see you go. What could we improve?</p>
          <div className="space-y-2">
            {["Too expensive", "Missing features", "Not using it enough", "Switching to competitor", "Other"].map((opt) => (
              <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${surveyAnswer === opt ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                <input type="radio" name="survey" checked={surveyAnswer === opt} onChange={() => setSurveyAnswer(opt)} className="sr-only" />
                {opt}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setDone("cancelled")} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Submit & Cancel</button>
            <button onClick={closeAll} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Keep My Subscription</button>
          </div>
          {surveyAnswer && <p className="text-xs text-gray-400">Thank you. Your feedback helps us improve.</p>}
        </div>
      )}
    </div>
  );
}
