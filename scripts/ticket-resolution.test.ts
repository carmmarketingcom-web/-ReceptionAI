/**
 * Closing the loop on a support ticket.
 *
 * Part 1 — the emails: what a customer actually reads when we resolve a ticket, reply to one,
 *          or send them a copy. Pure builders, so no network is involved.
 * Part 2 — PATCH /api/support/tickets against the REAL serve.ts, with Postgres replaced by
 *          bun:sqlite and the email provider stubbed, so no production row is touched:
 *          the happy path (resolve → status, resolution, resolved_at, customer emailed),
 *          a reply, a ticket with no email address, a bad status, and a cross-org 404.
 *
 * Run: bun run test scripts/ticket-resolution.test.ts
 */
import { test, expect, mock, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import {
  buildReplyEmail,
  buildResolutionEmail,
  buildTicketCopyEmail,
  DEFAULT_RESOLUTION_LINE,
} from "../src/lib/support-ticket-email";

const REPO = process.env.RECEPTIONAI_REPO || join(import.meta.dir, "..");
const PORT = 3218;
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = "ticket-resolution-test-secret-0123456789abcdef";
const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const TICKET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TICKET_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TICKET_NO_EMAIL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER = "customer@example.test";

process.env.PORT = String(PORT);
process.env.JWT_SECRET = JWT_SECRET;
process.env.DATABASE_URL = "postgres://fake/fake";
process.env.RESEND_API_KEY = "test-resend-key";

// ── Part 1: the emails ───────────────────────────────────────────────────────

test("a resolved ticket tells the customer what was done", () => {
  const mail = buildResolutionEmail({
    id: TICKET_A,
    subject: "A booking landed on the wrong day",
    message: "The AI booked 3pm on Tuesday but the customer arrived on Monday.",
    createdAt: "2026-11-19T17:22:12.393Z",
    openedByEmail: CUSTOMER,
    businessName: "Carm Marketing LLC",
    resolution: "Fixed the calendar timezone on your account and moved the booking.",
  });
  expect(mail).not.toBeNull();
  expect(mail!.to).toBe(CUSTOMER);
  expect(mail!.subject).toBe("Your ReceptionAI support ticket #aaaaaaaa has been resolved");
  expect(mail!.replyTo).toBe("hello@receptionai.store");
  expect(mail!.text).toContain("You reported this to Carm Marketing LLC on 19 November 2026:");
  expect(mail!.text).toContain('  "A booking landed on the wrong day"');
  expect(mail!.text).toContain("What we did:");
  expect(mail!.text).toContain("  Fixed the calendar timezone on your account and moved the booking.");
  expect(mail!.text).toContain("If it happens again, reply to this email and we will reopen the ticket.");
  expect(mail!.text).toContain("Ticket: #aaaaaaaa");
  // No time promises anywhere — we have not measured a response time.
  expect(mail!.text.toLowerCase()).not.toContain("within");
});

test("an empty resolution still says something true", () => {
  const mail = buildResolutionEmail({
    id: TICKET_A,
    subject: "Texts never arrived",
    message: "I never got a text.",
    createdAt: "2026-11-19T17:22:12.393Z",
    openedByEmail: CUSTOMER,
    businessName: "Carm Marketing LLC",
    resolution: "   ",
  });
  expect(mail).not.toBeNull();
  expect(mail!.text).toContain(DEFAULT_RESOLUTION_LINE);
  expect(mail!.text).toContain("What we did:");
});

test("a ticket with no email address sends nothing and does not throw", () => {
  const input = {
    id: TICKET_NO_EMAIL,
    subject: "A phone-only business",
    message: "No address on the record.",
    createdAt: "2026-11-19T17:22:12.393Z",
    openedByEmail: null,
    businessName: "Phone Only LLC",
    resolution: "Nothing to send it to.",
    teamReply: "Nothing to send it to.",
  };
  expect(buildResolutionEmail(input)).toBeNull();
  expect(buildReplyEmail(input)).toBeNull();
  expect(buildTicketCopyEmail(input)).toBeNull();
});

test("a reply carries the reply text under a Re: subject", () => {
  const mail = buildReplyEmail({
    id: TICKET_A,
    subject: "Press 3 did nothing",
    createdAt: "2026-11-19T17:22:12.393Z",
    openedByEmail: CUSTOMER,
    businessName: "Carm Marketing LLC",
    teamReply: "We re-attached the outbound voice profile — press 3 rings your line now.",
  });
  expect(mail).not.toBeNull();
  expect(mail!.subject).toBe("Re: your ReceptionAI support ticket #aaaaaaaa");
  expect(mail!.text).toContain("Our reply:");
  expect(mail!.text).toContain("  We re-attached the outbound voice profile");
});

test("the copy carries the record, the resolution and the dates", () => {
  const mail = buildTicketCopyEmail({
    id: TICKET_A,
    subject: "A booking landed on the wrong day",
    message: "The AI booked 3pm on Tuesday.",
    createdAt: "2026-11-19T17:22:12.393Z",
    openedByEmail: CUSTOMER,
    businessName: "Carm Marketing LLC",
    status: "resolved",
    resolution: "Moved the booking.",
    resolvedAt: "2026-11-19T18:00:00.000Z",
    teamReply: "Looking into it.",
    repliedAt: "2026-11-19T17:30:00.000Z",
    contextText: "Organization: Carm Marketing LLC",
  });
  expect(mail).not.toBeNull();
  expect(mail!.text).toContain("Status: resolved");
  expect(mail!.text).toContain("Resolved: 19 November 2026");
  expect(mail!.text).toContain("We replied: 19 November 2026");
  expect(mail!.text).toContain("Moved the booking.");
  expect(mail!.text).toContain("Organization: Carm Marketing LLC");
});

// ── Part 2: the endpoint, against the real serve.ts ──────────────────────────

const db = new Database(":memory:");
db.run(`CREATE TABLE organizations (
  id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, timezone TEXT,
  slug TEXT, sms_enabled INTEGER DEFAULT 0, created_at TEXT
)`);
db.run(
  `INSERT INTO organizations (id, name, phone, email, timezone, slug, sms_enabled, created_at)
   VALUES ('${ORG_A}', 'Carm Marketing LLC', '+15550000009', 'owner@example.test',
           'America/New_York', 'carm', 0, '2026-01-01T00:00:00Z'),
          ('${ORG_B}', 'Other Business', '+15550000010', 'other@example.test',
           'America/New_York', 'other', 0, '2026-01-01T00:00:00Z')`,
);

function translate(text: string): string {
  return text
    .replace(/::(jsonb|text|uuid|timestamptz|conversation_status)/g, "")
    .replace(/NOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/gen_random_uuid\(\)/gi, "'00000000-0000-4000-8000-000000000000'");
}

function sqlTag(strings: TemplateStringsArray, ...params: any[]) {
  const text = translate(strings.reduce((a, s, i) => a + s + (i < params.length ? "?" : ""), ""));
  const stmt = db.query(text);
  // RETURNING makes a write behave like a read: the rows are the point.
  if (/^\s*select/i.test(text) || /returning/i.test(text)) {
    return Promise.resolve(stmt.all(...params));
  }
  stmt.run(...params);
  return Promise.resolve([]);
}

const realFetch = globalThis.fetch.bind(globalThis);
const sent: { to: string; subject: string; text: string; replyTo?: string }[] = [];

beforeAll(async () => {
  mock.module("@neondatabase/serverless", () => ({ neon: () => sqlTag }));
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : String(input?.url || "");
    if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
    if (url.includes("api.resend.com")) {
      const body = JSON.parse(String(init?.body || "{}"));
      sent.push({ to: body.to, subject: body.subject, text: body.text, replyTo: body.reply_to });
      return new Response(JSON.stringify({ id: "test" }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  process.chdir(REPO);
  await import("../serve.ts");
  // Wait for the server to answer, then let it create support_tickets.
  for (let i = 0; i < 60; i++) {
    try {
      const res = await realFetch(`${BASE}/api/health`);
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
});

async function token(orgId: string): Promise<string> {
  const { SignJWT } = await import("jose");
  return await new SignJWT({ organizationId: orgId, userId: "u-1", role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(JWT_SECRET));
}

function seedTickets() {
  const insert = db.query(
    `INSERT INTO support_tickets
       (id, organization_id, opened_by_email, category, severity, subject, message, context, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insert.run(
    TICKET_A,
    ORG_A,
    CUSTOMER,
    "calls",
    "normal",
    "A booking landed on the wrong day",
    "The AI booked 3pm on Tuesday but the customer arrived on Monday.",
    JSON.stringify({ organization: { id: ORG_A, name: "Carm Marketing LLC" } }),
    "open",
    "2026-11-19T17:22:12.393Z",
    "2026-11-19T17:22:12.393Z",
  );
  insert.run(
    TICKET_B,
    ORG_B,
    "other-customer@example.test",
    "billing",
    "normal",
    "Someone else's ticket",
    "This belongs to another business.",
    JSON.stringify({ organization: { id: ORG_B, name: "Other Business" } }),
    "open",
    "2026-11-19T17:22:12.393Z",
    "2026-11-19T17:22:12.393Z",
  );
  insert.run(
    TICKET_NO_EMAIL,
    ORG_A,
    null,
    "other",
    "question",
    "Reported from a phone-only business",
    "There is no address on this ticket.",
    JSON.stringify({ organization: { id: ORG_A, name: "Carm Marketing LLC" } }),
    "open",
    "2026-11-19T17:22:12.393Z",
    "2026-11-19T17:22:12.393Z",
  );
}

function rowOf(id: string): any {
  return db.query(`SELECT * FROM support_tickets WHERE id = ?`).get(id);
}

async function patch(body: Record<string, unknown>, orgId = ORG_A) {
  const t = await token(orgId);
  return await realFetch(`${BASE}/api/support/tickets`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify(body),
  });
}

test("GET creates the table, then the seeded rows are there", async () => {
  const t = await token(ORG_A);
  const res = await realFetch(`${BASE}/api/support/tickets`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  expect(res.status).toBe(200);
  seedTickets();
  const body = await res.json();
  expect(Array.isArray(body.tickets)).toBe(true);
});

test("resolving a ticket stores what we did and emails the customer", async () => {
  sent.length = 0;
  const res = await patch({
    id: TICKET_A,
    status: "resolved",
    resolution: "Fixed the calendar timezone on your account.",
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.ticket.status).toBe("resolved");
  expect(body.ticket.resolution).toBe("Fixed the calendar timezone on your account.");
  expect(body.ticket.resolvedAt).toBeTruthy();
  expect(body.resolutionEmailed).toBe(true);

  const row = rowOf(TICKET_A);
  expect(row.status).toBe("resolved");
  expect(row.resolution).toBe("Fixed the calendar timezone on your account.");
  expect(row.resolved_at).toBeTruthy();

  const mail = sent.find((m) => m.subject.includes("has been resolved"));
  expect(mail).toBeTruthy();
  expect(mail!.to).toBe(CUSTOMER);
  expect(mail!.replyTo).toBe("hello@receptionai.store");
  expect(mail!.subject).toContain("#aaaaaaaa");
  expect(mail!.text).toContain("Fixed the calendar timezone on your account.");
});

test("a reply moves the ticket to team replied and emails the reply", async () => {
  sent.length = 0;
  const res = await patch({ id: TICKET_A, reply: "We re-attached the outbound voice profile." });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ticket.status).toBe("team_replied");
  expect(body.ticket.teamReply).toBe("We re-attached the outbound voice profile.");
  expect(body.ticket.repliedAt).toBeTruthy();
  expect(body.replyEmailed).toBe(true);
  expect(sent.some((m) => m.subject.startsWith("Re: your ReceptionAI support ticket"))).toBe(true);
});

test("a ticket with no email address resolves without throwing and sends nothing", async () => {
  sent.length = 0;
  const res = await patch({ id: TICKET_NO_EMAIL, status: "resolved" });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ticket.status).toBe("resolved");
  expect(body.resolutionEmailed).toBe(false);
  expect(sent.length).toBe(0);
});

test("another org's ticket is a 404 and is left untouched", async () => {
  const res = await patch({ id: TICKET_B, status: "resolved", resolution: "not yours" }, ORG_A);
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.error).toBe("Ticket not found");
  expect(body.ticket).toBeUndefined();
  const row = rowOf(TICKET_B);
  expect(row.status).toBe("open");
  expect(row.resolution).toBeNull();
});

test("an unknown status is a 400", async () => {
  const res = await patch({ id: TICKET_A, status: "solved" });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toContain("status must be one of");
});

test("email me a copy sends the record and changes no status", async () => {
  sent.length = 0;
  const before = rowOf(TICKET_A);
  const res = await patch({ id: TICKET_A, copy: true });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.copyEmailed).toBe(true);
  expect(body.ticket.status).toBe(before.status);
  const mail = sent.find((m) => m.subject.includes("full record"));
  expect(mail).toBeTruthy();
  expect(mail!.text).toContain("Organization: Carm Marketing LLC");
});
