/**
 * Public booking org resolution — shared by both serve.ts trees.
 *
 * What went wrong (2026-11-11): the public /book page sent `org_id=demo`. `organizations.id`
 * is a uuid, so every slots request and every booking POST died with
 * `invalid input syntax for type uuid: "demo"` — /book failed for every visitor.
 *
 * The page now sends NO org id, and the server resolves a real org from data that exists.
 * A value is only ever handed to a uuid-typed column after it passes UUID_RE; anything else
 * can only be a slug. When nothing resolves the caller returns an honest, structured error
 * with a phone/email fallback instead of a 500.
 */

/** Founder org (Carm Marketing LLC) — public bookings are appointments with the owner. */
export const PUBLIC_BOOKING_ORG_ID = "4314b9fe-aee5-4d18-ac90-e781921db2f2";

/** Postgres uuid literal. Anything that fails this must never reach a uuid column. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PublicBookingOrg = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

/** Look up one org by exactly one key. Builds no SQL — the caller does. */
export type OrgLookup = (kind: "id" | "slug", value: string) => Promise<PublicBookingOrg | null>;

/** What /book tells a visitor when online booking cannot serve them. */
export const BOOKING_FALLBACK = {
  phone: "(727) 966-7556",
  email: "hello@receptionai.store",
};

/**
 * Resolve the org a public booking request belongs to.
 *
 * Order: an existing org id → an existing slug → the configured default
 * (`PUBLIC_BOOKING_ORG_ID`, else the founder org). A well-formed id that matches no org
 * returns null rather than quietly booking into someone else's calendar.
 */
export async function resolvePublicBookingOrg(
  requested: string | null | undefined,
  lookup: OrgLookup,
): Promise<PublicBookingOrg | null> {
  const raw = typeof requested === "string" ? requested.trim() : "";

  if (raw && UUID_RE.test(raw)) {
    const byId = await lookup("id", raw.toLowerCase());
    if (byId) return byId;
    return null; // a real-looking id that is not an org: a wrong link, not a fallback
  }

  if (raw) {
    // Not a uuid, so it can only be a slug — never a uuid column (this is what threw for "demo").
    const bySlug = await lookup("slug", raw);
    if (bySlug) return bySlug;
  }

  const fallback = (process.env.PUBLIC_BOOKING_ORG_ID || PUBLIC_BOOKING_ORG_ID).trim();
  if (!UUID_RE.test(fallback)) return null;
  return lookup("id", fallback.toLowerCase());
}
