/**
 * The dashboard's System health page must be served by an ORG endpoint, in both trees.
 *
 * What went wrong (2026-11-04): `dashboard/health.tsx` called `GET /api/health` and read
 * `h.phoneStatus.provisioned`. In production `serve.ts` answers `/api/*` with inline
 * handlers that shadow `src/routes/api/*.ts`, and the inline `/api/health` is the PLATFORM
 * check — `{status, database, telnyx, stripe, telnyxBalance, smsDelivery, email, …}`. It has
 * no `phoneStatus`, so the page dereferenced `undefined.provisioned` and threw: a paying
 * customer opening System health got a blank page.
 *
 * This test is the one that would have caught it. It asserts, for BOTH serve.ts trees:
 *   - a `/api/health/org` handler exists, is org-authenticated, and is byte-identical;
 *   - the public `/api/health` payload is untouched (no phoneStatus, still platform-shaped);
 *   - `src/lib/org-health.ts` is byte-identical in both trees;
 *   - the payload actually contains EVERY field the page reads — extracted from the page
 *     source, not hand-listed, so a new field on the page fails this test until the
 *     endpoint returns it;
 *   - the normalizer cannot throw, including on the OLD platform payload (the actual bug).
 *
 * Run: bun run test scripts/dashboard-health-endpoint.test.ts
 */
import { test, expect } from "bun:test";
import { buildOrgHealth, normalizeOrgHealth } from "../src/lib/org-health";

// Resolve the repo from this file, not a hardcoded /tmp path, so the test runs in every
// checkout of the tree.
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const root = await Bun.file(`${REPO}/serve.ts`).text();
const site = await Bun.file(`${REPO}/site/serve.ts`).text();
const rootPage = await Bun.file(`${REPO}/src/routes/dashboard/health.tsx`).text();
const sitePage = await Bun.file(`${REPO}/site/src/routes/dashboard/health.tsx`).text();
const rootLib = await Bun.file(`${REPO}/src/lib/org-health.ts`).text();
const siteLib = await Bun.file(`${REPO}/site/src/lib/org-health.ts`).text();

/** Pull a route handler block out of a serve.ts tree, from its `if` up to `marker`. */
function grabHandler(src: string, needle: string, marker: string): string {
  const a = src.indexOf(needle);
  if (a < 0) throw new Error(`handler not found: ${needle}`);
  const b = src.indexOf(marker, a);
  if (b < 0) throw new Error(`end marker not found after ${needle}`);
  return src.slice(a, b);
}

const ORG_HANDLER = 'if (pathname === "/api/health/org" && req.method === "GET") {';
const PUBLIC_HANDLER = 'if (pathname === "/api/health" && req.method === "GET") {';
const PLATFORM_MARKER = "// ── Conversations API ─";

// ── 1. The endpoint exists, in both trees, byte-identically ─────────────────
test("/api/health/org exists in both serve.ts trees and the two handlers are byte-identical", () => {
  const a = grabHandler(root, ORG_HANDLER, "// ── Health API (public, no auth)");
  const b = grabHandler(site, ORG_HANDLER, "// ── Health API (public, no auth)");
  expect(a).toBe(b);

  // Org-authenticated, and it authenticates BEFORE it opens a database connection.
  expect(a).toContain("await requireOrgAuth(req)");
  expect(a.indexOf("requireOrgAuth")).toBeLessThan(a.indexOf("DATABASE_URL"));
  // Built from the one shared implementation — never a second copy of the queries.
  expect(a).toContain("buildOrgHealth(");
  expect(a).not.toContain("FROM conversations");
});

