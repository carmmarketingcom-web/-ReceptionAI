import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

const stats = [
  { label: "Calls Today", value: "47", change: "+12%", positive: true, color: "indigo" },
  { label: "Answered", value: "44", change: "93.6%", positive: true, color: "green" },
  { label: "Bookings Today", value: "18", change: "+5", positive: true, color: "blue" },
  { label: "Avg Duration", value: "3m 42s", change: "-8s", positive: false, color: "amber" },
];

const recentActivity = [
  {
    type: "call",
    name: "Maria Garcia",
    summary: "Booked appointment for AC repair",
    time: "2 min ago",
    status: "completed",
  },
  {
    type: "chat",
    name: "John Smith",
    summary: "Asked about pricing - Growth plan interest",
    time: "15 min ago",
    status: "active",
  },
  {
    type: "sms",
    name: "Robert Chen",
    summary: "Rescheduled appointment to Friday",
    time: "32 min ago",
    status: "completed",
  },
  {
    type: "call",
    name: "Sarah Johnson",
    summary: "Transferred to technician - complex issue",
    time: "1 hour ago",
    status: "transferred",
  },
  {
    type: "call",
    name: "Carlos Mendez",
    summary: "Missed - voicemail left (Spanish)",
    time: "2 hours ago",
    status: "missed",
  },
];

const upcomingAppointments = [
  { name: "Maria Garcia", service: "AC Repair", time: "2:00 PM", status: "confirmed" },
  { name: "James Wilson", service: "Electrical Inspection", time: "3:30 PM", status: "confirmed" },
  { name: "Lisa Park", service: "Dental Cleaning", time: "4:45 PM", status: "pending" },
];

function DashboardOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              <span
                className={`text-sm font-medium ${
                  stat.positive ? "text-green-600" : "text-red-500"
                }`}
              >
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View All
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <div className="mt-0.5">
                  {item.type === "call" && <span className="text-lg">📞</span>}
                  {item.type === "chat" && <span className="text-lg">💬</span>}
                  {item.type === "sms" && <span className="text-lg">✉️</span>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : item.status === "active"
                          ? "bg-blue-100 text-blue-700"
                          : item.status === "transferred"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{item.summary}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Today's Appointments</h2>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View All
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {upcomingAppointments.map((apt, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                    {apt.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{apt.name}</p>
                    <p className="text-xs text-gray-500">{apt.service}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{apt.time}</p>
                  <span
                    className={`text-xs font-medium ${
                      apt.status === "confirmed" ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {apt.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 px-5 py-3 text-center">
            <p className="text-xs text-gray-400">
              AI answered 44 calls today · 18 appointments booked
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">AI Performance</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-gray-500">Answer Rate</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-[93.6%] rounded-full bg-green-500" />
              </div>
              <span className="text-sm font-semibold text-gray-900">93.6%</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Booking Rate</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-[72%] rounded-full bg-indigo-500" />
              </div>
              <span className="text-sm font-semibold text-gray-900">72%</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Human Escalation</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-[11%] rounded-full bg-amber-500" />
              </div>
              <span className="text-sm font-semibold text-gray-900">11%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}