/**
 * GET /api/chat-logs — list unreviewed fallback questions
 * POST /api/chat-logs — mark a question as reviewed (optionally with a custom answer)
 *
 * No auth for now — simple admin access. Add proper auth if needed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getUnreviewedFallbacks, markReviewed } from "~/lib/chat-logs";

export const Route = createFileRoute("/api/chat-logs")({});

export async function GET() {
  try {
    const logs = getUnreviewedFallbacks(50);
    return new Response(JSON.stringify({ logs }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch logs" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as { id?: number; reviewedAnswer?: string };
    if (!body.id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const ok = markReviewed(body.id, body.reviewedAnswer);
    return new Response(JSON.stringify({ success: ok }), {
      status: ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to update" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
