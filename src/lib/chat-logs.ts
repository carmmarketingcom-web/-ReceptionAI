/**
 * Chat conversation logging using a JSON file.
 * Logs every chat conversation and flags low-confidence / fallback responses
 * for owner review. Simple file-based storage — no database needed.
 */
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const LOGS_FILE = path.join(DATA_DIR, "chat-logs.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
  if (!fs.existsSync(LOGS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOGS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeLogs(logs: ChatLogEntry[]) {
  ensureDataDir();
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
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
