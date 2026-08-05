/**
 * Chat log utilities — stubs for production chat logging.
 * Logs conversations for analytics and improvement.
 */

export function logConversation(
  sessionId: string,
  message: string,
  reply: string,
  lang: string,
): void {
  // In production, write to chat_logs table. For now, a no-op stub.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[chat-log] ${sessionId} (${lang}): "${message.slice(0, 60)}" → "${reply.slice(0, 60)}"`);
  }
}

export function getReviewedKnowledge(): string[] {
  // Return reviewed knowledge snippets for the system prompt
  return [];
}

export function isFallbackResponse(_reply: string): boolean {
  // Currently always false — all responses are considered valid
  return false;
}
