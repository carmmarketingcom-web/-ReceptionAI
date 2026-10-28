import { createFileRoute } from "@tanstack/react-router";
import { useFollowUpCampaigns, type FollowUpCampaignItem } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/campaigns")({
  component: CampaignsPage,
});

function triggerLabel(trigger: string | null): string {
  if (!trigger) return "No trigger set";
  const words = trigger.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatCreated(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function CampaignsPage() {
  const { data, loading, error, refetch } = useFollowUpCampaigns();

  const campaigns: FollowUpCampaignItem[] = data?.campaigns ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">
            Automated follow-up campaigns. Building a campaign isn't available yet — this page
            lists whatever campaigns exist for your account.
          </p>
        </div>
        <button
          disabled
          title="Creating campaigns isn't available yet"
          className="cursor-not-allowed rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400"
        >
          + New Campaign
        </button>
      </div>

      {/* Loading / error / list — no invented campaigns and no invented delivery stats */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">Loading campaigns…</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-red-700">Couldn't load campaigns</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <p className="mt-1 text-xs text-red-500">
            This is a loading problem, not an empty list — nothing here says whether campaigns
            exist.
          </p>
          <button
            onClick={refetch}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-700">
            No campaigns yet — automated follow-ups aren't available yet
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Follow-up campaigns arrive with the Revenue Recovery engine. When a campaign exists it
            will appear here with its trigger, channels and status. Delivery statistics
            (sent / opened / replied) aren't tracked yet, so none are shown.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Trigger</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Channels</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Language</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((c) => (
                  <tr key={c.id} className="transition hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-900">
                        {c.name && c.name.trim() ? c.name : "Unnamed campaign"}
                      </p>
                      {c.description && (
                        <p className="text-xs text-gray-400">{c.description}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                      {triggerLabel(c.triggerEvent)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm">
                      {c.channels.length > 0 ? (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {c.channels.join(", ").toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No channel set</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                      {c.language ? c.language.toUpperCase() : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {c.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                      {formatCreated(c.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
