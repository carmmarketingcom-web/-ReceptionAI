import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useRecordings, type RecordingItem } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/recordings")({
  component: RecordingsPage,
});

function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return "Duration not recorded";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Time not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Time not recorded";
  return d.toLocaleString();
}

function RecordingsPage() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { data, loading, error, refetch } = useRecordings();
  const recordings: RecordingItem[] = data?.recordings ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Call Recordings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Voicemail messages left on your business line. The audio is stored as soon as a caller
          finishes leaving a message, and the owner gets a text alert. Transcripts are not
          generated yet, so a message shows its audio and duration only.
        </p>
      </div>

      {/* Loading / error / list — nothing is invented: no rows, no audio, no summaries */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">Loading recordings…</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-red-700">Couldn't load recordings</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <p className="mt-1 text-xs text-red-500">
            This is a loading problem, not an empty list — nothing here says whether recordings
            exist.
          </p>
          <button
            onClick={refetch}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      ) : recordings.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-700">No voicemails yet</p>
          <p className="mt-1 text-sm text-gray-500">
            When a caller leaves a message (option 9 on your line), the audio is saved here and
            you get a text alert. Nothing appears until a real message is left — this page shows
            no sample rows. Calls that ended before the caller engaged appear on the Missed Calls
            page with their ring time and callback status.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recordings.map((rec) => {
            const hasAudio = rec.audioAvailable ?? Boolean(rec.recordingUrl);
            return (
              <div
                key={rec.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                      {hasAudio ? "🎧" : "📞"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {rec.callerName && rec.callerName.trim()
                          ? rec.callerName
                          : "Unknown Caller"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rec.callerNumber || "Number not recorded"}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        Voicemail · {formatWhen(rec.createdAt)} ·{" "}
                        {formatDuration(rec.durationSeconds)}
                      </p>
                      {rec.transcriptionText ? (
                        <p className="mt-2 text-sm text-gray-600 italic">
                          “{rec.transcriptionText}”
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">
                          Transcript not generated yet — the audio below is the message as the
                          caller left it.
                        </p>
                      )}
                      {/* Audio player only when audio is really stored */}
                      {playingId === rec.id && rec.recordingUrl && (
                        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <audio controls autoPlay className="w-full" style={{ height: "32px" }}>
                            <source src={rec.recordingUrl} type="audio/mpeg" />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        {hasAudio && rec.recordingUrl ? (
                          <>
                            <button
                              onClick={() => setPlayingId(playingId === rec.id ? null : rec.id)}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                            >
                              {playingId === rec.id ? "⏹ Stop" : "▶ Play Recording"}
                            </button>
                            <a
                              href={rec.recordingUrl}
                              download
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              Download
                            </a>
                          </>
                        ) : (
                          <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400">
                            No audio stored
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{rec.id.slice(0, 8)}</span>
                </div>
              </div>
            );
          })}
          <p className="px-1 text-xs text-gray-400">
            Playback links are signed and expire after a few hours — reload this page if one stops
            working.
          </p>
        </div>
      )}
    </div>
  );
}
