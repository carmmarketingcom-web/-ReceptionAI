import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/dashboard/schedule")({
  component: SchedulePage,
});

// ─── Types ──────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime: string | null;
  status: string;
  service: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

interface ScheduleData {
  year: number;
  month: number;
  monthLabel: string;
  appointments: Appointment[];
  byDay: Record<string, Appointment[]>;
  totalInMonth: number;
  totalUpcoming: number;
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
  confirmed:  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-l-indigo-400" },
  scheduled:  { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-l-blue-400" },
  completed:  { bg: "bg-green-50",  text: "text-green-700",  border: "border-l-green-400" },
  cancelled:  { bg: "bg-red-50",    text: "text-red-700",    border: "border-l-red-400" },
};

const statusDotColor: Record<string, string> = {
  confirmed: "bg-indigo-400",
  scheduled: "bg-blue-400",
  completed: "bg-green-400",
  cancelled: "bg-red-400",
};

// ─── Component ──────────────────────────────────────────────────────────────

function SchedulePage() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const fetchMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError("");
    setSelectedDate(null);
    try {
      const token = localStorage.getItem("receptionai_token");
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      const res = await fetch(`/api/schedule?month=${monthStr}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load schedule");
      const json = (await res.json()) as ScheduleData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, fetchMonth]);

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); }
    else setViewMonth(viewMonth + 1);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth() + 1);
    setSelectedDate(today.toISOString().split("T")[0]);
  };

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay();
  const todayStr = today.toISOString().split("T")[0];

  const selectedAppointments = selectedDate && data?.byDay[selectedDate]
    ? data.byDay[selectedDate]
    : [];

  // For "Upcoming" view (no date selected), show all future appointments this month
  const upcomingAppointments = !selectedDate && data
    ? data.appointments.filter((a) => a.date >= todayStr)
    : [];

  const displayAppointments = selectedDate ? selectedAppointments : upcomingAppointments;
  const displayLabel = selectedDate
    ? new Date(selectedDate + "T12:00").toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })
    : "Upcoming";

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Schedule</h1></div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => fetchMonth(viewYear, viewMonth)} className="mt-3 text-sm font-medium text-red-600 underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="mt-1 text-sm text-gray-400">
            {data.totalUpcoming} upcoming appointment{data.totalUpcoming !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Today
          </button>
          <div className="flex items-center gap-1 text-sm">
            <button onClick={prevMonth} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="min-w-[120px] text-center font-medium text-gray-700">{data.monthLabel}</span>
            <button onClick={nextMonth} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content: Split Layout ──────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── Mini Calendar (Left) ─────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          {/* Weekday headers */}
          <div className="mb-2 grid grid-cols-7">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="py-1 text-center text-[11px] font-medium uppercase tracking-wider text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasApps = data.byDay[dateStr] && data.byDay[dateStr].length > 0;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className="relative aspect-square"
                >
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm transition ${
                      isToday
                        ? "bg-indigo-100 font-semibold text-indigo-700"
                        : isSelected
                        ? "bg-indigo-50 font-medium text-indigo-600 ring-1 ring-inset ring-indigo-200"
                        : "font-normal text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {day}
                  </span>
                  {/* Indicator bar for appointments */}
                  {hasApps && !isToday && !isSelected && (
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                      <div className={`h-0.5 w-4 rounded-full ${statusDotColor[data.byDay[dateStr][0]?.status] || "bg-gray-300"}`} />
                    </div>
                  )}
                  {hasApps && (isToday || isSelected) && (
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                      <div className={`h-1 w-3 rounded-full ${statusDotColor[data.byDay[dateStr][0]?.status] || "bg-indigo-400"}`} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Appointment List (Right) ─────────────────────────────── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{displayLabel}</h3>
            <span className="text-xs text-gray-400">
              {displayAppointments.length} appointment{displayAppointments.length !== 1 ? "s" : ""}
            </span>
          </div>

          {displayAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-2xl">📅</div>
              <p className="text-sm font-medium text-gray-500">
                {selectedDate ? "No appointments for this day" : "No upcoming appointments"}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Appointments will appear here once booked through the AI receptionist.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayAppointments.map((a) => {
                const cfg = statusConfig[a.status] || statusConfig.scheduled;
                return (
                  <div
                    key={a.id}
                    className={`rounded-xl border border-gray-100 bg-white p-4 transition hover:shadow-sm border-l-4 ${cfg.border}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{a.time}</p>
                          {a.endTime && (
                            <>
                              <span className="text-gray-300">–</span>
                              <p className="text-sm text-gray-400">{a.endTime}</p>
                            </>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-gray-800">
                          {a.customerName || a.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {a.service}
                          {a.customerPhone && <span className="ml-2 text-gray-400">{a.customerPhone}</span>}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Empty month state ──────────────────────────────────────────── */}
      {data.totalInMonth === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">📅</div>
          <h3 className="mt-4 text-sm font-semibold text-gray-700">No appointments this month</h3>
          <p className="mt-1 text-xs text-gray-400">Appointments will appear here once they're booked through the AI receptionist.</p>
        </div>
      )}
    </div>
  );
}
