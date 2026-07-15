import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/recordings")({
  component: RecordingsPage,
});

const recordings = [
  { id: "REC-001", caller: "Maria Garcia", duration: "3m 42s", date: "Today, 2:43 PM", aiSummary: "Booked AC repair appointment for tomorrow 2pm" },
  { id: "REC-002", caller: "Sarah Johnson", duration: "5m 20s", date: "Today, 1:10 PM", aiSummary: "Transferred to technician - complex electrical issue" },
  { id: "REC-003", caller: "James Wilson", duration: "2m 55s", date: "Today, 11:30 AM", aiSummary: "Booked electrical inspection for Monday" },
  { id: "REC-004", caller: "Carlos Mendez", duration: "0m 30s", date: "Today, 10:15 AM", aiSummary: "Missed - voicemail left (Spanish)" },
  { id: "REC-005", caller: "David Brown", duration: "4m 15s", date: "Yesterday, 4:20 PM", aiSummary: "Inquired about emergency HVAC service" },
];

function RecordingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Call Recordings</h1>
        <p className="mt-1 text-sm text-gray-500">Review and download recordings of AI-handled calls.</p>
      </div>

      <div className="space-y-3">
        {recordings.map((rec) => (
          <div key={rec.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                  🎧
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{rec.caller}</p>
                  <p className="text-xs text-gray-500">{rec.date} · {rec.duration}</p>
                  <p className="mt-2 text-sm text-gray-600">{rec.aiSummary}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                      ▶ Play Recording
                    </button>
                    <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      Download
                    </button>
                    <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      View Transcript
                    </button>
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-400">{rec.id}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}