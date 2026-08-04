import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/missed")({
  component: MissedCallsPage,
});

type MissedCall = {
  id: string;
  callerName: string;
  callerInitials: string;
  phone: string;
  timestamp: string;
  date: string;
  duration: string;
  voicemail: boolean;
  voicemailTranscript?: string;
  calledBack: boolean;
};

const missedCalls: MissedCall[] = [
  { id: "MC-001", callerName: "Unknown", callerInitials: "?", phone: "(555) 111-2233", timestamp: "2 hours ago", date: "Today", duration: "0m 22s", voicemail: true, voicemailTranscript: "Hi, this is Mark. I need someone to look at my water heater. It's leaking. Please call me back.", calledBack: false },
  { id: "MC-002", callerName: "Patricia Miller", callerInitials: "PM", phone: "(555) 222-3344", timestamp: "4 hours ago", date: "Today", duration: "0m 45s", voicemail: true, voicemailTranscript: "Hello, I'm interested in getting a quote for electrical work in my new home. Can you call me back?", calledBack: false },
  { id: "MC-003", callerName: "Unknown", callerInitials: "?", phone: "(555) 333-4455", timestamp: "Yesterday", date: "Yesterday", duration: "0m 08s", voicemail: false, calledBack: false },
  { id: "MC-004", callerName: "George Thompson", callerInitials: "GT", phone: "(555) 444-5566", timestamp: "Yesterday", date: "Yesterday", duration: "1m 12s", voicemail: true, voicemailTranscript: "Hi, this is George from Oak Properties. We have a maintenance issue at one of our units. Please call me back at this number.", calledBack: true },
  { id: "MC-005", callerName: "Unknown", callerInitials: "?", phone: "(555) 555-6677", timestamp: "2 days ago", date: "2 days ago", duration: "0m 05s", voicemail: false, calledBack: false },
  { id: "MC-006", callerName: "Diana Adams", callerInitials: "DA", phone: "(555) 666-7788", timestamp: "3 days ago", date: "3 days ago", duration: "0m 35s", voicemail: true, voicemailTranscript: "Hi, I need to reschedule my appointment for next week. Can you call me back?", calledBack: true },
];

function MissedCallsPage() {
  const [filter, setFilter] = useState<"all" | "voicemail" | "no-voicemail">("all");
  const [marked, setMarked] = useState<Set<string>>(new Set(missedCalls.filter(c => c.calledBack).map(c => c.id)));

  const toggleCallback = (id: string) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = missedCalls.filter((c) => {
    if (filter === "voicemail") return c.voicemail;
    if (filter === "no-voicemail") return !c.voicemail;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Missed Calls</h1>
          <p className="mt-1 text-sm text-gray-500">Calls that weren't answered and need follow-up.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Missed Calls</option>
            <option value="voicemail">With Voicemail</option>
            <option value="no-voicemail">No Voicemail</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Missed</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{missedCalls.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">With Voicemail</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{missedCalls.filter(c => c.voicemail).length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Called Back</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{marked.size}</p>
        </div>
      </div>

      {/* Missed calls list */}
      <div className="space-y-3">
        {filtered.map((call) => (
          <div key={call.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Caller avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-600">
                  {call.callerInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {call.callerName === "Unknown" ? "Unknown Caller" : call.callerName}
                    </p>
                    {!call.voicemail && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">No voicemail</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">{call.phone}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span>{call.timestamp}</span>
                    <span>·</span>
                    <span>{call.duration}</span>
                  </div>
                  {call.voicemail && call.voicemailTranscript && (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-medium text-gray-500">Voicemail transcript:</p>
                      <p className="mt-1 text-sm text-gray-700 italic">"{call.voicemailTranscript}"</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleCallback(call.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    marked.has(call.id)
                      ? "bg-green-100 text-green-700"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {marked.has(call.id) ? "✓ Called Back" : "Mark as Called"}
                </button>
                <a
                  href={`tel:${call.phone}`}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  📞 Call Now
                </a>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-sm text-gray-500">No missed calls match your filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}