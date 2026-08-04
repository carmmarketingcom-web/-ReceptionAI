import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useConversations, useAppointments } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/analytics")({
  component: AnalyticsPage,
});

// Mock fallback data
const mockCallsByDay = [
  { day: "Mon", calls: 42, answered: 39, booked: 15 },
  { day: "Tue", calls: 38, answered: 36, booked: 12 },
  { day: "Wed", calls: 45, answered: 42, booked: 18 },
  { day: "Thu", calls: 51, answered: 48, booked: 22 },
  { day: "Fri", calls: 36, answered: 33, booked: 14 },
  { day: "Sat", calls: 28, answered: 26, booked: 10 },
  { day: "Sun", calls: 15, answered: 15, booked: 6 },
];

const mockPeakHours = [
  { hour: "8AM", calls: 8 },
  { hour: "9AM", calls: 14 },
  { hour: "10AM", calls: 18 },
  { hour: "11AM", calls: 16 },
  { hour: "12PM", calls: 12 },
  { hour: "1PM", calls: 10 },
  { hour: "2PM", calls: 15 },
  { hour: "3PM", calls: 13 },
  { hour: "4PM", calls: 9 },
  { hour: "5PM", calls: 6 },
];

const mockChannelBreakdown = [
  { channel: "Phone Calls", count: 145, pct: 48 },
  { channel: "Web Chat", count: 72, pct: 24 },
  { channel: "SMS", count: 48, pct: 16 },
  { channel: "WhatsApp", count: 36, pct: 12 },
];

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function deriveAnalytics(conversationsData: any, appointmentsData: any) {
  const conversations = conversationsData?.conversations || [];
  const appointments = appointmentsData?.appointments || [];

  // Calls by day (last 7 days)
  const today = new Date();
  const callsByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayConvs = conversations.filter((c: any) =>
      c.createdAt?.startsWith(dateStr)
    );
    const dayAppts = appointments.filter((a: any) =>
      a.createdAt?.startsWith(dateStr)
    );
    callsByDay.push({
      day: dayLabels[d.getDay()],
      calls: dayConvs.length,
      answered: dayConvs.filter((c: any) => c.status !== "missed").length,
      booked: dayAppts.filter((a: any) => a.status === "scheduled").length,
    });
  }

  // Peak hours
  const hourCounts: Record<number, number> = {};
  for (const c of conversations) {
    if (c.createdAt) {
      const h = new Date(c.createdAt).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
  }
  const peakHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => {
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return { hour: `${hour12}${ampm}`, calls: hourCounts[h] || 0 };
  });

  // Channel breakdown
  const channelCounts: Record<string, number> = { call: 0, chat: 0, sms: 0, whatsapp: 0 };
  for (const c of conversations) {
    const ch = c.channel || "call";
    if (channelCounts[ch] !== undefined) channelCounts[ch]++;
    else channelCounts.call++;
  }
  const totalCalls = Object.values(channelCounts).reduce((s, v) => s + v, 0) || 1;
  const channelBreakdown = [
    { channel: "Phone Calls", count: channelCounts.call || 0, pct: Math.round((channelCounts.call || 0) / totalCalls * 100) },
    { channel: "Web Chat", count: channelCounts.chat || 0, pct: Math.round((channelCounts.chat || 0) / totalCalls * 100) },
    { channel: "SMS", count: channelCounts.sms || 0, pct: Math.round((channelCounts.sms || 0) / totalCalls * 100) },
    { channel: "WhatsApp", count: channelCounts.whatsapp || 0, pct: Math.round((channelCounts.whatsapp || 0) / totalCalls * 100) },
  ];

  return { callsByDay, peakHours, channelBreakdown, hasRealData: conversations.length > 0 || appointments.length > 0 };
}

type Period = "week" | "month" | "quarter";

function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const { data: conversationsData, loading: loadingConv } = useConversations(500, 0);
  const { data: appointmentsData, loading: loadingAppt } = useAppointments({ limit: 500 });

  const loading = loadingConv || loadingAppt;
  const analytics = deriveAnalytics(conversationsData, appointmentsData);

  const callsByDay = analytics.hasRealData ? analytics.callsByDay : mockCallsByDay;
  const peakHours = analytics.hasRealData ? analytics.peakHours : mockPeakHours;
  const channelBreakdown = analytics.hasRealData ? analytics.channelBreakdown : mockChannelBreakdown;

  const totalCalls = callsByDay.reduce((s, d) => s + d.calls, 0);
  const totalAnswered = callsByDay.reduce((s, d) => s + d.answered, 0);
  const totalBooked = callsByDay.reduce((s, d) => s + d.booked, 0);
  const answerRate = totalCalls > 0 ? Math.round((totalAnswered / totalCalls) * 100) : 0;
  const bookingRate = totalAnswered > 0 ? Math.round((totalBooked / totalAnswered) * 100) : 0;

  const maxCalls = Math.max(...callsByDay.map((d) => d.calls), 1);
  const maxPeak = Math.max(...peakHours.map((p) => p.calls), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Track your business communication metrics.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="quarter">Last Quarter</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm text-gray-500">Loading analytics...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Calls", value: totalCalls.toLocaleString(), change: `${answerRate}% answered`, color: "indigo" },
              { label: "Answer Rate", value: `${answerRate}%`, change: `${totalAnswered} of ${totalCalls}`, color: "green" },
              { label: "Booking Rate", value: `${bookingRate}%`, change: `${totalBooked} bookings`, color: "blue" },
              { label: "Avg Per Day", value: Math.round(totalCalls / 7).toLocaleString(), change: "calls/day", color: "amber" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="mt-0.5 text-xs text-gray-500">{stat.change}</p>
              </div>
            ))}
          </div>

          {/* Call Volume Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Call Volume</h2>
            <div className="mt-4 flex items-end gap-2" style={{ height: "160px" }}>
              {callsByDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs text-gray-500">{d.calls}</span>
                  <div className="flex w-full flex-col justify-end gap-0.5">
                    <div className="w-full rounded-t bg-indigo-500 transition" style={{ height: `${(d.answered / maxCalls) * 120}px` }} />
                    <div className="w-full rounded-t bg-indigo-200" style={{ height: `${((d.calls - d.answered) / maxCalls) * 120}px` }} />
                  </div>
                  <span className="mt-1 text-xs text-gray-400">{d.day}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
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
            {/* Peak Hours */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Peak Hours</h2>
              <div className="mt-4 space-y-2">
                {peakHours.map((p) => (
                  <div key={p.hour} className="flex items-center gap-3">
                    <span className="w-12 text-xs text-gray-500">{p.hour}</span>
                    <div className="flex-1 rounded-full bg-gray-100">
                      <div className="h-5 rounded-full bg-indigo-500 transition" style={{ width: `${(p.calls / maxPeak) * 100}%` }} />
                    </div>
                    <span className="w-8 text-xs font-medium text-gray-700">{p.calls}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel Breakdown */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">By Channel</h2>
              <div className="mt-4 space-y-4">
                {channelBreakdown.map((ch) => (
                  <div key={ch.channel}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{ch.channel}</span>
                      <span className="font-medium text-gray-900">{ch.count} <span className="text-xs text-gray-400">({ch.pct}%)</span></span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${ch.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!analytics.hasRealData && (
            <p className="text-center text-xs text-gray-400">
              Showing demo data. Connect your phone number and start receiving calls to see real analytics.
            </p>
          )}
        </>
      )}
    </div>
  );
}