// ── 2. The public endpoint is untouched ────────────────────────────────────
test("the public GET /api/health payload is unchanged: platform shape, still no phoneStatus", () => {
  for (const [label, src] of [["serve.ts", root], ["site/serve.ts", site]] as const) {
    const block = grabHandler(src, PUBLIC_HANDLER, PLATFORM_MARKER);
    // The fields the balance watchdog, uptime monitors and the test suite rely on.
    for (const field of [
      "serverStatus.database",
      "serverStatus.telnyx",
      "serverStatus.stripe",
      "serverStatus.cronSecret",
      "serverStatus.telnyxBalance",
      "serverStatus.smsDelivery",
      "serverStatus.email",
    ]) {
      expect({ label, field, present: block.includes(field) }).toEqual({ label, field, present: true });
    }
    // …and it must NOT have grown an org section: that is what shadowed the page.
    expect({ label, hasOrgFields: block.includes("phoneStatus") }).toEqual({ label, hasOrgFields: false });
  }
});

// ── 3. One implementation, mirrored ────────────────────────────────────────
test("src/lib/org-health.ts is byte-identical in both trees", () => {
  expect(siteLib).toBe(rootLib);
  // Every org-scoped query is tenant-scoped: phone number, last call, demo count,
  // appointments — plus the organization row itself, keyed by id.
  expect((rootLib.match(/organization_id = \$\{organizationId\}/g) || []).length).toBe(4);
  expect(rootLib).toContain("WHERE id = ${organizationId}");
});

// ── 4. The page talks to the org endpoint, in both trees ───────────────────
test("both dashboard health pages fetch /api/health/org and never the platform endpoint", () => {
  for (const [label, src] of [["src", rootPage], ["site/src", sitePage]] as const) {
    expect({ label, org: src.includes('fetch("/api/health/org"') }).toEqual({ label, org: true });
    expect({ label, platform: src.includes('fetch("/api/health"') }).toEqual({ label, platform: false });
    // The page renders through the normalizer, so no field can be dereferenced raw.
    expect({ label, normalized: src.includes("normalizeOrgHealth") }).toEqual({ label, normalized: true });
  }
  expect(sitePage).toBe(rootPage);
});

// ── 5. Every field the page reads is in the payload ───────────────────────
// A fake `neon()` tagged-template: it answers by looking at the SQL text, so the test
// exercises the real builder without a database.
function fakeSql(rows: {
  org?: any;
  phone?: any;
  delivered?: number;
  call?: any;
  demoCalls?: number;
  upcoming?: number;
}) {
  return async (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    if (/FROM organizations/.test(text)) return rows.org ? [rows.org] : [];
    if (/FROM phone_numbers/.test(text)) return rows.phone ? [rows.phone] : [];
    if (/FROM sms_deliveries/.test(text)) return [{ n: rows.delivered ?? 0 }];
    if (/is_demo = false/.test(text)) return rows.call ? [rows.call] : [];
    if (/is_demo = true/.test(text)) return [{ n: rows.demoCalls ?? 0 }];
    if (/FROM appointments/.test(text)) return [{ n: rows.upcoming ?? 0 }];
    throw new Error(`unexpected query: ${text.slice(0, 80)}`);
  };
}

const ALIAS_ROOT: Record<string, string> = {
  h: "",
  phone: "phoneStatus",
  call: "lastCall",
  hook: "webhookStatus",
  texting: "texting",
};

/** Dotted paths the page reads, e.g. "phoneStatus.provisioned". */
function fieldsReadByPage(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/\b(h|phone|call|hook|texting)\.([A-Za-z][A-Za-z0-9]*)/g)) {
    const root = ALIAS_ROOT[m[1]];
    if (root === undefined) continue;
    out.add(root ? `${root}.${m[2]}` : m[2]);
  }
  return [...out];
}

