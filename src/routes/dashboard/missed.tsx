import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useMissedCalls,
  updateMissedCallCallback,
  type MissedCallItem,
} from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/missed")({
  component: MissedCallsPage,
});

type Filter = "all" | "callback" | "no-callback";

function formatRingDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatWhen(iso: string | null): { relative: string; absolute: string } {
  if (!iso) return { relative: "Time not recorded", absolute: "—" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { relative: "Time not recorded", absolute: "—" };
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  let relative: string;
  if (mins < 1) relative = "Just now";
  else if (mins < 60) relative = `${mins} minute${mins === 1 ? "" : "s"} ago`;
  else if (mins < 60 * 24) {
    const h = Math.round(mins / 60);
    relative = `${h} hour${h === 1 ? "" : "s"} ago`;
  } else {
    const days = Math.round(mins / (60 * 24));
    relative = `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return { relative, absolute: d.toLocaleString() };
}

function initialsFor(call: MissedCallItem): string {
  const name = (call.callerName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
  }
  const digits = (call.callerNumber || "").replace(/\D/g, "");
  return digits ? digits.slice(-2) : "?";
}

function telHref(call: MissedCallItem): string | null {
  const raw = (call.callerNumber || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

function MissedCallsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, refetch } = useMissedCalls();

  const missedCalls: MissedCallItem[] = data?.missedCalls ?? [];

  const filtered = useMemo(() => {
    if (filter === "callback") return missedCalls.filter((c) => c.callbackRequested);
    if (filter === "no-callback") return missedCalls.filter((c) => !c.callbackRequested);
    return missedCalls;
  }, [missedCalls, filter]);

  const callbackRequestedCount = missedCalls.filter((c) => c.callbackRequested).length;
  const calledBackCount = missedCalls.filter(
    (c) => c.callbackStatus === "contacted" || c.callbackStatus === "resolved"
  ).length;

  async function toggleCallback(call: MissedCallItem) {
    const alreadyCalledBack =
      call.callbackStatus === "contacted" || call.callbackStatus === "resolved";
    const next = alreadyCalledBack ? "pending" : "contacted";
    setActionError(null);
    setSavingId(call.id);
    try {
      await updateMissedCallCallback(call.id, next);
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update this missed call.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Missed Calls</h1>
          <p className="mt-1 text-sm text-gray-500">
            Calls that came in and ended before the caller engaged, plus anyone who asked for a callback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            aria-label="Filter missed calls"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Missed Calls</option>
            <option value="callback">Callback Requested</option>
            <option value="no-callback">No Callback Requested</option>
          </select>
          <button
            onClick={refetch}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards — counts of the rows actually in the table */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Missed</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? "—" : missedCalls.length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Callback Requested</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? "—" : callbackRequestedCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Called Back</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {loading ? "—" : calledBackCount}
          </p>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Loading / error / list */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">Loading missed calls…</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-red-700">Couldn't load missed calls</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <p className="mt-1 text-xs text-red-500">
            This is a loading problem, not an empty list — nothing here says whether calls came in.
          </p>
          <button
            onClick={refetch}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      ) : missedCalls.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-700">No missed calls recorded yet</p>
          <p className="mt-1 text-sm text-gray-500">
            When a call comes in and the caller hangs up before engaging, it will appear here with
            the time it rang and whether a callback was requested.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((call) => {
            const when = formatWhen(call.createdAt);
            const tel = telHref(call);
            const calledBack =
              call.callbackStatus === "contacted" || call.callbackStatus === "resolved";
            return (
              <div
                key={call.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-600">
                      {initialsFor(call)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {call.callerName && call.callerName.trim()
                            ? call.callerName
                            : "Unknown Caller"}
                        </p>
                        {call.callbackRequested && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Callback requested
                          </span>
                        )}
                        {calledBack && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Called back
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {call.callerNumber || "Number not recorded"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span>{when.relative}</span>
                        <span>·</span>
                        <span>{when.absolute}</span>
                        <span>·</span>
                        <span>Rang {formatRingDuration(call.ringDurationSeconds)}</span>
                      </div>
                      <div className="mt-3 rounded-lg bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-500">Voicemail</p>
                        {call.voicemailTranscription ? (
                          <p className="mt-1 text-sm text-gray-700 italic">
                            “{call.voicemailTranscription}”
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-gray-500">
                            Not available — voicemail recording and transcription aren't captured
                            yet.
                          </p>
                        )}
                        {call.voicemailUrl && (
                          <a
                            href={call.voicemailUrl}
                            className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            Play recording
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => toggleCallback(call)}
                      disabled={savingId === call.id}
                      aria-pressed={calledBack}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                        calledBack
                          ? "bg-green-100 text-green-700"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {savingId === call.id
                        ? "Saving…"
                        : calledBack
                          ? "✓ Called Back"
                          : "Mark as Called"}
                    </button>
                    {tel ? (
                      <a
                        href={tel}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        📞 Call Now
                      </a>
                    ) : (
                      <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400">
                        No number
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <p className="text-sm text-gray-500">No missed calls match your filter.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
