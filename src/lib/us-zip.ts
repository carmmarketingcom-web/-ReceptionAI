/**
 * ZIP -> region for a brand-new customer: the timezone their bookings live in, and the area
 * code their new number should be bought in.
 *
 * Why a table instead of a geocoder or a timezone package: this runs inside the Stripe
 * webhook, which has seconds to finish and must never fail a paying customer. The table is
 * generated data (see `us-zip-table.ts`) covering every US ZIP prefix, so a lookup is a single
 * object read — no network call, no dependency, nothing to time out. A prefix we don't know is
 * not an error: the caller gets the documented defaults and logs the miss.
 */
import { ZIP3_REGION } from "./us-zip-table";

/** Central time is the historical default. Only used when the ZIP is missing or unknown. */
export const DEFAULT_TIMEZONE = "America/Chicago";

export interface ZipRegion {
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
  /** Three-digit NANP area code, e.g. "727". Empty when unknown. */
  areaCode: string;
}

/**
 * Pull a 5-digit ZIP out of whatever a customer typed or Stripe stored:
 * "33701", " 33701 ", "33701-1234", "33701 1234". Anything else is "" (never an error —
 * a missing ZIP must not block signup).
 */
export function normalizeZip(input: unknown): string {
  if (typeof input !== "string") return "";
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length < 5) return "";
  const zip = digits.slice(0, 5);
  return /^[0-9]{5}$/.test(zip) ? zip : "";
}

/** True when the value looks like a ZIP we could use (for form validation). */
export function isValidZip(input: unknown): boolean {
  return normalizeZip(input) !== "";
}

/**
 * Resolve a ZIP to its timezone and area code. Returns null when the prefix is unknown or the
 * input isn't a ZIP at all — the caller decides what to fall back to.
 */
export function zipRegion(zip: string): ZipRegion | null {
  const normalized = normalizeZip(zip);
  if (!normalized) return null;
  const row = ZIP3_REGION[normalized.slice(0, 3)];
  if (!row) return null;
  const [timezone, areaCode] = row.split("|");
  if (!timezone) return null;
  return { timezone, areaCode: areaCode || "" };
}

/** Timezone for a ZIP, or DEFAULT_TIMEZONE. Never throws. */
export function timezoneForZip(zip: string): string {
  return zipRegion(zip)?.timezone || DEFAULT_TIMEZONE;
}

/** Area code for a ZIP, or "" when unknown (caller then buys any US number). */
export function areaCodeForZip(zip: string): string {
  return zipRegion(zip)?.areaCode || "";
}

/**
 * The area code of a phone number in any common form (+13372251234, 337-225-1234, 3372251234).
 * Used as a second opinion for the number to buy: the owner's own mobile is normally local to
 * the business. Returns "" for non-NANP / toll-free / unparseable numbers, so we never buy a
 * toll-free line as a "local" number.
 */
export function areaCodeFromPhone(input: unknown): string {
  if (typeof input !== "string") return "";
  let digits = input.replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return "";
  const area = digits.slice(0, 3);
  // Toll-free and non-geographic NANP codes can't be bought as a local line.
  const nonGeographic = new Set([
    "800", "833", "844", "855", "866", "877", "888", "822", "880", "887", "889",
    "900", "500", "533", "544", "566", "577", "588",
  ]);
  if (nonGeographic.has(area)) return "";
  if (area[0] === "0" || area[0] === "1") return "";
  return area;
}

/**
 * The area code to buy in: the customer's ZIP region first (they told us where the business
 * is), then their own mobile's area code. "" means "any US number is fine".
 */
export function preferredAreaCode(zip: string, phone?: string | null): string {
  return areaCodeForZip(zip) || areaCodeFromPhone(phone) || "";
}
