import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

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
            <a
              href="https://billing.stripe.com/p/login/test"
              target="_blank"
              rel="noopener noreferrer"
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
            </a>
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
      </div>
    </div>
  );
}
