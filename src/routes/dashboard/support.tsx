import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "~/lib/api-client";

export const Route = createFileRoute("/dashboard/support")({
  component: SupportPage,
});

const CATEGORIES = [
  { value: "calls", label: "Calls — the AI did something wrong on a call" },
  { value: "booking", label: "Booking or calendar" },
  { value: "billing", label: "Billing or my plan" },
  { value: "login", label: "Logging in or my account" },
  { value: "other", label: "Something else" },
];

const SEVERITIES = [
  { value: "blocking", label: "Blocking — I can't take calls right now" },
  { value: "normal", label: "Normal — it's a problem, but not urgent" },
  { value: "question", label: "Question — I want to understand something" },
];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  team_replied: "bg-blue-50 text-blue-700 border-blue-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  team_replied: "Team replied",
  resolved: "Resolved",
  closed: "Closed",
};

type Ticket = {
  id: string;
  shortId: string;
  category: string;
  severity: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string | null;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "Time not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Time not recorded";
  return d.toLocaleString();
}

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label.split(" — ")[0] ?? value;
}

function SupportPage() {
  const [category, setCategory] = useState("calls");
  const [severity, setSeverity] = useState("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // The page the customer was on when they hit the problem — captured client-side, sent with
  // the ticket so the team knows where to look.
  const [page, setPage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ shortId: string } | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setPage(window.location.pathname);
  }, []);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    setTicketsError(null);
    try {
      const data = await apiFetch<{ tickets: Ticket[] }>("/api/support/tickets");
      setTickets(data.tickets ?? []);
    } catch (err) {
      setTicketsError(err instanceof ApiError ? err.message : "Could not load your reports");
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch<{ ticket: { shortId: string } }>("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, severity, subject, message, page }),
      });
      setSent({ shortId: data.ticket?.shortId || "" });
      setSubject("");
      setMessage("");
      await loadTickets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Help &amp; support</h1>
        <p className="mt-1 text-sm text-gray-600">
          Tell us what went wrong. We attach this business's recent calls, reminder calls and
          transfers to your report, so you don't have to describe them.
        </p>
      </div>

      {sent ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-900">Received. Our team will reply by email.</p>
          <p className="mt-1 text-sm text-emerald-800">
            Your report id is <span className="font-mono">#{sent.shortId}</span>. A copy is in your inbox.
          </p>
          <button
            type="button"
            onClick={() => setSent(null)}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Report another problem
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Report a problem</h2>

          <div>
            <label htmlFor="ticket-category" className="block text-sm font-medium text-gray-700">
              What is it about?
            </label>
            <select
              id="ticket-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ticket-severity" className="block text-sm font-medium text-gray-700">
              How urgent is it?
            </label>
            <select
              id="ticket-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ticket-subject" className="block text-sm font-medium text-gray-700">
              Subject
            </label>
            <input
              id="ticket-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder="A booking landed on the wrong day"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">3 to 120 characters.</p>
          </div>

          <div>
            <label htmlFor="ticket-message" className="block text-sm font-medium text-gray-700">
              What happened?
            </label>
            <textarea
              id="ticket-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Include the phone number or time of the call if you have it."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">10 to 4000 characters.</p>
          </div>

          {/* Hidden: the page the customer was on, captured client-side. */}
          <input type="hidden" name="page" value={page} readOnly />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send to the team"}
          </button>
        </form>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Your reports</h2>
        </div>
        {loadingTickets ? (
          <p className="px-5 py-6 text-sm text-gray-500">Loading…</p>
        ) : ticketsError ? (
          <p className="px-5 py-6 text-sm text-red-600">{ticketsError}</p>
        ) : tickets.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">You haven't reported anything yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tickets.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    #{t.shortId} · {categoryLabel(t.category)} · {formatWhen(t.createdAt)}
                  </p>
                </div>
                <span
                  className={
                    "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                    (STATUS_STYLES[t.status] || STATUS_STYLES.open)
                  }
                >
                  {STATUS_LABELS[t.status] || t.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