test("the org payload contains every field the dashboard page reads", async () => {
  const payload = await buildOrgHealth(
    fakeSql({
      org: { id: "org-1", name: "Carm Marketing LLC", timezone: "America/New_York", sms_enabled: false },
      phone: { phone_number: "+17279667556", is_active: true, capabilities: { voice: true, sms: true }, telnyx_number_id: null },
      delivered: 0,
      call: {
        started_at: "2026-11-04T00:54:51.592Z",
        ended_at: "2026-11-04T00:55:47.240Z",
        status: "ended",
        ai_handled: true,
        escalated_to_human: false,
        caller_number: "+15550000077",
      },
      demoCalls: 24,
      upcoming: 3,
    }) as any,
    "org-1",
  );

  const view: any = normalizeOrgHealth(payload);
  const read = fieldsReadByPage(rootPage);
  expect(read.length).toBeGreaterThan(10);

  const missing: string[] = [];
  for (const path of read) {
    const value = path.split(".").reduce<any>((acc, k) => (acc == null ? undefined : acc[k]), view);
    if (value === undefined) missing.push(path);
  }
  expect(missing).toEqual([]);

  // The values are real, not placeholders.
  expect(view.phoneStatus).toEqual({
    provisioned: true,
    number: "+17279667556",
    status: "active",
    voiceEnabled: true,
    smsEnabled: true,
  });
  expect(view.lastCall).toEqual({
    found: true,
    callerNumber: "+15550000077",
    time: "2026-11-04T00:54:51.592Z",
    duration: 56,
    outcome: "AI handled",
    demoCallsExcluded: 24,
  });
  expect(view.scheduleStatus.upcoming).toBe(3);
  expect(view.texting).toEqual({ addonEnabled: false, delivering: false });
  // Telnyx webhook config cannot be read without a telnyx_number_id: "not checked", never
  // a green tick invented from "we have seen a call".
  expect(view.webhookStatus.known).toBe(false);
  expect(view.webhookStatus.configured).toBe(null);
  expect(view.unknowns).toEqual(["webhook"]);
  expect(view.allOk).toBe(true);
});

test("a brand-new org with no number and no calls reports that honestly", async () => {
  const view = normalizeOrgHealth(
    await buildOrgHealth(fakeSql({ org: { id: "org-2", name: "New Co", timezone: "UTC", sms_enabled: false } }) as any, "org-2"),
  );
  expect(view.phoneStatus.provisioned).toBe(false);
  expect(view.phoneStatus.status).toBe("none");
  expect(view.lastCall.found).toBe(false);
  expect(view.allOk).toBe(false);
  expect(view.webhookStatus.known).toBe(false);
  expect(view.webhookStatus.source).toBe("none");
  expect(view.tips.length).toBe(2); // no number, no calls
});

// ── 6. The page cannot throw on a missing field (the original crash) ──────
test("normalizeOrgHealth never throws, including on the platform /api/health payload that broke the page", () => {
  const platformPayload = {
    status: "ok",
    timestamp: "2026-11-04T00:00:00.000Z",
    database: "connected",
    telnyx: "configured",
    stripe: "configured",
    cronSecret: "set",
    telnyxBalance: 14.25,
    telnyxBalanceCurrency: "USD",
    telnyxBalanceCheckedAt: "2026-11-04T00:00:00.000Z",
    telnyxBalanceStatus: "low",
    smsDelivery: { sent24h: 0, delivered24h: 0, failed24h: 0 },
    email: { sent24h: 1, failed24h: 0, lastSuccessAt: "2026-11-03T22:44:48Z" },
  };

  const inputs: unknown[] = [null, undefined, 0, "nope", [], {}, platformPayload];
  for (const input of inputs) {
    const view = normalizeOrgHealth(input);
    // Renderable, complete, and no field left undefined.
    expect(typeof view.phoneStatus.provisioned).toBe("boolean");
    expect(Array.isArray(view.tips)).toBe(true);
    expect(Array.isArray(view.unknowns)).toBe(true);
    expect(typeof view.scheduleStatus.upcoming).toBe("number");
    expect(typeof view.lastCall.found).toBe("boolean");
    expect(typeof view.webhookStatus.known).toBe("boolean");
  }

  // The exact regression: the old payload used to crash the page on `.provisioned`.
  const old = normalizeOrgHealth(platformPayload);
  expect(old.phoneStatus.provisioned).toBe(false);
  expect(old.allOk).toBe(false);
  // …and the page is told which sections the server did not send.
  expect(old.missing.sort()).toEqual(["allOk", "lastCall", "phoneStatus", "scheduleStatus", "tips", "webhookStatus"]);
});
