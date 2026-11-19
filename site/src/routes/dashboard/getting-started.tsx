import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "~/lib/api-client";
import { useSettings } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/getting-started")({
  component: WhatHappensNextPage,
});

/**
 * The screen a customer lands on the moment their setup finishes — the four things that take
 * them from "paid" to "answering real customers". Every tick is read from the customer's own
 * account, never assumed: a step shows done only when the data behind it is there. The last
 * step is ours, not theirs, so it never ticks itself — it tells the truth about who confirms
 * go-live and gives them the way to reach us.
 */
interface CallCheck {
  hasCall: boolean;
  startedAt: string | null;
  durationSeconds: number | null;
  booked: number;
}

function WhatHappensNextPage() {
  const { data, loading } = useSettings();
  const [call, setCall] = useState<CallCheck | null>(null);

  useEffect(() => {
    api
      .get<CallCheck>("/api/test-call-check")
      .then(setCall)
      .catch(() => setCall(null));
  }, []);

  const org = data?.organization as
    | { name?: string; industry?: string; phone?: string | null; transferNumber?: string | null }
    | undefined;

  const businessTypeSet = !!org?.industry && org.industry.trim().length > 0;
  const hasCall = call?.hasCall === true;
  const transferSet = !!(
    data?.transferNumber ||
    org?.transferNumber ||
    (org?.phone && org.phone.trim())
  );

  const steps = [
    {
      num: 1,
      title: "Tell us about your business",
      body: "Name, type, hours and services — about five minutes in Setup. The business type tells the AI what your customers usually call about.",
      done: businessTypeSet,
      to: "/setup",
      linkText: "Open Setup →",
    },
    {
      num: 2,
      title: "Test your line",
      body: "Call it, book something, and see the appointment on Schedule. That is the same path a real customer takes.",
      done: hasCall,
      to: "/getting-started",
      linkText: "Test it yourself →",
    },
    {
      num: 3,
      title: "Add your team's transfer number",
      body: "Where a caller goes when they press 3. Until you set it, press 3 falls back to the mobile number on your account.",
      done: transferSet,
      to: "/dashboard/settings",
      linkText: "Add it in Settings →",
    },
    {
      num: 4,
      title: "Go live",
      body: "We confirm everything with you before you point customers at it. Message us when steps 1–3 are done and we take it from there.",
      done: false,
      to: "/dashboard/support",
      linkText: "Message us →",
      ours: true,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">What happens next</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Your payment went through. These are the four things that take you from here to
          answering real customers — the first three are yours, the last one is ours.
        </p>
        {!loading && (
          <p className="mt-3 text-sm font-medium text-gray-700">
            {doneCount} of 3 steps done.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {steps.map((s) => (
          <div
            key={s.num}
            className={`rounded-2xl border bg-white p-6 shadow-sm ${
              s.done ? "border-green-200" : "border-gray-100"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  s.done ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {s.done ? "✓" : s.num}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">{s.title}</h2>
                  {s.ours && (
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                      Our step
                    </span>
                  )}
                  {s.done && (
                    <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                      Done
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{s.body}</p>
                <Link
                  to={s.to}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {s.linkText}
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          to="/dashboard"
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
        >
          Go to dashboard
        </Link>
        <Link to="/faq" className="text-sm font-medium text-gray-500 hover:text-gray-700">
          Questions? Read the FAQ
        </Link>
      </div>
    </div>
  );
}
