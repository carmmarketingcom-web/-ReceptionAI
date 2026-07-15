// ─── Conversation Engine ─────────────────────────────────────────────────────
// Manages the conversation lifecycle: context, prompt building, LLM interaction,
// function calling, and bilingual detection.

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import type {
  Channel,
  ConversationContext,
  ConversationMessage,
  CustomerInfo,
  Language,
  LLMFunction,
  LLMResponse,
  OrganizationConfig,
} from "../types/index.ts";
import { buildSystemPrompt } from "./prompt-builder.ts";
import { getFunctionDefinitions } from "./function-registry.ts";
import { detectLanguage } from "./language-detect.ts";

// ─── OpenAI Client ───────────────────────────────────────────────────────────

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// ─── Token Budget ────────────────────────────────────────────────────────────

const MAX_HISTORY_TOKENS = 8000; // voice-friendly budget
const MAX_HISTORY_MESSAGES = 20;

// ─── Conversation Manager ────────────────────────────────────────────────────

/**
 * Manages a single conversation session. Holds the context, message history,
 * and handles orchestration with the LLM.
 */
export class ConversationManager {
  public context: ConversationContext;
  private orgConfig: OrganizationConfig;

  constructor(orgConfig: OrganizationConfig, channel: Channel) {
    this.orgConfig = orgConfig;
    this.context = {
      organizationId: orgConfig.id,
      conversationId: crypto.randomUUID(),
      channel,
      language: "en",
      messageHistory: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ─── Message Processing ──────────────────────────────────────────────────

  /**
   * Process an incoming message from the customer and return the AI response.
   */
  async processMessage(
    content: string,
    role: "customer" = "customer",
    options?: { sttConfidence?: number; functionResult?: unknown },
  ): Promise<LLMResponse> {
    // Add customer message to history
    this.addMessage({
      role,
      content,
      contentType: "text",
      sttConfidence: options?.sttConfidence,
      timestamp: new Date(),
    });

    // Detect language if not yet set or if confidence is ambiguous
    this.context.language = await detectLanguage(content, this.context.language);

    // Build the message array for the LLM
    const messages = this.buildLLMMessages();

    // Call OpenAI
    const response = await this.callLLM(messages);

    // Add AI response to history
    if (response.content) {
      this.addMessage({
        role: "ai",
        content: response.content,
        contentType: "text",
        timestamp: new Date(),
      });
    }

    // Handle tool calls (function calling)
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        this.addMessage({
          role: "ai",
          content: `[Function call: ${toolCall.name}]`,
          contentType: "action",
          functionCall: { name: toolCall.name, arguments: toolCall.arguments },
          timestamp: new Date(),
        });
      }
    }

    this.context.updatedAt = new Date();
    return response;
  }

  /**
   * Process a function call result and get the LLM's follow-up response.
   */
  async processFunctionResult(
    functionName: string,
    result: unknown,
  ): Promise<LLMResponse> {
    // Add function result as a system message
    this.addMessage({
      role: "system",
      content: `Result of ${functionName}: ${JSON.stringify(result)}`,
      contentType: "text",
      functionResult: result,
      timestamp: new Date(),
    });

    // Build messages and call LLM with the function result
    const messages = this.buildLLMMessages();
    const response = await this.callLLM(messages);

    if (response.content) {
      this.addMessage({
        role: "ai",
        content: response.content,
        contentType: "text",
        timestamp: new Date(),
      });
    }

    this.context.updatedAt = new Date();
    return response;
  }

  /**
   * Add a system message (e.g., for escalation context).
   */
  addSystemMessage(content: string): void {
    this.addMessage({
      role: "system",
      content,
      contentType: "text",
      timestamp: new Date(),
    });
  }

  /**
   * Update customer information gathered during the conversation.
   */
  updateCustomerInfo(info: Partial<CustomerInfo>): void {
    this.context.customerInfo = {
      ...(this.context.customerInfo || {}),
      ...info,
    };
  }

