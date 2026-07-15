import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/conversations")({
  component: ConversationsPage,
});

type Conversation = {
  id: string;
  customerName: string;
  customerInitials: string;
  channel: "call" | "sms" | "chat" | "whatsapp";
  summary: string;
  status: "completed" | "active" | "transferred" | "missed";
  duration: string;
  timestamp: string;
  date: string;
};

const conversations: Conversation[] = [
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
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = conversations.filter((c) => {
    const matchesSearch = c.customerName.toLowerCase().includes(search.toLowerCase()) || c.summary.toLowerCase().includes(search.toLowerCase());
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

      {/* Filters */}
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

      {/* Table */}
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
                        <p className="text-xs text-gray-400">{conv.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-lg">{channelIcons[conv.channel]}</td>
                  <td className="max-w-xs truncate px-5 py-4 text-sm text-gray-600">{conv.summary}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[conv.status]}`}>
                      {conv.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">{conv.duration}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">{conv.timestamp}</td>
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
    </div>
  );
}