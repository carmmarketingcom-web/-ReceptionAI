import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useConversations, useAppointments, useSettings } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

function DashboardOverview() {
  const { data: conversationsData, loading: loadingConv } = useConversations(50, 0);
  const { data: appointmentsData, loading: loadingAppt } = useAppointments({ limit: 50 });
  const { data: settingsData } = useSettings();
  const [dismissedCards, setDismissedCards] = useState<string[]>([]);

  const loading = loadingConv || loadingAppt;
  const conversations = conversationsData?.conversations || [];
  const appointments = appointmentsData?.appointments || [];
  const hasRealData = conversations.length > 0 || appointments.length > 0;

  // Use real org phone from settings, fallback gracefully
  const phoneNumber = settingsData?.phoneNumbers?.[0]?.phoneNumber
    || settingsData?.organization?.phone
    || "";

  // Check if business hours have been customized (not default Mon-Fri 9-5)
  const defaultHours = settingsData?.businessHours?.every((h: any) => {
    const dayNum = parseInt(h.dayOfWeek, 10);
    if (dayNum >= 1 && dayNum <= 5) return h.openTime === "09:00" && h.closeTime === "17:00" && !h.isClosed;
    return !!h.isClosed; // Sat/Sun should be closed
  });
  const isSetupComplete = settingsData && !defaultHours;

  const today = new Date().toISOString().slice(0, 10);
  const todaysConvs = conversations.filter((c: any) => c.createdAt?.startsWith(today));
  const todaysAppts = appointments.filter((a: any) => a.createdAt?.startsWith(today) || a.startTime?.startsWith(today));

  const callsToday = todaysConvs.length;
  const answeredToday = todaysConvs.filter((c: any) => c.status !== "missed").length;
  const bookingsToday = todaysAppts.length;
  const answerRate = callsToday > 0 ? Math.round((answeredToday / callsToday) * 100) : 0;
  const bookingRate = answeredToday > 0 ? Math.round((bookingsToday / answeredToday) * 100) : 0;

  const recentActivity = conversations.slice(0, 5).map((c: any) => ({
    type: c.channel === "chat" ? "chat" : c.channel === "sms" ? "sms" : "call",
    name: c.customerName || c.customerPhone || "Unknown",
    summary: c.summary || "No summary",
    time: c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
    status: c.status || "completed",
  }));

  const upcomingAppointments = appointments.slice(0, 5).map((a: any) => ({
    name: a.title || a.serviceType || "Appointment",
    service: a.serviceType || a.title || "Service",
    time: a.startTime ? new Date(a.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
    status: a.status === "scheduled" ? "confirmed" : (a.status || "pending"),
  }));

  return (
    <div className="space-y-10">
      {/* ── Welcome Card ──────────────────────────────────────── */}
      {!dismissedCards.includes("welcome") && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-10 shadow-sm ring-1 ring-gray-100">
          <button
            onClick={() => setDismissedCards((d) => [...d, "welcome"])}
            className="absolute right-4 top-4 rounded-lg p-2 text-gray-300 transition hover:bg-gray-100 hover:text-gray-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Live
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">Your AI receptionist is live</h2>
            <p className="mt-2 text-base text-gray-500">It answers calls, books appointments, and handles messages — 24 hours a day, in English and Spanish.</p>
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Your business number</p>
              <p className="mt-0.5 text-3xl font-bold tracking-tight text-gray-900">{phoneNumber || "Loading..."}</p>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              {isSetupComplete ? (
                <span className="inline-flex items-center gap-2 rounded-xl bg-green-100 px-6 py-3 text-sm font-semibold text-green-700">
                  ✅ Setup complete
                </span>
              ) : (
                <Link
                  to="/setup"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Complete Setup →
                </Link>
              )}
              <Link
                to="/getting-started"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                📖 Getting Started Guide
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Row ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-3 h-3 w-20 rounded bg-gray-200" />
              <div className="h-8 w-12 rounded bg-gray-200" />
            </div>
          ))
        ) : (
          [
            { label: "Calls Today", value: callsToday, sub: hasRealData ? `${answerRate}% answered` : null },
            { label: "Answered", value: answeredToday, sub: hasRealData ? `${answerRate}%` : null },
            { label: "Bookings", value: bookingsToday, sub: hasRealData ? `${bookingRate}% booking rate` : null },
            { label: "Missed", value: callsToday - answeredToday, sub: null },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{stat.value}</p>
              {stat.sub && <p className="mt-1 text-xs text-gray-400">{stat.sub}</p>}
            </div>
          ))
        )}
      </div>

      {/* ── Activity + Appointments ───────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-50 px-6 py-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Recent Activity</h2>
            {recentActivity.length > 0 && (
              <Link to="/dashboard/conversations" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all →</Link>
            )}
          </div>

          {recentActivity.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {recentActivity.map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-4 px-6 py-4 transition hover:bg-gray-50/50">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-sm">
                    {item.type === "call" ? "📞" : item.type === "chat" ? "💬" : "✉️"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                        item.status === "active" ? "bg-blue-50 text-blue-700" :
                        item.status === "transferred" ? "bg-amber-50 text-amber-700" :
                        "bg-red-50 text-red-700"
                      }`}>{item.status}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500 truncate">{item.summary}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-3xl">👋</div>
              <h3 className="mt-4 text-sm font-semibold text-gray-900">Welcome to ReceptionAI</h3>
              <p className="mt-1 max-w-xs text-sm text-gray-500">Your AI receptionist is ready to answer calls. Activity will appear here as calls come in.</p>
            </div>
          )}
        </div>

        {/* Appointments */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-50 px-6 py-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Upcoming Appointments</h2>
            {upcomingAppointments.length > 0 && (
              <Link to="/dashboard/schedule" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all →</Link>
            )}
          </div>

          {upcomingAppointments.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {upcomingAppointments.map((apt: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-6 py-4 transition hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                      {apt.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{apt.name}</p>
                      <p className="text-xs text-gray-500">{apt.service}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{apt.time}</p>
                    <span className={`text-[11px] font-medium ${apt.status === "confirmed" || apt.status === "scheduled" ? "text-emerald-600" : "text-amber-600"}`}>
                      {apt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-3xl">📅</div>
              <h3 className="mt-4 text-sm font-semibold text-gray-900">No appointments yet</h3>
              <p className="mt-1 max-w-xs text-sm text-gray-500">When your AI books appointments, they'll appear here with customer details and times.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
