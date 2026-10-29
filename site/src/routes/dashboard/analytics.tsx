import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAnalytics, type AnalyticsResponse } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/analytics")({
  component: AnalyticsPage,
});

/**
 * Analytics — real data only.
 *
 * Every number on this page is a COUNT over rows this organization actually has
 * (calls in `conversations`, rows in `missed_calls`, rows in `appointments`),
 * returned by GET /api/analytics for the selected range. There are no sample
 * arrays and no estimates: an empty range shows an empty state, and metrics the
 * schema cannot answer are listed under "In progress" instead of being invented.
 */

type Days = 7 | 30 | 90;

const CHANNEL_LABELS: Record<string, string> = {
  call: "Phone calls",
  sms: "SMS",
  web_chat: "Web chat",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
};

const STATUS_LABELS: Record<string, string> = {
  ended: "Completed",
  transferred: "Transferred to owner",
  voicemail: "Voicemail",
  missed: "Missed",
  active: "In progress",
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
};

const OUTCOME_LABELS: Record<string, string> = {
  "Appointment booked": "Appointment booked",
  "Requested owner callback": "Requested owner callback",
  "Appointment interest": "Appointment interest",
  "General inquiry": "General inquiry",
};

/** Metrics that genuinely cannot be computed from the current schema. */
const IN_PROGRESS: { title: string; note: string }[] = [
  {
    title: "Customer satisfaction",
    note: "We don't ask callers to rate a call and there is no sentiment scoring in place, so there is no score to show.",
  },
  {
    title: "Per-staff performance",
    note: "Calls aren't assigned to a staff member yet, so any per-agent number would be invented.",
  },
  {
    title: "Revenue recovered",
    note: "No booking value is stored on appointments, so revenue attribution can't be calculated.",
  },
  {
    title: "Wait and handle times",
    note: "Only call start and end are recorded — hold times and response times aren't captured.",
  },
  {
    title: "Exportable reports",
    note: "CSV/PDF export isn't built yet. This page is the report for now.",
  },
];

function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function dayLabel(value: string, days: Days): string {
  const date = parseDay(value);
  if (days <= 7) {
    return date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  }
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" });
}

function hourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function StatCard({
  label,
  value,
  hint,
  tone = "gray",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "gray" | "green" | "red" | "indigo";
}) {
  const valueTone =
    tone === "green"
      ? "text-green-600"
      : tone === "red"
        ? "text-red-600"
        : tone === "indigo"
          ? "text-indigo-600"
          : "text-gray-900";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function BreakdownCard({
  title,
  subtitle,
  rows,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  rows: { label: string; count: number }[];
  emptyMessage: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{row.label}</span>
                <span className="font-medium text-gray-900">{row.count.toLocaleString()}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsPage() {
  const [days, setDays] = useState<Days>(7);
  const { data, loading, error, refetch } = useAnalytics(days);

  const analytics: AnalyticsResponse | null = data;
  const hasData = analytics?.hasData === true;

  const rangeLabel = `last ${days} days`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Counted from your own call, missed-call and appointment records — nothing here is
            estimated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as Days)}
            aria-label="Select date range"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={refetch}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Loading / error / data */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">Loading analytics…</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-red-700">Couldn't load analytics</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <p className="mt-1 text-xs text-red-500">
            This is a loading problem, not an empty range — nothing here says whether calls came in.
          </p>
          <button
            onClick={refetch}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      ) : !analytics ? (
        <EmptyCard message="No analytics available yet." />
      ) : !hasData ? (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-sm font-semibold text-gray-700">
              No calls yet — your call activity will appear here as calls come in.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Nothing has been recorded for the {rangeLabel}. Once your number takes a call, this
              page fills in on its own.
            </p>
          </div>
          <InProgressSection />
        </>
      ) : (
        <>
          {/* KPI cards — counts over real rows */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Calls"
              value={analytics.calls.total.toLocaleString()}
              hint={`in the ${rangeLabel}`}
            />
            <StatCard
              label="Answered"
              value={analytics.calls.answered.toLocaleString()}
              hint={
                analytics.calls.answerRate === null
                  ? "no calls to rate yet"
                  : `${analytics.calls.answerRate}% of calls`
              }
              tone="green"
            />
            <StatCard
              label="Missed"
              value={analytics.calls.missed.toLocaleString()}
              hint={`${analytics.missedCalls.total.toLocaleString()} missed-call record${analytics.missedCalls.total === 1 ? "" : "s"}`}
              tone={analytics.calls.missed > 0 ? "red" : "gray"}
            />
            <StatCard
              label="Appointments Booked"
              value={analytics.appointments.total.toLocaleString()}
              hint={
                analytics.appointments.fromCalls > 0
                  ? `${analytics.appointments.fromCalls} from a call`
                  : "created in this range"
              }
              tone="indigo"
            />
          </div>

          {/* Call volume by day — real buckets in your organization's timezone */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Call Volume</h2>
              <p className="text-xs text-gray-500">
                Calls per day ({analytics.range.timezone.replace(/_/g, " ")})
              </p>
            </div>
            <div className="mt-4 flex items-end gap-1" style={{ height: "160px" }}>
              {analytics.callsByDay.map((d, index) => {
                const maxCalls = Math.max(...analytics.callsByDay.map((x) => x.calls), 1);
                const answeredHeight = (d.answered / maxCalls) * 110;
                const missedHeight = (d.missed / maxCalls) * 110;
                const showLabel = days <= 7 || index % 7 === 0;
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                    {d.calls > 0 && <span className="text-[10px] text-gray-500">{d.calls}</span>}
                    <div className="flex w-full flex-col justify-end gap-0.5">
                      <div
                        className="w-full rounded-t bg-indigo-500"
                        style={{ height: `${answeredHeight}px` }}
                        title={`${d.answered} answered`}
                      />
                      <div
                        className="w-full rounded-t bg-indigo-200"
                        style={{ height: `${missedHeight}px` }}
                        title={`${d.missed} missed`}
                      />
                    </div>
                    <span className="mt-1 h-3 text-[10px] text-gray-400">
                      {showLabel ? dayLabel(d.date, days) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-indigo-500" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-indigo-200" />
                <span>Missed</span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Outcomes recorded by the voice pipeline when a call ends */}
            <BreakdownCard
              title="Call Outcomes"
              subtitle="What the AI receptionist recorded at the end of each call"
              rows={analytics.outcomes.map((o) => ({
                label: OUTCOME_LABELS[o.outcome] || o.outcome,
                count: o.count,
              }))}
              emptyMessage="No outcomes recorded in this range yet. Outcomes are written when a call ends, so older calls may predate them."
            />

            {/* How calls ended */}
            <BreakdownCard
              title="How Calls Ended"
              subtitle="Call status recorded by the phone system"
              rows={analytics.statuses.map((s) => ({
                label: STATUS_LABELS[s.status] || s.status,
                count: s.count,
              }))}
              emptyMessage="No calls recorded in this range."
            />

            {/* Busiest hours, real start times in the org timezone */}
            <BreakdownCard
              title="Busiest Hours"
              subtitle="Call start time, your organization's timezone"
              rows={[...analytics.callsByHour]
                .filter((h) => h.count > 0)
                .sort((a, b) => b.count - a.count || a.hour - b.hour)
                .slice(0, 8)
                .map((h) => ({ label: hourLabel(h.hour), count: h.count }))}
              emptyMessage="No call start times recorded in this range."
            />

            {/* Channel + language — both real conversation columns/metadata */}
            <BreakdownCard
              title="By Channel"
              subtitle="Every conversation in this range, by channel"
              rows={analytics.channels.map((c) => ({
                label: CHANNEL_LABELS[c.channel] || c.channel,
                count: c.count,
              }))}
              emptyMessage="No conversations recorded in this range."
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <BreakdownCard
              title="Caller Language"
              subtitle="Language the caller chose"
              rows={analytics.languages.map((l) => ({
                label: LANGUAGE_LABELS[l.language] || l.language,
                count: l.count,
              }))}
              emptyMessage="No caller language recorded in this range."
            />

            {/* Missed calls + appointments — the two tables with their own rows */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Missed Calls &amp; Bookings</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Missed-call records and appointments created in this range
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-600">Missed-call records</dt>
                  <dd className="font-medium text-gray-900">
                    {analytics.missedCalls.total.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-600">Callback requested</dt>
                  <dd className="font-medium text-gray-900">
                    {analytics.missedCalls.callbackRequested.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-600">Called back</dt>
                  <dd className="font-medium text-green-600">
                    {analytics.missedCalls.calledBack.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <dt className="text-gray-600">Appointments booked</dt>
                  <dd className="font-medium text-gray-900">
                    {analytics.appointments.total.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-600">Upcoming appointments</dt>
                  <dd className="font-medium text-gray-900">
                    {analytics.appointments.upcoming.toLocaleString()}
                  </dd>
                </div>
              </dl>
              {analytics.appointments.byStatus.length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  By status:{" "}
                  {analytics.appointments.byStatus
                    .map((s) => `${s.status.replace(/_/g, " ")} ${s.count}`)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>

          <InProgressSection />

          <p className="text-center text-xs text-gray-400">
            Every figure above is counted from your organization's own records for the{" "}
            {rangeLabel} ({analytics.range.timezone.replace(/_/g, " ")}). Nothing is estimated.
          </p>
        </>
      )}
    </div>
  );
}

function InProgressSection() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Not available yet</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          In progress
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        These metrics aren't in the product yet. They're listed here so you know what's missing
        instead of seeing a number that isn't real.
      </p>
      <ul className="mt-4 space-y-3">
        {IN_PROGRESS.map((item) => (
          <li key={item.title} className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-800">{item.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{item.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
