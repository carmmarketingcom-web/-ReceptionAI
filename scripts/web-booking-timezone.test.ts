/**
 * A web booking must store the instant the customer actually picked.
 *
 * What went wrong (live booking 9debdc8b, 2026-11-12): the /api/booking POST wrote
 * `${date}T${time}:00` straight into `appointments.start_time` and never set `timezone`.
 * `start_time` is a timestamptz, so Postgres read that string as UTC: an 11:00
 * America/New_York booking was stored as 11:00Z. Its reminders were computed correctly for
 * 16:00Z, so the confirmation email and the reminder were right and only the stored row —
 * and therefore the dashboard and calendar — was five hours off.
 *
 * This test proves, in BOTH serve.ts trees:
 *   • the real zonedToUtc() from serve.ts turns a business-local date+time into the same UTC
 *     instant the reminders use (16:00Z for 11:00 ET), across DST on both sides;
 *   • the /api/booking insert stores start_time/end_time from that conversion, writes the
 *     `timezone` column, and no longer contains the naive string literal.
 *
 * Run: bun run test scripts/web-booking-timezone.test.ts
 */
import { test, expect } from "bun:test";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const rootSrc = await Bun.file(`${REPO}/serve.ts`).text();
const siteSrc = await Bun.file(`${REPO}/site/serve.ts`).text();

type ZonedToUtc = (date: string, time: string, tz: string) => Date;

/** Pull the real tz helpers out of serve.ts and run them, so the test tests shipped code. */
function loadZonedToUtc(src: string): ZonedToUtc {
  const start = src.indexOf("function getTimezoneOffsetMs");
  const end = src.indexOf("async function getOrgTimezone");
  if (start < 0 || end < 0 || end <= start) throw new Error("tz helpers missing from serve.ts");
  const body = src.slice(start, end);
  // serve.ts is TypeScript; strip the annotations before evaluating the helpers as-is.
  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(body);
  return new Function(`${js}\nreturn zonedToUtc;`)() as ZonedToUtc;
}

/** The exact values the /api/booking handler now puts in the insert. */
function bookingRow(src: string, date: string, time: string, tz: string) {
  const [hour, min] = time.split(":").map(Number);
  const endMin = hour * 60 + min + 60; // default 60 min, same as the handler
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
  const zonedToUtc = loadZonedToUtc(src);
  return {
    start: zonedToUtc(date, time, tz).toISOString(),
    end: zonedToUtc(date, endTime, tz).toISOString(),
    tz,
  };
}

for (const [name, src] of [["serve.ts", rootSrc], ["site/serve.ts", siteSrc]] as const) {
  test(`${name}: local date+time becomes the correct UTC instant`, () => {
    const zonedToUtc = loadZonedToUtc(src);
    // The live row: 11:00 America/New_York on 2026-11-17 is 16:00Z (EST, -5).
    expect(zonedToUtc("2026-11-17", "11:00", "America/New_York").toISOString())
      .toBe("2026-11-17T16:00:00.000Z");
    // The same wall clock in summer is 15:00Z (EDT, -4) — DST must not shift the booking.
    expect(zonedToUtc("2026-07-17", "11:00", "America/New_York").toISOString())
      .toBe("2026-07-17T15:00:00.000Z");
    // A Central org: 11:00 CST is 17:00Z.
    expect(zonedToUtc("2026-11-17", "11:00", "America/Chicago").toISOString())
      .toBe("2026-11-17T17:00:00.000Z");
  });

  test(`${name}: /api/booking stores UTC start/end plus the timezone`, () => {
    const handler = src.slice(src.indexOf('pathname === "/api/booking" && req.method === "POST"'));
    const at = handler.indexOf("INSERT INTO appointments");
    expect(at).toBeGreaterThan(-1);
    const block = handler.slice(Math.max(0, at - 900), at + 900);
    // Converted with the org tz, and the tz written on the row.
    expect(block).toContain("zonedToUtc(date, time, orgTz)");
    expect(block).toContain("start_time, end_time, timezone");
    expect(block).toContain("${startUtc.toISOString()}, ${endUtc.toISOString()}, ${orgTz}");
    // The old naive wall-clock write is gone from this handler.
    expect(block).not.toContain('${date + "T" + time + ":00"}');
    expect(block).not.toContain('${date + "T" + endTime + ":00"}');
  });
}

test("an 11:00 ET web booking is stored as 16:00Z with a 17:00Z end", () => {
  expect(bookingRow(rootSrc, "2026-11-17", "11:00", "America/New_York")).toEqual({
    start: "2026-11-17T16:00:00.000Z",
    end: "2026-11-17T17:00:00.000Z",
    tz: "America/New_York",
  });
});
