import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/appointments")({
  component: AppointmentsPage,
});

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const appointmentsData = [
  { id: 1, name: "Maria Garcia", service: "AC Repair", time: "2:00 PM", date: 15, status: "confirmed", color: "indigo" },
  { id: 2, name: "James Wilson", service: "Electrical Inspection", time: "3:30 PM", date: 15, status: "confirmed", color: "blue" },
  { id: 3, name: "Lisa Park", service: "Dental Cleaning", time: "4:45 PM", date: 15, status: "pending", color: "amber" },
  { id: 4, name: "Robert Chen", service: "Plumbing Repair", time: "9:00 AM", date: 16, status: "confirmed", color: "green" },
  { id: 5, name: "Sarah Johnson", service: "HVAC Maintenance", time: "11:00 AM", date: 16, status: "confirmed", color: "indigo" },
  { id: 6, name: "Carlos Mendez", service: "Vet Checkup", time: "1:00 PM", date: 17, status: "pending", color: "amber" },
  { id: 7, name: "Emily Davis", service: "Plumbing Estimate", time: "10:00 AM", date: 18, status: "confirmed", color: "blue" },
  { id: 8, name: "David Brown", service: "AC Installation", time: "8:00 AM", date: 19, status: "confirmed", color: "green" },
];

const colorMap: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  green: "bg-green-100 text-green-700 border-green-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function AppointmentsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showForm, setShowForm] = useState(false);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else { setMonth(month - 1); }
  };

  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else { setMonth(month + 1); }
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const todayDate = today.getDate();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="mt-1 text-sm text-gray-500">Manage and view all scheduled appointments.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          + New Appointment
        </button>
      </div>

      {/* New Appointment Form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">New Appointment</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600">Customer Name</label>
              <input type="text" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Service</label>
              <input type="text" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. AC Repair" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Date</label>
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Time</label>
              <input type="time" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
          </div>
        </div>
      )}

      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{monthName} {year}</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={nextMonth} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((d) => (
            <div key={d} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-50 p-2" />
          ))}

          {/* Day cells */}
          {days.map((day) => {
            const dayApps = appointmentsData.filter((a) => a.date === day);
            const isToday = isCurrentMonth && day === todayDate;
            return (
              <div
                key={day}
                className={`min-h-[100px] border-b border-r border-gray-50 p-2 transition hover:bg-gray-50 ${
                  isToday ? "bg-indigo-50/50" : ""
                }`}
              >
                <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday ? "bg-indigo-600 text-white" : "text-gray-700"
                }`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {dayApps.map((apt) => (
                    <div
                      key={apt.id}
                      className={`rounded-md border px-2 py-1 text-xs ${colorMap[apt.color]}`}
                    >
                      <p className="font-medium truncate">{apt.time}</p>
                      <p className="truncate opacity-75">{apt.service}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Appointments List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Upcoming Appointments</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {appointmentsData.map((apt) => (
            <div key={apt.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                  {apt.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{apt.name}</p>
                  <p className="text-xs text-gray-500">{apt.service}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{apt.time}</p>
                <span className={`text-xs font-medium ${apt.status === "confirmed" ? "text-green-600" : "text-amber-600"}`}>
                  {apt.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}