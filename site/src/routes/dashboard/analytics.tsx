import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/analytics")({
  component: AnalyticsPage,
});

const callsByDay = [
  { day: "Mon", calls: 42, answered: 39, booked: 15 },
  { day: "Tue", calls: 38, answered: 36, booked: 12 },
  { day: "Wed", calls: 45, answered: 42, booked: 18 },
  { day: "Thu", calls: 51, answered: 48, booked: 22 },
  { day: "Fri", calls: 36, answered: 33, booked: 14 },
  { day: "Sat", calls: 28, answered: 26, booked: 10 },
  { day: "Sun", calls: 15, answered: 15, booked: 6 },
];

const peakHours = [
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

const channelBreakdown = [
  { channel: "Phone Calls", count: 145, pct: 48 },
  { channel: "Web Chat", count: 72, pct: 24 },
  { channel: "SMS", count: 48, pct: 16 },
  { channel: "WhatsApp", count: 36, pct: 12 },
];

type Period = "week" | "month" | "quarter";

function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("week");

  const totalCalls = callsByDay.reduce((s, d) => s + d.calls, 0);
  const totalAnswered = callsByDay.reduce((s, d) => s + d.answered, 0);
  const totalBooked = callsByDay.reduce((s, d) => s + d.booked, 0);
  const answerRate = Math.round((totalAnswered / totalCalls) * 100);
  const bookingRate = Math.round((totalBooked / totalAnswered) * 100);

  const maxCalls = Math.max(...callsByDay.map((d) => d.calls));
  const maxPeak = Math.max(...peakHours.map((p) => p.calls));

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
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Calls</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalCalls}</p>
          <p className="mt-1 text-xs text-green-600">↑ 12% vs last {period}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Answer Rate</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{answerRate}%</p>
          <p className="mt-1 text-xs text-green-600">↑ 3% vs last {period}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Booking Rate</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{bookingRate}%</p>
          <p className="mt-1 text-xs text-green-600">↑ 5% vs last {period}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Appointments</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalBooked}</p>
          <p className="mt-1 text-xs text-amber-600">↓ 2% vs last {period}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calls Over Time - Bar Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Calls Over Time</h2>
          <div className="mt-6">
            {/* Legend */}
            <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-indigo-400" />
                <span>Total Calls</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-green-400" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-blue-400" />
                <span>Booked</span>
              </div>
            </div>
            {/* Bars */}
            <div className="flex items-end gap-2">
              {callsByDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center">
                  <div className="relative flex w-full items-end justify-center gap-0.5" style={{ height: "120px" }}>
                    <div
                      className="w-3 rounded-t bg-indigo-400 transition-all"
                      style={{ height: `${(d.calls / maxCalls) * 100}%` }}
                    />
                    <div
                      className="w-3 rounded-t bg-green-400 transition-all"
                      style={{ height: `${(d.answered / maxCalls) * 100}%` }}
                    />
                    <div
                      className="w-3 rounded-t bg-blue-400 transition-all"
                      style={{ height: `${(d.booked / maxCalls) * 100}%` }}
                    />
                  </div>
                  <span className="mt-2 text-xs text-gray-500">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Peak Hours - Horizontal Bar */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Peak Hours</h2>
          <div className="mt-4 space-y-2">
            {peakHours.map((p) => (
              <div key={p.hour} className="flex items-center gap-3">
                <span className="w-10 text-right text-xs text-gray-500">{p.hour}</span>
                <div className="flex-1">
                  <div className="h-5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${(p.calls / maxPeak) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-6 text-right text-xs font-medium text-gray-700">{p.calls}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channel Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Channel Breakdown</h2>
          <div className="mt-4 space-y-4">
            {channelBreakdown.map((ch) => (
              <div key={ch.channel}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{ch.channel}</span>
                  <span className="font-medium text-gray-900">{ch.count}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${ch.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Performance Summary</h2>
          <div className="mt-4 space-y-4">
            {[
              { label: "AI Answer Rate", value: `${answerRate}%`, target: "95%", color: "bg-green-500", pct: answerRate },
              { label: "Booking Conversion", value: `${bookingRate}%`, target: "75%", color: "bg-indigo-500", pct: bookingRate },
              { label: "Human Escalation", value: "11%", target: "<15%", color: "bg-amber-500", pct: 11, good: true },
              { label: "Customer Satisfaction", value: "4.8/5", target: "4.5+", color: "bg-blue-500", pct: 96 },
            ].map((metric) => (
              <div key={metric.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{metric.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{metric.value}</span>
                    <span className="text-xs text-gray-400">target: {metric.target}</span>
                  </div>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${metric.color}`}
                    style={{ width: `${Math.min(metric.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}