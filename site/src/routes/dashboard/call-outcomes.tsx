import { createFileRoute } from "@tanstack/react-router";
import { useCallOutcomes } from "~/lib/hooks/use-data";
import {
  normalizeCallOutcomes,
  type ReminderCallItem,
  type TransferItem,
} from "~/lib/call-outcomes";

export const Route = createFileRoute("/dashboard/call-outcomes")({
  component: CallOutcomesPage,
});

// ─── Formatting helpers ───────────────────────────────────────────────────
// Everything shown here is a stored timestamp or a stored result. Nothing is derived,
// estimated or invented: an unrecorded time renders as an em dash, not as "just now".

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPhone(raw: string | null): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

// ─── Result badges ────────────────────────────────────────────────────────
// green = it worked · amber = it happened but needs the owner's attention ·
// red = it did not work · grey = nothing was attempted / no decision was taken.

const BADGE_STYLES: Record<string, string> = {
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  grey: "bg-gray-100 text-gray-600",
  blue: "bg-indigo-100 text-indigo-700",
};

const REMINDER_TONE: Record<string, { label: string; tone: keyof typeof BADGE_STYLES }> = {
  confirmed: { label: "Confirmed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "amber" },
  no_answer: { label: "No answer", tone: "amber" },
  transfer: { label: "Asked for the office", tone: "blue" },
  optout: { label: "Opted out", tone: "grey" },
  skipped: { label: "Skipped", tone: "grey" },
  failed: { label: "Failed", tone: "red" },
  dialed: { label: "Dialled — no answer yet", tone: "grey" },
};

const TRANSFER_TONE: Record<string, { label: string; tone: keyof typeof BADGE_STYLES }> = {
  bridged: { label: "Bridged", tone: "green" },
  missed: { label: "Missed — owner didn't answer", tone: "amber" },
  failed: { label: "Failed", tone: "red" },
  no_target: { label: "No transfer number", tone: "grey" },
};

function Badge({ label, tone }: { label: string; tone: keyof typeof BADGE_STYLES }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[tone]}`}>
      {label}
    </span>
  );
}

function Chip({ count, label }: { count: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
      <span className={`font-semibold ${count > 0 ? "text-gray-900" : "text-gray-400"}`}>{count}</span>
      {label}
    </span>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TableShell({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap py-2 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">{children}</tbody>
      </table>
    </div>
  );
}

function appointmentLabel(call: ReminderCallItem): string {
  const parts = [call.serviceType, call.appointmentTitle].filter(
    (p): p is string => !!p && p.trim() !== ""
  );
  return parts.length ? parts.join(" — ") : "—";
}

function CallOutcomesPage() {
  const { data, loading, error, refetch } = useCallOutcomes(50);
  const view = data ? normalizeCallOutcomes(data) : null;

  const reminderCalls = view?.reminderCalls ?? [];
  const transfers = view?.transfers ?? [];
  const reminderSummary = view?.reminderSummary;
  const transferSummary = view?.transferSummary;
  const coversNote = view
    ? `Counts cover the ${view.limit} most recent rows shown below — not all time.`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call outcomes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Reminder calls and transfers — real data only. Every row is a call this system
            actually made or attempted for your business.
          </p>
        </div>
        <button
          onClick={refetch}
          className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">Loading call outcomes…</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-red-700">Couldn't load call outcomes</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <p className="mt-1 text-xs text-red-500">
            This is a loading problem, not an empty list — nothing here says whether any call
            happened.
          </p>
          <button
            onClick={refetch}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* ── Reminder calls ─────────────────────────────────────────── */}
          <SectionCard
            title="Reminder calls"
            description="The AI rings the customer 24 hours before an appointment booked with a phone number, from your business line, between 9am and 8pm your time."
          >
            {reminderSummary && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Chip count={reminderSummary.dialed} label="dialled" />
                <Chip count={reminderSummary.confirmed} label="confirmed" />
                <Chip count={reminderSummary.cancelled} label="cancelled" />
                <Chip count={reminderSummary.transfer} label="transfer" />
                <Chip count={reminderSummary.optout} label="opt out" />
                <Chip count={reminderSummary.no_answer} label="no answer" />
                <Chip count={reminderSummary.failed} label="failed" />
                <Chip count={reminderSummary.skipped} label="skipped" />
              </div>
            )}

            {reminderCalls.length === 0 ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-8 text-center">
                <p className="text-sm font-semibold text-gray-700">No reminder calls yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  One is queued for every booking made with a phone number, 24 hours before the
                  appointment.
                </p>
              </div>
            ) : (
              <>
                <TableShell head={["When", "Customer", "Phone", "Appointment", "Result"]}>
                  {reminderCalls.map((call) => {
                    const tone = call.result ? REMINDER_TONE[call.result] : undefined;
                    return (
                      <tr key={call.id} className="align-top">
                        <td className="whitespace-nowrap py-3 pr-4 text-gray-600">
                          {formatWhen(call.scheduledAt)}
                          {call.appointmentStart && (
                            <p className="text-xs text-gray-400">
                              appt {formatWhen(call.appointmentStart)}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-900">
                          {call.contactName || "Name not recorded"}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-gray-600">
                          {formatPhone(call.recipientPhone)}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{appointmentLabel(call)}</td>
                        <td className="py-3 pr-4">
                          <Badge
                            label={tone ? tone.label : "Queued — not called yet"}
                            tone={tone ? tone.tone : "grey"}
                          />
                          {call.error && (
                            <p className="mt-1 max-w-[22rem] text-xs text-gray-500">{call.error}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </TableShell>
                <p className="mt-3 text-xs text-gray-400">{coversNote}</p>
              </>
            )}
          </SectionCard>

          {/* ── Transfers ──────────────────────────────────────────────── */}
          <SectionCard
            title="Transfers"
            description="When a caller asks for a person, the system dials your transfer number from the business line and connects the two."
          >
            {transferSummary && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Chip count={transferSummary.bridged} label="bridged" />
                <Chip count={transferSummary.missed} label="missed" />
                <Chip count={transferSummary.failed} label="failed" />
                <Chip count={transferSummary.no_target} label="no target" />
              </div>
            )}

            {view?.transferReadError ? (
              <div
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
              >
                <p className="font-semibold">Transfers couldn't be read</p>
                <p className="mt-1">
                  The stored transfer records are unavailable, so this list is empty for that
                  reason and not because no transfer happened.
                </p>
                <p className="mt-1 text-xs text-amber-700">{view.transferReadError}</p>
              </div>
            ) : transfers.length === 0 ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-8 text-center">
                <p className="text-sm font-semibold text-gray-700">No transfers yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  When a caller asks for a person and the call is dialled to your number, it
                  appears here with what happened.
                </p>
              </div>
            ) : (
              <>
                <TableShell head={["When", "Caller", "Rang", "Outcome", "From"]}>
                  {transfers.map((t: TransferItem) => {
                    const tone = TRANSFER_TONE[t.outcome];
                    return (
                      <tr key={t.id} className="align-top">
                        <td className="whitespace-nowrap py-3 pr-4 text-gray-600">
                          {formatWhen(t.createdAt)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-gray-900">
                          {formatPhone(t.callerNumber)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-gray-600">
                          {formatPhone(t.targetNumber)}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            label={tone ? tone.label : t.outcome || "—"}
                            tone={tone ? tone.tone : "grey"}
                          />
                          {t.language === "es" && (
                            <p className="mt-1 text-xs text-gray-400">Spanish caller</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-gray-600">
                          {t.source === "reminder_call" ? "Reminder call" : "Inbound call"}
                        </td>
                      </tr>
                    );
                  })}
                </TableShell>
                <p className="mt-3 text-xs text-gray-400">
                  {coversNote} A transfer is recorded only when the system attempted one; if the
                  record could not be stored, the call itself still went through.
                </p>
              </>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
