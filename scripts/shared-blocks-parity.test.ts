/**
 * The two serve.ts trees must agree, byte for byte, on everything the notification path
 * touches.
 *
 * Run:  cd /tmp/receptionai-live && bun run test scripts/shared-blocks-parity.test.ts
 *
 * Why this exists: `serve.ts` (Railway, www.receptionai.store) and `site/serve.ts` (the
 * cto.new deployment) each carry their own copy of the notification code — sendSms(),
 * deliverOwnerNotification(), the email sender, the balance watchdog, the SMS bodies. They
 * drifted before: site/serve.ts was missing the /api/settings handler entirely, so the
 * dashboard could read organizations.sms_enabled on one deployment and not on the other.
 * Any edit to this code has to land in both files identically, and this test is the thing
 * that says whether it did.
 *
 * It compares extracted source text, not behaviour: the shared blocks are expected to be
 * literally the same characters.
 */
import { test, expect } from "bun:test";
import { join, resolve } from "node:path";

// Test the tree this file lives in (a clone, a CI checkout, whatever) — not a fixed path.
const REPO = process.env.RECEPTIONAI_REPO ? resolve(process.env.RECEPTIONAI_REPO) : join(import.meta.dir, "..");
const root = await Bun.file(`${REPO}/serve.ts`).text();
const site = await Bun.file(`${REPO}/site/serve.ts`).text();

/** Pull `function NAME(...) {...}` out of a tree, brace-matched (params may hold braces). */
function grabFunction(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`function not found: ${name}`);
  let parens = 0;
  let open = -1;
  for (let i = src.indexOf("(", at); i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) { open = src.indexOf("{", i); break; }
    }
  }
  if (open < 0) throw new Error(`no body for ${name}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  throw new Error(`unbalanced body for ${name}`);
}

/** Pull everything between two markers (used for route handlers and helper blocks). */
function grabBetween(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  if (a < 0) throw new Error(`marker not found: ${start}`);
  const b = src.indexOf(end, a);
  if (b < 0) throw new Error(`end marker not found: ${end}`);
  return src.slice(a, b);
}

// ── Functions every notification / alert path is built from ─────────────────
const SHARED_FUNCTIONS = [
  // sender selection (the ONE shared toll-free line)
  "notificationSmsSender",
  "smsSenderForOrg",
  // the delivery primitives and their health snapshots
  "sendSms",
  "deliverEmail",
  "emailDeliverySnapshot",
  "smsDeliverySnapshot",
  "smsEnabledForOrg",
  // owner notifications
  "deliverOwnerNotification",
  "sendEmailNotification",
  "callEmailSubject",
  "callEmailBody",
  "notifyOwnerOfVoicemail",
  // platform alerts (support, web-chat callbacks, balance watchdog)
  "platformAlertEmailRecipients",
  "platformAlertOrgId",
  "emailPlatformAlert",
  "deliverPlatformAlert",
  "sendSupportAlert",
  "notifyOwnerOfSupportRequest",
  "runBalanceCheck",
  "fetchTelnyxBalance",
  // the bodies, and the GSM-7 discipline they depend on
  "buildCallSummary",
  "gsm7Safe",
  "smsPartCount",
  "truncateWords",
  "buildReminderMessage",
  "createVoiceBooking",
];

test("every shared notification function is byte-identical in both serve.ts trees", () => {
  const drifted: string[] = [];
  for (const name of SHARED_FUNCTIONS) {
    const a = grabFunction(root, name);
    let b: string;
    try {
      b = grabFunction(site, name);
    } catch {
      drifted.push(`${name} — missing from site/serve.ts`);
      continue;
    }
    if (a !== b) drifted.push(`${name} — differs`);
  }
  expect(drifted).toEqual([]);
});

test("/api/settings (GET + PUT) exists in both trees and is identical", () => {
  const rootBlock = grabBetween(
    root,
    '        if (pathname === "/api/settings" && req.method === "GET") {',
    '        if (pathname === "/api/billing" && req.method === "GET") {',
  );
  // site/serve.ts has no /api/billing route, so the block runs up to the next route there.
  const siteBlock = grabBetween(
    site,
    '        if (pathname === "/api/settings" && req.method === "GET") {',
    '        if (pathname === "/api/contacts" && req.method === "GET") {',
  );
  expect(siteBlock).toBe(rootBlock);
  // The dashboard's texting toggle depends on this field being exposed on both deployments.
  expect(siteBlock).toContain("smsEnabled");
  expect(siteBlock).toContain('if (pathname === "/api/settings" && req.method === "PUT")');
});

test("the json() and requireOrgAuth() helpers are identical in both trees", () => {
  for (const name of ["json", "requireOrgAuth"]) {
    expect({ name, body: grabFunction(site, name) }).toEqual({ name, body: grabFunction(root, name) });
  }
});

test("every outbound text goes through the shared sender, in both trees", () => {
  const ALLOWED = new Set(["from", "smsSenderForOrg", "notificationSmsSender"]);
  for (const [label, src] of [["serve.ts", root], ["site/serve.ts", site]] as const) {
    // `sendSms()` with nothing after it is prose in a comment, not a call.
    const callees = [...src.matchAll(/sendSms\(([A-Za-z_][\w.]*)?/g)]
      .map((m) => m[1] || "")
      .filter(Boolean);
    const stray = callees.filter((c) => !ALLOWED.has(c));
    expect({ tree: label, stray }).toEqual({ tree: label, stray: [] });
    // `from` is sendSms()'s own parameter, so exactly one occurrence is the definition.
    expect(callees.filter((c) => c === "from").length).toBe(1);
    expect(callees.length).toBeGreaterThan(5);

    // The shared number, from env with the 833 as the constant fallback.
    expect(src).toContain('const SHARED_SMS_SENDER_FALLBACK = "+18339261247";');
    expect(src).toContain('(process.env.TELNYX_SMS_SENDER || "").trim()');
  }
});

test("no personal number is hardcoded — only the platform's own two public lines", () => {
  // +18339261247 is the shared toll-free notification sender (owner decision 2026-11-03);
  // +17279667556 is the public demo line. Neither is anybody's personal number, and the
  // owner's own mobile is env-only (organizations.phone), never source.
  const numbers = new Set<string>();
  for (const src of [root, site]) {
    for (const m of src.matchAll(/\+1\d{10}/g)) numbers.add(m[0]);
  }
  expect([...numbers].sort()).toEqual(["+17279667556", "+18339261247"]);
});
