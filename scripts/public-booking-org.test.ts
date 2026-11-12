/**
 * The public /book page must never send an org id that cannot be resolved.
 *
 * What went wrong (2026-11-11): /book sent `org_id=demo`. `organizations.id` is a uuid, so
 * `/api/booking/slots` and the booking POST both died with
 * `invalid input syntax for type uuid: "demo"` — every visitor got "Failed to load slots".
 *
 * This test is the one that would have caught it. It asserts:
 *   - a non-uuid org id can never reach a uuid column: it is looked up as a SLUG, then the
 *     configured default org is used (the exact value that threw is the first case below);
 *   - a well-formed id that matches no org returns null instead of quietly booking into
 *     somebody else's calendar;
 *   - the page sends no org id at all, and both serve.ts trees resolve a real org
 *     server-side, in byte-identical handlers, BEFORE the slots query runs;
 *   - the configured org is the founder org, and (when DATABASE_URL is present) it exists in
 *     the database with business hours.
 *
 * Run: bun run test scripts/public-booking-org.test.ts
 */
import { test, expect } from "bun:test";
import { neon } from "@neondatabase/serverless";
import {
  resolvePublicBookingOrg,
  PUBLIC_BOOKING_ORG_ID,
  BOOKING_FALLBACK,
  UUID_RE,
  type OrgLookup,
  type PublicBookingOrg,
} from "../src/lib/public-booking-org";

// Resolve the repo from this file, not a hardcoded path, so the test runs in every checkout.
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const root = await Bun.file(`${REPO}/serve.ts`).text();
const site = await Bun.file(`${REPO}/site/serve.ts`).text();
const rootPage = await Bun.file(`${REPO}/src/routes/_marketing.book.tsx`).text();
const sitePage = await Bun.file(`${REPO}/site/src/routes/_marketing.book.tsx`).text();
const rootLib = await Bun.file(`${REPO}/src/lib/public-booking-org.ts`).text();
const siteLib = await Bun.file(`${REPO}/site/src/lib/public-booking-org.ts`).text();

const FOUNDER: PublicBookingOrg = {
  id: PUBLIC_BOOKING_ORG_ID,
  name: "Carm Marketing LLC",
  phone: null,
  email: null,
};
const OTHER: PublicBookingOrg = {
  id: "8c1d0f2e-0000-4000-8000-000000000001",
  name: "Some Other Business",
  phone: null,
  email: null,
};

/** Lookup that records every call and REFUSES a non-uuid in a uuid column (as Postgres does). */
function recordingLookup(bySlug: Record<string, PublicBookingOrg> = {}) {
  const calls: Array<{ kind: "id" | "slug"; value: string }> = [];
  const lookup: OrgLookup = async (kind, value) => {
    if (kind === "id" && !UUID_RE.test(value)) {
      throw new Error(`invalid input syntax for type uuid: "${value}"`);
    }
    calls.push({ kind, value });
    if (kind === "slug") return bySlug[value] ?? null;
    if (value === PUBLIC_BOOKING_ORG_ID) return FOUNDER;
    if (value === OTHER.id) return OTHER;
    return null;
  };
  return { calls, lookup };
}

// ── 1. The bug itself: a non-uuid org id must never reach a uuid column ─────
test('"demo" (the id /book used to send) can never reach the slots query as a uuid', async () => {
  const { calls, lookup } = recordingLookup();
  const org = await resolvePublicBookingOrg("demo", lookup);

  // It resolved to a REAL org instead of throwing.
  expect(org).not.toBeNull();
  expect(org!.id).toBe(PUBLIC_BOOKING_ORG_ID);

  // "demo" was only ever treated as a slug, then the default org was used.
  expect(calls[0]).toEqual({ kind: "slug", value: "demo" });
  expect(calls[calls.length - 1]).toEqual({ kind: "id", value: PUBLIC_BOOKING_ORG_ID });
  for (const c of calls) if (c.kind === "id") expect(UUID_RE.test(c.value)).toBe(true);
});

test("an existing slug resolves to that org, with no id lookup at all", async () => {
  const { calls, lookup } = recordingLookup({ "carm-marketing": OTHER });
  const org = await resolvePublicBookingOrg("carm-marketing", lookup);

  expect(org?.id).toBe(OTHER.id);
  expect(calls).toEqual([{ kind: "slug", value: "carm-marketing" }]);
});

test("a well-formed id that is not an org returns null instead of booking someone else", async () => {
  const { lookup } = recordingLookup();
  const org = await resolvePublicBookingOrg("8c1d0f2e-0000-4000-8000-00000000dead", lookup);
  expect(org).toBeNull();
});

test("no org id at all falls back to the configured founder org", async () => {
  const { lookup } = recordingLookup();
  for (const empty of ["", "   ", null, undefined]) {
    const org = await resolvePublicBookingOrg(empty as string | null | undefined, lookup);
    expect(org?.id).toBe(PUBLIC_BOOKING_ORG_ID);
  }
});

// ── 2. The configured org is the founder org, and it is a real uuid ─────────
test("the configured public booking org is the founder org and is a valid uuid", () => {
  expect(PUBLIC_BOOKING_ORG_ID).toBe("4314b9fe-aee5-4d18-ac90-e781921db2f2");
  expect(UUID_RE.test(PUBLIC_BOOKING_ORG_ID)).toBe(true);
  // The page's visible fallback and the server's error payload must not drift apart.
  expect(BOOKING_FALLBACK.phone).toBe("(727) 966-7556");
  expect(BOOKING_FALLBACK.email).toBe("hello@receptionai.store");
});

