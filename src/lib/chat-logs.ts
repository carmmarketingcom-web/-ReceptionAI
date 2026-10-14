/**
 * Chat conversation logging using a JSON file.
 * Logs every chat conversation and flags low-confidence / fallback responses
 * for owner review. Simple file-based storage — no database needed.
 */
import fs from "fs";
import path from "path";

/**
 * Paths are resolved lazily (and browser-safely). This module is imported by
 * API routes that the TanStack Router statically pulls into the CLIENT bundle,
 * so nothing here may touch Node globals (process/fs/path) at module scope —
 * doing so crashes hydration in every browser ("process is not defined").
 */
let cachedPaths: { dataDir: string; logsFile: string } | null = null;

function getPaths(): { dataDir: string; logsFile: string } {
  if (!cachedPaths) {
    const dataDir =
      typeof process !== "undefined" && typeof process.cwd === "function"
        ? path.join(process.cwd(), "data")
        : "data";
    cachedPaths = { dataDir, logsFile: path.join(dataDir, "chat-logs.json") };
  }
  return cachedPaths;
}

function ensureDataDir() {
  if (typeof process === "undefined") return;
  const { dataDir } = getPaths();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

interface ChatLogEntry {
  id: number;
  sessionId: string;
  question: string;
  answer: string;
  isFallback: boolean;
  language: string;
  reviewed: boolean;
  reviewedAnswer: string | null;
  createdAt: string;
}

function readLogs(): ChatLogEntry[] {
  ensureDataDir();
  if (typeof process === "undefined") return [];
  const { logsFile } = getPaths();
  if (!fs.existsSync(logsFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(logsFile, "utf-8"));
  } catch {
    return [];
  }
}

function writeLogs(logs: ChatLogEntry[]) {
  ensureDataDir();
  if (typeof process === "undefined") return;
  const { logsFile } = getPaths();
  fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));
}

const FALLBACK_PHRASES = [
  "I'm not sure how to answer that",
  "I'm having trouble connecting",
  "Something went wrong",
  "Can you rephrase",
  "I don't have that information",
];

export function isFallbackResponse(answer: string): boolean {
  const lower = answer.toLowerCase();
  return FALLBACK_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()));
}

export function logConversation(
  sessionId: string,
  question: string,
  answer: string,
  language: string = "en",
): number {
  try {
    const logs = readLogs();
    const id = logs.length > 0 ? Math.max(...logs.map((l) => l.id)) + 1 : 1;
    const entry: ChatLogEntry = {
      id,
      sessionId,
      question: question.trim(),
      answer: answer.trim(),
      isFallback: isFallbackResponse(answer),
      language,
      reviewed: false,
      reviewedAnswer: null,
      createdAt: new Date().toISOString(),
    };
    logs.push(entry);
    // Keep only last 1000 entries
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    writeLogs(logs);
    return id;
  } catch (err) {
    console.error("[ChatLogs] Failed to log conversation:", String(err).slice(0, 200));
    return 0;
  }
}

export function getUnreviewedFallbacks(limit: number = 50): ChatLogEntry[] {
  try {
    const logs = readLogs();
    return logs
      .filter((l) => l.isFallback && !l.reviewed)
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function getAllLogs(limit: number = 100, offset: number = 0): ChatLogEntry[] {
  try {
    const logs = readLogs();
    return logs.reverse().slice(offset, offset + limit);
  } catch {
    return [];
  }
}

export function markReviewed(id: number, reviewedAnswer?: string): boolean {
  try {
    const logs = readLogs();
    const entry = logs.find((l) => l.id === id);
    if (!entry) return false;
    entry.reviewed = true;
    if (reviewedAnswer) {
      entry.reviewedAnswer = reviewedAnswer.trim();
    }
    writeLogs(logs);
    return true;
  } catch {
    return false;
  }
}

export function getStats(): { total: number; fallbacks: number; unreviewed: number } {
  try {
    const logs = readLogs();
    const total = logs.length;
    const fallbacks = logs.filter((l) => l.isFallback).length;
    const unreviewed = logs.filter((l) => l.isFallback && !l.reviewed).length;
    return { total, fallbacks, unreviewed };
  } catch {
    return { total: 0, fallbacks: 0, unreviewed: 0 };
  }
}

/**
 * Returns reviewed answers as knowledge snippets that can be injected
 * into the AI's context to answer previously-unknown questions.
 */
export function getReviewedKnowledge(): string[] {
  try {
    const logs = readLogs();
    return logs
      .filter((l) => l.reviewed && l.reviewedAnswer)
      .reverse()
      .slice(0, 50)
      .map((l) => `Q: ${l.question}\nA: ${l.reviewedAnswer}`);
  } catch {
    return [];
  }
}
