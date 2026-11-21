// Demo line: voicemail records, press 9 is idempotent, a press counts when it is pressed, and a
// retried webhook delivery does nothing twice (owner report 2026-11-21, call gocQWM3A).
//
// Replays the exact Telnyx call-control events of that call against the REAL serve.ts with
// Postgres, Telnyx and email replaced, so every claim below is read from the commands the server
// actually issues. Nothing here dials, texts or emails anyone.
import { test, expect, beforeAll, mock } from "bun:test";

const PORT = 3219;
const BASE = `http://127.0.0.1:${PORT}`;
process.env.PORT = String(PORT);
process.env.JWT_SECRET = "x".repeat(48);
process.env.DATABASE_URL = "postgres://fake/fake";
process.env.TELNYX_API_KEY = "KEY_fake";
process.env.TELNYX_CONNECTION_ID = "conn_fake";
process.env.HOST = `127.0.0.1:${PORT}`;
process.env.COMPANY_NAME = "Acme Air";
process.env.REMINDER_TIMER = "off";

const realFetch = globalThis.fetch.bind(globalThis);
const DEMO = "+17279667556";       // the public demo line — the number the owner called
const BUSINESS = "+17279101304";   // a real business line (org1), not the demo

type Action = { action: string; cid: string; body: any };
const actions: Action[] = [];
const emails: { subject: string; kind: string; body: string }[] = [];
const recordings: string[] = [];

// ── Fake Postgres ──────────────────────────────────────────────────────────
function sqlTag(strings: any, ...params: any[]): Promise<any[]> {
  const text = typeof strings === "string"
    ? strings
    : strings.reduce((a: string, s: string, i: number) => a + s + (i < params.length ? "$" + (i + 1) : ""), "");
  const t = text.replace(/\s+/g, " ").trim();
  if (/FROM phone_numbers pn/i.test(t)) return Promise.resolve([{ name: "Testing Industries", org_id: "org1" }]);
  if (/FROM phone_numbers/i.test(t)) return Promise.resolve([{ id: "pn1" }]);
  if (/INSERT INTO conversations/i.test(t)) return Promise.resolve([]);
  if (/INSERT INTO recordings/i.test(t)) { recordings.push(JSON.stringify(params)); return Promise.resolve([]); }
  if (/UPDATE conversations/i.test(t)) return Promise.resolve([]);
  if (/FROM organizations/i.test(t)) return Promise.resolve([{ email: "owner@example.com", sms_enabled: false }]);
  if (/FROM users/i.test(t)) return Promise.resolve([{ email: "owner@example.com" }]);
  if (/FROM contacts/i.test(t)) return Promise.resolve([]);
  return Promise.resolve([]);
}
mock.module("@neondatabase/serverless", () => ({ neon: () => sqlTag }));
// Email is the only channel this file cares about: record it, never send it.
mock.module("../src/lib/email-delivery", () => ({
  deliverEmail: async (_to: string, subject: string, body: string, kind: string) => {
    emails.push({ subject, body, kind });
    return true;
  },
  recordEmailDelivery: async () => true,
  ensureEmailDeliveriesTable: async () => true,
  emailDeliveryDb: () => null,
}));

// ── Fake Telnyx ────────────────────────────────────────────────────────────
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : String(input?.url || input);
  const json = (obj: any) => new Response(JSON.stringify(obj), { status: 200, headers: { "Content-Type": "application/json" } });
  if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
  const m = url.match(/\/calls\/([^/]+)\/actions\/([^/?]+)/);
  if (m) {
    actions.push({ action: m[2], cid: m[1], body: init?.body ? JSON.parse(init.body) : {} });
    return json({ data: {} });
  }
  if (/balance/i.test(url)) return json({ data: { balance: "25.00", available_credit: "25.00", currency: "USD" } });
  return json({ data: {} });
}) as any;