// ── 3. Both serve.ts trees resolve the org before querying, identically ─────
function grab(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  if (a < 0) throw new Error(`not found: ${start}`);
  const b = src.indexOf(end, a);
  if (b < 0) throw new Error(`end not found after ${start}`);
  return src.slice(a, b);
}

const SLOTS_START = 'if (pathname === "/api/booking/slots" && req.method === "GET") {';
const SLOTS_END = "// ── Calendar Slots API (public) ─";
const POST_START = 'if (pathname === "/api/booking" && req.method === "POST") {';
const POST_END = "// ── Reminders Cron ──";
const HELPER_START = "async function resolveBookingOrgForRequest(";
const HELPER_END = "// Generate available slots for one org-local date";

test("both serve.ts trees resolve the public booking org server-side, byte-identically", () => {
  const rootHelper = grab(root, HELPER_START, HELPER_END);
  const siteHelper = grab(site, HELPER_START, HELPER_END);
  expect(rootHelper).toBe(siteHelper);
  // One shared implementation, and a uuid cast only where a uuid is guaranteed.
  expect(rootHelper).toContain("resolvePublicBookingOrg(");
  expect(rootHelper).toContain("WHERE id = ${value}::uuid");
  expect(rootHelper).toContain("WHERE slug = ${value}");

  const rootSlots = grab(root, SLOTS_START, SLOTS_END);
  const siteSlots = grab(site, SLOTS_START, SLOTS_END);
  expect(rootSlots).toBe(siteSlots);
  // Resolution happens first, and the slots query gets the RESOLVED org, never the raw param.
  expect(rootSlots).toContain("resolveBookingOrgForRequest(sql, requestedOrg)");
  expect(rootSlots.indexOf("resolveBookingOrgForRequest(")).toBeLessThan(
    rootSlots.indexOf("getSlotsForDate("),
  );
  expect(rootSlots).not.toContain("getSlotsForDate(requestedOrg");
  expect(rootSlots).toContain("getSlotsForDate(org.id, date, duration)");
  // No more bare 500s: every failure is a structured, displayable error with a fallback.
  expect(rootSlots).not.toContain('{ error: "Failed to load slots" }');
  expect(rootSlots).toContain("fallback: BOOKING_FALLBACK");
  expect(rootSlots).toContain("code: ");
});

test("the booking POST uses the resolved org, in both trees", () => {
  const rootPost = grab(root, POST_START, POST_END);
  const sitePost = grab(site, POST_START, POST_END);
  // The part this fix owns (validation + org resolution) is identical in both trees. The two
  // trees already differ further down (the root one also syncs to Google), which is not ours.
  const PREAMBLE_END = "// Create or find contact";
  expect(grab(rootPost, POST_START, PREAMBLE_END)).toBe(grab(sitePost, POST_START, PREAMBLE_END));
  expect(rootPost).toContain("resolveBookingOrgForRequest(sql, org_id)");
  expect(rootPost.indexOf("resolveBookingOrgForRequest(")).toBeLessThan(
    rootPost.indexOf("INSERT INTO contacts"),
  );
  // The raw request value must not be written into a uuid column anywhere.
  expect(rootPost).not.toContain("${org_id}");
  expect(rootPost).toContain("${org.id}");
  expect(rootPost).not.toContain('{ error: "Failed to create appointment" }');
  expect(rootPost).toContain("fallback: BOOKING_FALLBACK");
});

test("the shared resolver is byte-identical in both trees", () => {
  expect(rootLib).toBe(siteLib);
});

// ── 4. The page sends no org id and always offers a human ──────────────────
test("the /book page sends no org id, in both trees", () => {
  for (const page of [rootPage, sitePage]) {
    expect(page).not.toContain("DEFAULT_ORG_ID");
    expect(page).not.toContain("slots?org_id=");
    expect(page).not.toMatch(/org_id\s*:/);
    expect(page).toContain("/api/booking/slots?date=");
    expect(page).toContain('fetch("/api/booking"');
  }
});

test("the /book page shows the same phone and email as the server's fallback", () => {
  for (const page of [rootPage, sitePage]) {
    expect(page).toContain(BOOKING_FALLBACK.phone);
    expect(page).toContain(BOOKING_FALLBACK.email);
    expect(page).toContain('"tel:+17279667556"');
    expect(page).toContain("mailto:");
  }
});

// ── 5. With a database: the founder org is real and has business hours ─────
const dbUrl = process.env.DATABASE_URL;

test.skipIf(!dbUrl)("the founder org exists and has business hours", async () => {
  const sql = neon(dbUrl!);
  const orgs = await sql`
    SELECT id, name FROM organizations WHERE id = ${PUBLIC_BOOKING_ORG_ID}::uuid LIMIT 1
  `;
  expect(orgs.length).toBe(1);

  const hours = await sql`
    SELECT day_of_week, is_closed FROM business_hours
    WHERE organization_id = ${PUBLIC_BOOKING_ORG_ID}::uuid
  `;
  expect(hours.length).toBeGreaterThan(0);
  expect(hours.some((h: any) => h.is_closed === false)).toBe(true);
});
