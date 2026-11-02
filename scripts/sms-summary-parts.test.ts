/**
 * The post-call summary must cost 2 SMS parts, not 3–8.
 *
 * The measured truth behind this test (Telnyx billing, 10-23 → 10-30): 36 real SMS
 * averaged 2.81 parts at $0.0449 each, and the summary was the biggest single line item
 * in what a customer costs us. The cause was not length, it was ENCODING: the old summary
 * opened with `📞 ReceptionAI Call Summary`, carried a `—` separator and a `→` in the DTMF
 * line, and any one of those re-encodes the whole message as UCS-2 — 67 characters per
 * part instead of 153. A 507-character summary was billed as 8 parts ($0.128).
 *
 * So this test does NOT count characters. It runs the REAL `buildCallSummary()` out of
 * both serve.ts trees (transpiled from the file, not re-implemented here) and counts
 * actual SMSC segments with the GSM 03.38 rules in ./sms-segments.ts.
 *
 *   bun test scripts/sms-summary-parts.test.ts
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { smsStats, truncateWords } from "./sms-segments.ts";

const ROOT = join(import.meta.dir, "..");
const TREES = ["serve.ts", join("site", "serve.ts")] as const;

/** A transcript as long as the model can produce — the thing that made the old SMS unbounded. */
const MAX_TRANSCRIPT =
  "The caller said they have a leaking water heater in the garage and it has been dripping since last night, " +
  "they want someone to come out as soon as possible, preferably in the morning before they leave for work, " +
  "and asked whether the visit fee is waived if they approve the repair on the same day. They also mentioned " +
  "the unit is eleven years old, that a previous company quoted them 480 dollars, and that they would like a " +
  "written estimate by email before anything is ordered or scheduled.";

/** A Spanish transcript full of characters that are NOT in GSM-7 — the real-world ES case. */
const ES_TRANSCRIPT =
  "La señora dijo que su calefón tiene una pérdida de agua desde anoche y pidió que alguien pase mañana por la " +
  "mañana; preguntó también si el presupuesto es sin cargo y si se puede pagar con tarjeta — dijo “lo antes " +
  "posible” y mandó un mensaje con emojis 📞🔧 para confirmar la dirección.";

const transpiler = new Bun.Transpiler({ loader: "ts" });

/**
 * Pull `buildCallSummary` — plus the helpers defined immediately above it (gsm7Safe,
 * truncateWords, formatSummaryAppt, SUMMARY_TRANSCRIPT_MAX) — out of a serve.ts tree and
 * load it as a real function. This is the whole point: the assertions run against the
 * shipped source, so editing serve.ts can never make this test silently pass.
 */
function loadSummaryFrom(tree: string): (cs: any, transcript?: string) => string {
  const src = readFileSync(join(ROOT, tree), "utf8");
  const fnAt = src.indexOf("function buildCallSummary(");
  if (fnAt < 0) throw new Error(`${tree}: buildCallSummary not found`);
  const helpersAt = src.indexOf("const GSM7_BASIC");
  const start = helpersAt >= 0 && helpersAt < fnAt ? helpersAt : fnAt;

  // End of buildCallSummary: walk its parameter parens, then brace-match the body.
  let parens = 0;
  let bodyOpen = -1;
  for (let i = src.indexOf("(", fnAt); i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")" && --parens === 0) { bodyOpen = src.indexOf("{", i); break; }
  }
  let depth = 0;
  let end = -1;
  for (let i = bodyOpen; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) { end = i + 1; break; }
  }
  if (end < 0) throw new Error(`${tree}: unbalanced buildCallSummary`);

  const js = transpiler.transformSync(src.slice(start, end));
  return new Function(`${js}\nreturn buildCallSummary;`)() as (cs: any, t?: string) => string;
}

function callState(over: Record<string, unknown> = {}) {
  return {
    callerNumber: "+18135551234",
    toNumber: "+18135550000",
    dtmfHistory: ["1", "2"],
    startTime: new Date(Date.now() - 135_000), // 2m 15s ago
    orgId: "org_1",
    orgName: "Cool Air HVAC",
    isDemo: false,
    callerFirstName: "Maria",
    appointmentIntent: true,
    appointmentBooked: true,
    language: "en",
    answered: true,
    bookedSlot: { date: "2026-11-03", time: "2:00 PM" },
    ...over,
  };
}

/** 2 GSM-7 parts = 306 septets. That is the hard ceiling for the owner's summary. */
const MAX_CHARS = 306;
const MAX_PARTS = 2;

