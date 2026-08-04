/**
 * GET /api/conversations/:id
 *
 * Returns a single conversation with all messages.
 */

import { authenticate } from "../../../../lib/middleware";
import { getDb, isMockMode } from "../../../../db/index";
import { conversations, messages } from "../../../../db/schema/index";
import { eq, and } from "drizzle-orm";

// Import from the existing voice-engine session store as fallback
import { sessionStore } from "../../../../../../voice-engine/src/conversation/engine.ts";

export async function GET({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const conversationId = params.id;
    const usingMock = isMockMode();

    if (!usingMock) {
      const db = getDb();

      const [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.organizationId, authResult.organizationId)
          )
        )
        .limit(1);

      if (!conversation) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt as any);

      return new Response(
        JSON.stringify({ conversation, messages: conversationMessages }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Mock mode — try the voice-engine session store
    const manager = sessionStore.get(conversationId);
    if (!manager) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        conversation: {
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
        },
        messages: manager.context.messageHistory.map((msg: any, idx: number) => ({
          id: `${conversationId}-msg-${idx}`,
          conversationId,
          role: msg.role || "user",
          content: msg.content || msg.text || "",
          contentType: "text",
          createdAt: msg.timestamp || new Date().toISOString(),
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Conversations Detail] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch conversation" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
