import { createFileRoute } from "@tanstack/react-router";
import { useTeamMembers, type TeamMemberItem } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/team")({
  component: TeamPage,
});

function initialsFor(member: TeamMemberItem): string {
  const name = (member.name || "").trim();
  if (name) {
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
  }
  const email = (member.email || "").trim();
  return email ? email[0].toUpperCase() : "?";
}

function displayName(member: TeamMemberItem): string {
  const name = (member.name || "").trim();
  if (name) return name;
  const email = (member.email || "").trim();
  return email ? email.split("@")[0] : "Unnamed user";
}

function roleLabel(member: TeamMemberItem): string {
  const role = (member.role || "").trim();
  if (!role) return "No role set";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return "Hasn't signed in yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Hasn't signed in yet";
  return `Last signed in ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function TeamPage() {
  const { data, loading, error, refetch } = useTeamMembers();

  const members: TeamMemberItem[] = data?.users ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="mt-1 text-sm text-gray-500">
            The accounts that can sign in to this workspace. Inviting teammates isn't available
            yet — every person listed here already has a login.
          </p>
        </div>
        <button
          disabled
          title="Inviting teammates isn't available yet"
          className="cursor-not-allowed rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400"
        >
          + Invite Member
        </button>
      </div>

      {/* Loading / error / list — an empty list means no accounts, never "demo team" */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">Loading team members…</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-red-700">Couldn't load team members</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <p className="mt-1 text-xs text-red-500">
            This is a loading problem, not an empty list — nothing here says whether your team
            members exist.
          </p>
          <button
            onClick={refetch}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-700">No team members yet</p>
          <p className="mt-1 text-sm text-gray-500">
            This workspace has no user accounts recorded. When an account exists for this
            organization, it will appear here with its role and last sign-in.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="divide-y divide-gray-50">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                    {initialsFor(member)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{displayName(member)}</p>
                    <p className="text-xs text-gray-500">
                      {roleLabel(member)}
                      {member.email ? ` · ${member.email}` : " · No email on file"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">{formatLastLogin(member.lastLoginAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      member.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {member.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
