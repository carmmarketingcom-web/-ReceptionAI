import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useConversations, type ConversationItem } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/conversations")({
  component: ConversationsPage,
});

// Mock fallback data — used when API returns empty (demo mode)
const mockConversations: ConversationItem[] = [
  { id: "C-1001", customerName: "Maria Garcia", customerInitials: "MG", channel: "call", summary: "Booked AC repair appointment for tomorrow 2pm", status: "completed", duration: "3m 42s", timestamp: "2 min ago", date: "Today" },
  { id: "C-1002", customerName: "John Smith", customerInitials: "JS", channel: "chat", summary: "Asked about pricing - Growth plan interest", status: "active", duration: "8m 15s", timestamp: "15 min ago", date: "Today" },
  { id: "C-1003", customerName: "Robert Chen", customerInitials: "RC", channel: "sms", summary: "Rescheduled appointment to Friday 10am", status: "completed", duration: "1m 05s", timestamp: "32 min ago", date: "Today" },
  { id: "C-1004", customerName: "Sarah Johnson", customerInitials: "SJ", channel: "call", summary: "Transferred to technician - complex electrical issue", status: "transferred", duration: "5m 20s", timestamp: "1 hour ago", date: "Today" },
  { id: "C-1005", customerName: "Carlos Mendez", customerInitials: "CM", channel: "call", summary: "Missed - voicemail left (Spanish)", status: "missed", duration: "0m 30s", timestamp: "2 hours ago", date: "Today" },
  { id: "C-1006", customerName: "Emily Davis", customerInitials: "ED", channel: "whatsapp", summary: "Requested quote for plumbing service", status: "active", duration: "4m 10s", timestamp: "3 hours ago", date: "Today" },
  { id: "C-1007", customerName: "James Wilson", customerInitials: "JW", channel: "call", summary: "Booked electrical inspection for Monday", status: "completed", duration: "2m 55s", timestamp: "4 hours ago", date: "Today" },
  { id: "C-1008", customerName: "Lisa Park", customerInitials: "LP", channel: "chat", summary: "Dental cleaning appointment confirmed", status: "completed", duration: "6m 30s", timestamp: "5 hours ago", date: "Today" },
  { id: "C-1009", customerName: "David Brown", customerInitials: "DB", channel: "call", summary: "Inquired about emergency HVAC service", status: "transferred", duration: "4m 15s", timestamp: "Yesterday", date: "Yesterday" },
  { id: "C-1010", customerName: "Ana Rodriguez", customerInitials: "AR", channel: "sms", summary: "Confirmed vet appointment for pet checkup", status: "completed", duration: "0m 45s", timestamp: "Yesterday", date: "Yesterday" },
];

function mapApiConversation(c: ConversationItem): ConversationItem {
  return {
    ...c,
    id: c.id,
    customerName: c.customerName || c.customerPhone || "Unknown",
    customerInitials: c.customerInitials || (c.customerName
      ? c.customerName.split(" ").map((n: string) => n[0]).join("").toUpperCase()
      : "??"),
    channel: c.channel || "call",
    summary: c.summary || "No summary available",
    status: c.status || "completed",
    duration: c.duration || "-",
    timestamp: c.timestamp || c.date || "-",
  };
}

const channelIcons: Record<string, string> = {
  call: "📞",
  sms: "✉️",
  chat: "💬",
  whatsapp: "💚",
};

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  active: "bg-blue-100 text-blue-700",
  transferred: "bg-amber-100 text-amber-700",
  missed: "bg-red-100 text-red-700",
};

const channelOptions = ["all", "call", "sms", "chat", "whatsapp"];
const statusOptions = ["all", "completed", "active", "transferred", "missed"];

function ConversationsPage() {
  const { data, loading, error, refetch } = useConversations(50, 0);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Use live data if available, otherwise fall back to mock
  const conversations: ConversationItem[] = (() => {
    if (data?.conversations && data.conversations.length > 0) {
      return data.conversations.map(mapApiConversation);
    }
    if (!loading && !error) {
      return mockConversations;
    }
    return [];
  })();

  const filtered = conversations.filter((c) => {
    const name = c.customerName || "";
    const summary = c.summary || "";
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || summary.toLowerCase().includes(search.toLowerCase());
    const matchesChannel = channelFilter === "all" || c.channel === channelFilter;
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesChannel && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
        <p className="mt-1 text-sm text-gray-500">All customer interactions across every channel.</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Could not load conversations from the server. Showing demo data.</span>
          <button onClick={refetch} className="font-medium underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Loading state */}
      {loading && conversations.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm text-gray-500">Loading conversations...</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {channelOptions.map((opt) => (
              <option key={opt} value={opt}>{opt === "all" ? "All Channels" : opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>{opt === "all" ? "All Status" : opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Channel</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Summary</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Duration</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Time</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((conv) => (
                  <tr key={conv.id} className="transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                          {conv.customerInitials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{conv.customerName}</p>
                          <p className="text-xs text-gray-400">{conv.customerPhone || conv.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-lg">{channelIcons[conv.channel || "call"]}</td>
                    <td className="max-w-xs truncate px-5 py-4 text-sm text-gray-600">{conv.summary}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[conv.status || "completed"]}`}>
                        {conv.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">{conv.duration || "-"}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">{conv.timestamp || "-"}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <Link
                        to="/dashboard/conversations/$id"
                        params={{ id: conv.id }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-500">
                      No conversations match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state for no data at all */}
      {!loading && conversations.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
          <svg className="mb-4 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">No conversations yet</h3>
          <p className="mt-1 text-sm text-gray-500">Customer interactions will appear here once calls start coming in.</p>
        </div>
      )}
    </div>
  );
}
