import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/team")({
  component: TeamPage,
});

const teamMembers = [
  { id: 1, name: "You (Owner)", initials: "YO", role: "Owner", email: "owner@mybusiness.com", status: "online" as const },
  { id: 2, name: "Sarah Johnson", initials: "SJ", role: "Technician", email: "sarah@mybusiness.com", status: "online" as const },
  { id: 3, name: "Mike Rodriguez", initials: "MR", role: "Technician", email: "mike@mybusiness.com", status: "offline" as const },
  { id: 4, name: "Lisa Park", initials: "LP", role: "Dispatcher", email: "lisa@mybusiness.com", status: "online" as const },
  { id: 5, name: "David Chen", initials: "DC", role: "Technician", email: "david@mybusiness.com", status: "offline" as const },
];

function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your team members and their permissions.</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          + Invite Member
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="divide-y divide-gray-50">
          {teamMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                    {m.initials}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                    m.status === "online" ? "bg-green-500" : "bg-gray-300"
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.role} · {m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  m.status === "online" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>{m.status}</span>
                <button className="text-sm text-gray-500 hover:text-gray-700">Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}