  /**
   * Get the conversation summary for handoff/escalation.
   */
  getSummary(): string {
    const info = this.context.customerInfo;
    const parts: string[] = [];
    if (info?.name) parts.push(`Customer: ${info.name}`);
    if (info?.phone) parts.push(`Phone: ${info.phone}`);
    if (info?.email) parts.push(`Email: ${info.email}`);
    parts.push(`Language: ${this.context.language}`);
    parts.push(`Channel: ${this.context.channel}`);
    parts.push(`Messages: ${this.context.messageHistory.length}`);
    return parts.join(" | ");
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private addMessage(msg: ConversationMessage): void {
    this.context.messageHistory.push(msg);
  }

  /**
   * Build the message array for the LLM call, including system prompt and
   * truncated history.
   */
  private buildLLMMessages(): ChatCompletionMessageParam[] {
    const systemPrompt = buildSystemPrompt(this.orgConfig, {
      language: this.context.language,
      channel: this.context.channel,
    });

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Truncate history to stay within token budget
    const history = this.context.messageHistory.slice(-MAX_HISTORY_MESSAGES);

    for (const msg of history) {
      switch (msg.role) {
        case "customer":
          messages.push({ role: "user", content: msg.content }); // fixed: use "user" role
          break;
        case "ai":
          messages.push({ role: "assistant", content: msg.content });
          break;
        case "system":
          messages.push({ role: "system", content: msg.content });
          break;
        case "human":
          messages.push({ role: "assistant", content: `[Human agent]: ${msg.content}` });
          break;
      }
    }

    return messages;
  }

  /**
   * Call the OpenAI API with function calling enabled.
   */
  private async callLLM(
    messages: ChatCompletionMessageParam[],
  ): Promise<LLMResponse> {
    const client = getOpenAI();
    const model = this.orgConfig.aiModel || "gpt-4o";

    // Get the function definitions from the registry
    const functions = getFunctionDefinitions(this.orgConfig);

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        tools: functions.map((fn) => ({
          type: "function" as const,
          function: {
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
          },
        })),
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 500,
      });

      const choice = response.choices[0];
      if (!choice) {
        return { content: "I'm sorry, I couldn't process that. Could you please repeat yourself?" };
      }

      const result: LLMResponse = {
        content: choice.message.content,
      };

      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        result.toolCalls = choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        }));
      }

      return result;
    } catch (error) {
      console.error("OpenAI API error:", error);
      return {
        content: "I apologize, but I'm having trouble connecting. Let me transfer you to a team member.",
        toolCalls: [
          {
            id: "fallback-escalation",
            name: "transfer_to_human",
            arguments: {
              reason: "LLM API error",
              urgency: "medium",
              summary: "AI system encountered an error during processing.",
            },
          },
        ],
      };
    }
  }
}

// ─── Session Store ───────────────────────────────────────────────────────────

/**
 * Simple in-memory session store for conversation managers.
 * In production, this would be backed by Redis or PostgreSQL.
 */
class SessionStore {
  private sessions = new Map<string, ConversationManager>();

  get(conversationId: string): ConversationManager | undefined {
    return this.sessions.get(conversationId);
  }

  set(conversationId: string, manager: ConversationManager): void {
    this.sessions.set(conversationId, manager);
  }

  delete(conversationId: string): void {
    this.sessions.delete(conversationId);
  }

  /**
   * Get or create a conversation manager.
   */
  getOrCreate(
    conversationId: string,
    orgConfig: OrganizationConfig,
    channel: Channel,
  ): ConversationManager {
    const existing = this.sessions.get(conversationId);
    if (existing) return existing;

    const manager = new ConversationManager(orgConfig, channel);
    // Use the provided conversationId instead of generating a new one
    manager.context.conversationId = conversationId;
    this.sessions.set(conversationId, manager);
    return manager;
  }
}

export const sessionStore = new SessionStore();