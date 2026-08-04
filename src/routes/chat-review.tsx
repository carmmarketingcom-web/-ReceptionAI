/**
 * Chat Review Page — /chat-review
 * Lets the owner review unanswered questions and add custom answers
 * that get fed back into the chat AI's knowledge base.
 */
import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chat-review")({
  component: ChatReviewPage,
});

interface ChatLog {
  id: number;
  question: string;
  answer: string;
  language: string;
  created_at: string;
}

function ChatReviewPage() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [customAnswer, setCustomAnswer] = useState("");
  const [message, setMessage] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat-logs");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDismiss = async (id: number) => {
    await fetch("/api/chat-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setMessage("Dismissed.");
  };

  const handleSaveAnswer = async (id: number) => {
    if (!customAnswer.trim()) return;
    await fetch("/api/chat-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reviewedAnswer: customAnswer.trim() }),
    });
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setEditingId(null);
    setCustomAnswer("");
    setMessage("Answer saved! Future chats will now know this.");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Chat Knowledge Review</h1>
          <p className="mt-2 text-sm text-gray-500">
            Questions the AI couldn't answer well. Add answers to train the bot for future visitors.
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {message}
            <button onClick={() => setMessage("")} className="ml-3 text-green-500 hover:text-green-600">✕</button>
          </div>
        )}

        {logs.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <span className="text-4xl">🎉</span>
            <p className="mt-3 text-lg font-medium text-gray-900">All caught up!</p>
            <p className="mt-1 text-sm text-gray-500">No unanswered questions to review. Check back later.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        {log.language.toUpperCase()}
                      </span>
                      {log.question}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(log.created_at + "Z").toLocaleDateString()}
                  </span>
                </div>

                <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-400">AI responded:</p>
                  <p className="text-sm text-gray-600">{log.answer}</p>
                </div>

                {editingId === log.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={customAnswer}
                      onChange={(e) => setCustomAnswer(e.target.value)}
                      placeholder="Write the correct answer this question should get..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveAnswer(log.id)}
                        disabled={!customAnswer.trim()}
                        className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Save Answer
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setCustomAnswer(""); }}
                        className="rounded-lg bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingId(log.id); setCustomAnswer(""); }}
                      className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
                    >
                      Add Answer
                    </button>
                    <button
                      onClick={() => handleDismiss(log.id)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-200"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={fetchLogs}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