async function postEvent(event_type: string, payload: any, id?: string) {
  const data: any = { event_type, payload };
  if (id) data.id = id;
  return realFetch(`${BASE}/api/telnyx/voice`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cmds = (mark: number, cid: string, action: string) =>
  actions.slice(mark).filter((a) => a.action === action && a.cid === cid);
const speaks = (mark: number, cid: string) =>
  actions.slice(mark).filter((a) => a.action === "speak" && a.cid === cid);
const spoken = (mark: number, cid: string) => speaks(mark, cid).map((a) => String(a.body.payload || "")).join(" ");

// Replay `call.speak.ended` once per speak the server queued, the way Telnyx does.
async function finishSpeaking(cid: string, mark: number) {
  let m = mark;
  for (let round = 0; round < 4; round++) {
    const queued = actions.slice(m).filter((a) => a.action === "speak" && a.cid === cid);
    if (queued.length === 0) return;
    m = actions.length;
    for (let i = 0; i < queued.length; i++) {
      await postEvent("call.speak.ended", { call_control_id: cid });
      await wait(60);
    }
  }
}

// One inbound call: answer, language question, then the caller presses a key.
async function ringAndChoose(to: string, digit: string) {
  const cid = `sim-${to}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const from = "+17278593332"; // the owner's phone on 2026-11-21
  await postEvent("call.initiated", { call_control_id: cid, to, from });
  await wait(900); // the opening prompt is issued from a 600 ms timer
  const mark = actions.length;
  await postEvent("call.dtmf.received", { call_control_id: cid, digit, to, from });
  await wait(500);
  return { cid, from, mark };
}

let mod: any;
beforeAll(async () => {
  mod = await import("../serve.ts");
  for (let i = 0; i < 80; i++) {
    try { const r = await realFetch(`${BASE}/api/health`); if (r.ok) return; } catch {}
    await wait(100);
  }
  throw new Error("serve.ts did not boot");
}, 30000);

test("A+B: press 9 on the demo line really records — no timeout_secs, a 60 s cap, and no email", async () => {
  const { cid, mark } = await ringAndChoose(DEMO, "2");
  await wait(700);
  const pressMark = actions.length;
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "9" });
  await wait(1400); // the prompt plays, then record_start is issued 800 ms later

  const prompt = spoken(pressMark, cid);
  expect(prompt).toContain("deje su mensaje");
  const starts = cmds(pressMark, cid, "record_start");
  expect(starts.length).toBe(1);
  const body = starts[0].body;
  console.log("[sim] record_start body:", JSON.stringify(body));
  expect(body.timeout_secs).toBeUndefined();   // 90053: refused while the call is transcribed
  expect(body.max_length).toBe(60);            // the hard cap, enforced by Telnyx
  expect(body.play_beep).toBe(true);

  // The demo line stores nothing and emails nobody — the owner's four false alerts came from here.
  expect(emails.length).toBe(0);
  expect(recordings.length).toBe(0);
}, 60000);

test("B: four 9 presses are one prompt, one record_start and zero emails", async () => {
  const { cid } = await ringAndChoose(DEMO, "1");
  await wait(700);
  const mark = actions.length;
  for (let i = 0; i < 4; i++) {
    await postEvent("call.dtmf.received", { call_control_id: cid, digit: "9" });
    await wait(900); // longer than the 700 ms duplicate-digit guard: these are four real presses
  }
  await wait(1200);
  const prompts = speaks(mark, cid).filter((a) => /mensaje|leave your message/i.test(String(a.body.payload || "")));
  console.log("[sim] voicemail prompts spoken:", prompts.length);
  expect(prompts.length).toBe(1);
  expect(cmds(mark, cid, "record_start").length).toBe(1);
  expect(emails.length).toBe(0);
}, 60000);

test("B: a business line is emailed once, and only after the recording really exists", async () => {
  const { cid, from, mark } = await ringAndChoose(BUSINESS, "1");
  await wait(700);
  const pressMark = actions.length;
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "9" });
  await wait(1400);
  expect(cmds(pressMark, cid, "record_start").length).toBe(1);
  // Nothing was recorded yet, so the owner must not have been told anything.
  expect(emails.length).toBe(0);

  await postEvent("call.recording.saved", {
    call_control_id: cid,
    recording_id: "rec_123",
    recording_urls: { mp3: "https://example.invalid/rec_123.mp3" },
    duration_millis: "4200",
  });
  await wait(600);
  console.log("[sim] owner emails:", JSON.stringify(emails.map((e) => e.subject)));
  expect(emails.length).toBe(1);
  expect(emails[0].subject).toContain("New voicemail from " + from);
  expect(recordings.length).toBe(1); // the audio landed in the dashboard
  expect(spoken(pressMark, cid)).toContain("We received your message");
  await postEvent("call.hangup", { call_control_id: cid, to: BUSINESS, from });
  await wait(300);
}, 60000);

test("C: the listener is armed before the prompt and a press flushes the queued menu", async () => {
  const cid = `sim-listen-${Date.now()}`;
  const from = "+17278593332";
  await postEvent("call.initiated", { call_control_id: cid, to: DEMO, from });
  await wait(900);

  // The opening question is pressable while it plays: the listener carries initial_timeout_millis.
  const gathers = cmds(0, cid, "gather");
  console.log("[sim] gathers on the opening question:", JSON.stringify(gathers.map((g) => g.body)));
  expect(gathers.length).toBeGreaterThanOrEqual(1);
  expect(gathers[0].body.initial_timeout_millis).toBeGreaterThan(8000);

  // English, then press 2 for pricing: the answer's first line drops whatever is still queued.
  const mark = actions.length;
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "1" });
  await wait(600);
  const answerMark = actions.length;
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "2" });
  await wait(600);
  const answer = speaks(answerMark, cid);
  console.log("[sim] first answer speak stop:", JSON.stringify(answer[0]?.body?.stop));
  expect(answer.length).toBeGreaterThan(0);
  expect(answer[0].body.stop).toBe("all");
  expect(String(answer[0].body.payload || "").length).toBeGreaterThan(0);
  await postEvent("call.hangup", { call_control_id: cid, to: DEMO, from });
  await wait(300);
}, 60000);

test("D: a retried delivery (same event id) re-speaks nothing and re-emails nothing", async () => {
  const cid = `sim-retry-${Date.now()}`;
  const from = "+17278593332";
  const eventId = "evt-" + Date.now();
  await postEvent("call.initiated", { call_control_id: cid, to: BUSINESS, from }, eventId);
  await wait(900);
  const first = actions.length;
  // Telnyx retries the SAME event because the first response was slow.
  const res = await postEvent("call.initiated", { call_control_id: cid, to: BUSINESS, from }, eventId);
  expect(res.status).toBe(200);
  await wait(700);
  console.log("[sim] actions from the retried delivery:", actions.slice(first).length);
  expect(actions.slice(first).length).toBe(0);
  await postEvent("call.hangup", { call_control_id: cid, to: BUSINESS, from });
  await wait(300);
}, 60000);

test("nothing is spoken into a call that has already hung up", async () => {
  const { cid, from, mark } = await ringAndChoose(DEMO, "1");
  await postEvent("call.hangup", { call_control_id: cid, to: DEMO, from });
  await wait(400);
  const after = actions.length;
  // A prompt that was queued on a timer must not reach Telnyx once the leg is gone.
  await wait(1200);
  expect(actions.slice(after).filter((a) => a.cid === cid && a.action === "speak").length).toBe(0);
  expect(mark).toBeGreaterThan(0);
}, 60000);
