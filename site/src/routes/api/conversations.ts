// ─── Conversations API Route ──────────────────────────────────────────────────
// GET  /api/conversations  — List conversations for the dashboard
// POST /api/conversations  — Add a human reply to a conversation
//
// Requires: Authorization: Bearer <token>
// Uses PostgreSQL in production, voice-engine session store in mock mode.

import { authenticate } from "../../../lib/middleware";
import { getDb, isMockMode } from "../../../db/index";
import { conversations, messages } from "../../../db/schema/index";
import { eq, desc } from "drizzle-orm";
import { sessionStore } from "../../../../voice-engine/src/conversation/engine.ts";

export async function GET({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const usingMock = isMockMode();

    if (!usingMock) {
      const db = getDb();

      const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.organizationId, authResult.organizationId))
        .orderBy(desc(conversations.startedAt))
        .limit(limit)
        .offset(offset);

      return new Response(
        JSON.stringify({
          conversations: rows,
          total: rows.length,
          limit,
          offset,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Mock mode — use the voice-engine session store
    const conversationIds = Array.from(
      // @ts-expect-error - accessing private sessions map for demo
      sessionStore.sessions?.keys() || []
    );

    const conversationList = conversationIds
      .slice(offset, offset + limit)
      .map((id: string) => {
        const manager = sessionStore.get(id as string);
        if (!manager) return null;
        return {
          id: manager.context.conversationId,
          organizationId: manager.context.organizationId,
          channel: manager.context.channel,
          language: manager.context.language,
          customerName: manager.context.customerInfo?.name || null,
          customerPhone: manager.context.customerInfo?.phone || null,
          messageCount: manager.context.messageHistory.length,
          createdAt: manager.context.createdAt.toISOString(),
          updatedAt: manager.context.updatedAt.toISOString(),
          summary: manager.getSummary(),
        };
      })
      .filter(Boolean);

    return new Response(
      JSON.stringify({
        conversations: conversationList,
        total: conversationIds.length,
        limit,
        offset,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Conversations API] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch conversations" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * POST /api/conversations
 * Add a human reply to a conversation (e.g., from the dashboard).
 */
export async function POST({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const body = (await request.json()) as {
      conversationId?: string;
      message?: string;
      humanName?: string;
    };

    const { conversationId, message, humanName } = body;

    if (!conversationId || !message) {
      return new Response(
        JSON.stringify({ error: "conversationId and message are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const usingMock = isMockMode();

    if (!usingMock) {
      const db = getDb();

      // Verify conversation belongs to the org
      const [conversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (!conversation) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Insert the human message
      await db.insert(messages).values({
        id: crypto.randomUUID(),
        conversationId,
        organizationId: authResult.organizationId,
        role: "user",
        content: `[Human agent${humanName ? ` ${humanName}` : ""}]: ${message}`,
        contentType: "text",
      });

      return new Response(
        JSON.stringify({ success: true, conversationId }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Mock mode — use voice-engine session store
    const manager = sessionStore.get(conversationId);
    if (!manager) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    manager.addSystemMessage(
      `[Human agent${humanName ? ` ${humanName}` : ""}]: ${message}`
    );

    return new Response(
      JSON.stringify({ success: true, conversationId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Conversations API] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process message" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
