import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/campaigns")({
  component: CampaignsPage,
});

type Campaign = {
  id: string;
  name: string;
  type: "sms" | "email";
  status: "active" | "draft" | "completed";
  sent: number;
  opened: number;
  replied: number;
  created: string;
};

const campaigns: Campaign[] = [
  { id: "CAM-001", name: "Appointment Reminder - Weekly", type: "sms", status: "active", sent: 128, opened: 112, replied: 45, created: "Mar 1, 2026" },
  { id: "CAM-002", name: "Seasonal HVAC Checkup Offer", type: "email", status: "draft", sent: 0, opened: 0, replied: 0, created: "Mar 15, 2026" },
  { id: "CAM-003", name: "Thank You - Post Service", type: "sms", status: "active", sent: 89, opened: 78, replied: 23, created: "Feb 20, 2026" },
  { id: "CAM-004", name: "New Customer Welcome", type: "email", status: "completed", sent: 45, opened: 38, replied: 12, created: "Feb 10, 2026" },
  { id: "CAM-005", name: "Missed Call Follow-up", type: "sms", status: "active", sent: 67, opened: 58, replied: 31, created: "Jan 25, 2026" },
];

function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">Automated follow-up and reminder campaigns.</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          + New Campaign
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Sent</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Opened</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Replied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map((c) => (
                <tr key={c.id} className="transition hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.id}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{c.type.toUpperCase()}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.status === "active" ? "bg-green-100 text-green-700" :
                      c.status === "draft" ? "bg-gray-100 text-gray-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{c.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{c.sent}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{c.opened}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{c.replied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}