describe.each(TREES)("%s — post-call summary", (tree) => {
  const build = loadSummaryFrom(tree);

  const cases: Array<[string, any, string?]> = [
    ["EN booking, max transcript", callState({ language: "en" }), MAX_TRANSCRIPT],
    ["EN booking, Spanish transcript", callState({ language: "en" }), ES_TRANSCRIPT],
    ["EN general inquiry", callState({ language: "en", appointmentBooked: false, appointmentIntent: false }), MAX_TRANSCRIPT],
    ["EN callback requested", callState({ language: "en", appointmentBooked: false, requestedCallback: true }), MAX_TRANSCRIPT],
    ["ES booking, max transcript", callState({ language: "es" }), MAX_TRANSCRIPT],
    ["ES booking, Spanish transcript", callState({ language: "es" }), ES_TRANSCRIPT],
    ["ES general inquiry", callState({ language: "es", appointmentBooked: false, appointmentIntent: false }), MAX_TRANSCRIPT],
    ["ES callback requested", callState({ language: "es", appointmentBooked: false, requestedCallback: true }), MAX_TRANSCRIPT],
    ["EN booking, no transcript", callState({ language: "en" }), undefined],
    ["ES booking, no transcript", callState({ language: "es" }), undefined],
  ];

  test.each(cases)("%s: GSM-7 and at most 2 parts", (_name, cs, transcript) => {
    const text = build(cs, transcript);
    const stats = smsStats(text);

    // Real segment count, not a character count.
    expect(stats.encoding).toBe("GSM-7");
    expect(stats.offenders).toEqual([]);
    expect(stats.parts).toBeLessThanOrEqual(MAX_PARTS);
    expect(stats.characters).toBeLessThanOrEqual(MAX_CHARS);
    // 2 GSM-7 parts hold 306 septets; assert we are not sitting on the edge of a 3rd.
    expect(stats.units).toBeLessThanOrEqual(306);
  });

  test("keeps what the owner reads in the morning", () => {
    const booked = build(callState({ language: "en" }), MAX_TRANSCRIPT);
    expect(booked).toContain("Maria");            // who called
    expect(booked).toContain("+18135551234");     // their number
    expect(booked).toContain("Appointment booked"); // outcome
    expect(booked).toContain("Nov 3");            // appointment date
    expect(booked).toContain("2:00 PM");          // appointment time
    expect(booked).toContain("Notes:");           // the AI transcript line survives

    const esBooked = build(callState({ language: "es" }), MAX_TRANSCRIPT);
    expect(esBooked).toContain("Cita agendada");
    expect(esBooked).toContain("nov 3");
    expect(esBooked).toContain("2:00 PM");
  });

  test("drops the debug detail and the UCS-2 characters", () => {
    const text = build(callState({ language: "en" }), MAX_TRANSCRIPT);
    expect(text).not.toContain("DTMF");        // debug line, not information
    expect(text).not.toContain("📞");           // emoji header forced UCS-2
    expect(text).not.toContain("—");            // em dash separator forced UCS-2
    expect(text).not.toContain("/dashboard");   // long URL, replaced by the bare domain
    expect(text).not.toContain("AI Summary:");  // unbounded transcript line
    // The non-booking case must not invent an appointment.
    const general = build(callState({ language: "en", appointmentBooked: false, appointmentIntent: false }), MAX_TRANSCRIPT);
    expect(general).not.toContain("Appt:");
  });

  test("caps the transcript on a word boundary, not mid-word", () => {
    const text = build(callState({ language: "en" }), MAX_TRANSCRIPT);
    const notes = text.split("\n").find((l) => l.startsWith("Notes: "))!;
    expect(notes.length).toBeLessThanOrEqual("Notes: ".length + 120);
    expect(notes.endsWith("...")).toBe(true);
    // "..." must follow a whole word: the character before it is never a space.
    expect(notes).not.toMatch(/\s\.\.\.$/);
    // A 10x longer transcript must not grow the message at all.
    const huge = build(callState({ language: "en" }), MAX_TRANSCRIPT.repeat(10));
    expect(smsStats(huge).parts).toBeLessThanOrEqual(MAX_PARTS);
  });
});

describe("both serve.ts trees carry the same SMS code", () => {
  /** The block from gsm7Safe through buildCallSummary must be byte-identical in both trees. */
  const sharedBlock = (tree: string) => {
    const src = readFileSync(join(ROOT, tree), "utf8");
    const start = src.indexOf("// ── GSM-7 safety net for every outbound SMS");
    const fnAt = src.indexOf("function buildCallSummary(");
    if (start < 0 || fnAt < 0) throw new Error(`${tree}: shared SMS block not found`);
    let depth = 0, end = -1;
    for (let i = src.indexOf("{", src.indexOf(")", src.indexOf("(", fnAt))); i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) { end = i + 1; break; }
    }
    return src.slice(start, end);
  };

  test("byte-identical", () => {
    const [root, site] = TREES.map(sharedBlock);
    expect(root.length).toBeGreaterThan(2000);
    expect(site).toBe(root);
  });

  test("every outbound SMS goes through gsm7Safe in both trees", () => {
    for (const tree of TREES) {
      const src = readFileSync(join(ROOT, tree), "utf8");
      expect(src).toContain("const safeText = gsm7Safe(text);");
      expect(src).toContain("text: safeText,");
      // Reminders and the web-booking confirmation now go through sendSms() as well,
      // so the GSM-7 net is applied once, inside sendSms(). No direct Telnyx message
      // POST may be reintroduced that could skip it.
      expect(src).not.toContain('fetch("https://api.telnyx.com/v2/messages"');
      expect(src).toContain('sendSms(fromNum, r.recipient_phone, r.message_body, "reminder")');
      expect(src).toContain('"confirmation").catch(() => {});');
      // No SMS body may reintroduce an emoji/em dash of its own.
      expect(src).not.toContain("📞 ReceptionAI Call Summary");
      expect(src).not.toContain("🔔");
    }
  });
});

describe("truncateWords (the cap used by the summary)", () => {
  test("never splits a word and always marks the cut", () => {
    const out = truncateWords("the caller wants someone to come out as soon as possible tomorrow", 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("...")).toBe(true);
    expect(out).not.toMatch(/\s\.\.\.$/);
  });
  test("leaves a short transcript untouched", () => {
    expect(truncateWords("Booked for Tuesday", 120)).toBe("Booked for Tuesday");
  });
  test("collapses newlines so the SMS stays predictable", () => {
    expect(truncateWords("line one\n\nline   two", 120)).toBe("line one line two");
  });
});
