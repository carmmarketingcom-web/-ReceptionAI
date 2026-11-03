/**
 * Audit every SMS body built by a serve.ts tree: encoding, characters, parts, cost.
 *
 *   bun scripts/sms-parts-audit.ts serve.ts
 *   git show HEAD:serve.ts > /tmp/before.ts && bun scripts/sms-parts-audit.ts /tmp/before.ts
 *
 * It does not paraphrase the messages — it pulls the REAL template literals and the
 * REAL builder functions out of the file and evaluates them with representative
 * values, so the table describes what a customer/owner actually receives.
 */
import { smsStats, smsCostUsd } from "./sms-segments.ts";

const file = process.argv[2] || "serve.ts";
const src = await Bun.file(file).text();

const SAMPLE = {
  p: {
    name: "Maria Rodriguez", customerName: "Maria Rodriguez", service: "AC repair",
    date: "2026-11-03", time: "2:00 PM", orgName: "Cool Air HVAC",
    fromNumber: "+18135551234", orgPhone: "+18135551234", tz: "America/Chicago",
    phone: "+18135551234", endTime: "3:00 PM",
  },
  cs: {
    callerNumber: "+18135551234", toNumber: "+18135550000", callerFirstName: "Maria",
    orgName: "Cool Air HVAC", language: "en", appointmentBooked: true,
    requestedCallback: false, appointmentIntent: true, answered: true,
    startTime: new Date(Date.now() - 135000), dtmfHistory: ["1", "2"],
    bookedSlot: { date: "2026-11-03", time: "2:00 PM" },
    rescheduleNewDate: "2026-11-03", rescheduleNewTime: "2:00 PM",
  },
  slot: { date: "2026-11-03", time: "2:00 PM", endTime: "3:00 PM" },
  entry: { phone: "+18135551234" },
  cbState: { orgName: "Cool Air HVAC", callerNumber: "+18135551234", businessNumber: "+18135550000", language: "en" },
  tState: { callerNumber: "+18135551234", ownerPhone: "+18135557777", businessNumber: "+18135550000", language: "en" },
  name: "Maria Rodriguez", service: "AC repair", date: "2026-11-03", time: "2:00 PM",
  orgName: "Cool Air HVAC", orgPhone: "+18135551234", fromNumber: "+18135551234",
  rating: 2, transferNumber: "+18135557777", lang: "en", es: false, phone: "+18135551234",
  org: { name: "Cool Air HVAC" }, business: "Cool Air HVAC",
};

function evalTemplate(tplSrc: string, extra: Record<string, unknown> = {}): string {
  const scope = { ...SAMPLE, ...extra };
  // new Function is sloppy-mode, so `with` is legal — it lets the real template
  // reference whatever identifiers the file actually uses.
  const fn = new Function("scope", `with (scope) { return ${tplSrc}; }`) as (s: unknown) => string;
  return fn(new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k in t ? (t as any)[k] : (k === Symbol.unscopables ? undefined : "")),
  }));
}

/** Pull the backtick template literal that contains `anchor`. */
function grabLiteral(anchor: string): string {
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error(`anchor not found: ${anchor}`);
  const start = src.lastIndexOf("`", at);
  if (start < 0) throw new Error(`no opening backtick before: ${anchor}`);
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === "\\") { i += 2; continue; }
    if (src[i] === "`") break;
    i++;
  }
  return src.slice(start, i + 1);
}

/** Pull a whole `function name(...) {...}` block, brace-matched. */
function grabFunction(name: string): string {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`function not found: ${name}`);
  // The parameter list can contain object TYPE literals with braces, so walk the
  // parens first and only then take the next `{` as the function body.
  let parens = 0, open = -1;
  for (let i = src.indexOf("(", at); i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") { parens--; if (parens === 0) { open = src.indexOf("{", i); break; } }
  }
  if (open < 0) throw new Error(`no body found for ${name}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const transpiler = new Bun.Transpiler({ loader: "ts" });

function loadFunction(name: string, helpers: Record<string, unknown>) {
  const js = transpiler.transformSync(grabFunction(name));
  const keys = Object.keys(helpers);
  const fn = new Function(...keys, `${js}\nreturn ${name};`)(...keys.map((k) => helpers[k]));
  return fn as (...a: any[]) => string;
}

const MAX_TRANSCRIPT =
  "The caller said they have a leaking water heater in the garage and it has been dripping since last night, " +
  "they want someone to come out as soon as possible, preferably in the morning before they leave for work, " +
  "and asked whether the visit fee is waived if they approve the repair on the same day.";

/** A transcript of the length Gemini usually returns: one brief sentence. */
const TYPICAL_TRANSCRIPT = "Caller asked about a water heater leak and booked a visit for Tuesday at 2 PM.";

interface Row { message: string; text: string }
const rows: Row[] = [];
const skipped: string[] = [];

function add(message: string, thunk: () => string) {
  try { rows.push({ message, text: thunk() }); }
  catch (e) { skipped.push(`${message}: ${String((e as Error).message).slice(0, 60)}`); }
}

const helpers = {
  truncateWords: (t: string, max: number) => {
    const clean = (t || "").replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    const budget = Math.max(0, max - 3);
    let cut = clean.slice(0, budget);
    const sp = cut.lastIndexOf(" ");
    if (sp > budget * 0.5) cut = cut.slice(0, sp);
    return cut.replace(/[\s,;:.!?-]+$/, "") + "...";
  },
  gsm7Safe: (t: string) => t,
  formatSummaryAppt: () => "",
  SUMMARY_TRANSCRIPT_MAX: 0,
};

/**
 * Load buildCallSummary together with the helpers that sit immediately above it in
 * the file (gsm7Safe / truncateWords / formatSummaryAppt), so the audit measures the
 * real pipeline rather than a re-implementation.
 */
function loadSummary() {
  const from = src.indexOf("const GSM7_BASIC");
  const at = src.indexOf("function buildCallSummary(");
  if (at < 0) throw new Error("function not found: buildCallSummary");
  // End of buildCallSummary: brace-match its body.
  let parens = 0, open = -1;
  for (let i = src.indexOf("(", at); i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") { parens--; if (parens === 0) { open = src.indexOf("{", i); break; } }
  }
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const slice = src.slice(from >= 0 && from < at ? from : at, end);
  const js = transpiler.transformSync(slice);
  return new Function(`${js}\nreturn buildCallSummary;`)() as (cs: any, t?: string) => string;
}

// ── Post-call summary (the owner's morning read) ──────────────────────────────
add("post-call summary · EN · booking, max transcript", () => {
  return loadSummary()({ ...SAMPLE.cs, language: "en" }, MAX_TRANSCRIPT);
});
add("post-call summary · EN · general inquiry", () => {
  return loadSummary()({ ...SAMPLE.cs, appointmentBooked: false, appointmentIntent: false, requestedCallback: false, language: "en" }, MAX_TRANSCRIPT);
});
add("post-call summary · ES · booking, max transcript", () => {
  return loadSummary()({ ...SAMPLE.cs, language: "es" }, MAX_TRANSCRIPT);
});
add("post-call summary · ES · general inquiry", () => {
  return loadSummary()({ ...SAMPLE.cs, appointmentBooked: false, appointmentIntent: false, requestedCallback: false, language: "es" }, MAX_TRANSCRIPT);
});

add("post-call summary · EN · booking, typical transcript", () => {
  return loadSummary()({ ...SAMPLE.cs, language: "en" }, TYPICAL_TRANSCRIPT);
});

// ── Booking confirmation (voice + web) ────────────────────────────────────────
add("booking confirmation · voice EN", () => evalTemplate(grabLiteral("is confirmed. We'll send a reminder before your visit. Questions? Call ${p.fromNumber}")));
add("booking confirmation · voice ES", () => evalTemplate(grabLiteral("Le enviaremos un recordatorio antes de su visita. ¿Preguntas? Llame al ${p.fromNumber}")));
add("booking confirmation · web EN", () => evalTemplate(grabLiteral("is confirmed. We'll send a reminder before your visit. Questions? Call ${orgPhone}")));

// ── Reminders (24h / 2h / follow-up) ─────────────────────────────────────────
for (const type of ["24h_before", "2h_before", "follow_up"]) {
  for (const lang of ["en", "es"] as const) {
    add(`reminder ${type} · ${lang.toUpperCase()}`, () => {
      const f = loadFunction("buildReminderMessage", helpers);
      return f(SAMPLE.p, type, lang);
    });
  }
}

// ── Owner alerts + caller-facing follow-ups ──────────────────────────────────
add("abandoned-booking follow-up · EN", () => evalTemplate(grabLiteral("You called about booking an appointment")));
add("abandoned-booking follow-up · ES", () => evalTemplate(grabLiteral("Recibimos su llamada sobre una cita")));
add("owner transfer text-on-miss · EN", () => evalTemplate(grabLiteral("asked to speak with you and you missed the transfer")));
add("owner transfer text-on-miss · ES", () => evalTemplate(grabLiteral("no atendio la transferencia")));
add("transfer dial-failed alert · EN", () => evalTemplate(grabLiteral("asked to speak with you and the transfer failed")));
add("transfer dial-failed alert · ES", () => evalTemplate(grabLiteral("no pudimos transferir la llamada")));
add("callback alert to caller · EN", () => evalTemplate(grabLiteral("thanks for your interest. Someone from")));
add("callback alert to caller · ES", () => evalTemplate(grabLiteral("gracias por su interés. Alguien de")));
// The body interpolates a label built one line above it (`Name (+1...)`), so the scope
// supplies a representative one — the literal itself only names the variable.
add("low-rating owner alert · EN", () =>
  evalTemplate(grabLiteral("Low rating ("), { callerLabel: "Maria (+18135551234)" }));
add("waitlist slot opened · EN", () => evalTemplate(grabLiteral("A slot just opened on")));
add("reschedule confirmation · EN", () => evalTemplate(grabLiteral("Your appointment has been rescheduled to")));
add("reschedule confirmation · ES", () => evalTemplate(grabLiteral("Su cita ha sido reprogramada")));

// ── Report ───────────────────────────────────────────────────────────────────
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
console.log(`\n=== ${file} ===`);
console.log(pad("message", 48), pad("chars", 6), pad("units", 6), pad("enc", 7), pad("parts", 6), "cost");
console.log("-".repeat(90));
let totalParts = 0;
for (const r of rows) {
  const s = smsStats(r.text);
  totalParts += s.parts;
  console.log(
    pad(r.message, 48), pad(String(s.characters), 6), pad(String(s.units), 6),
    pad(s.encoding, 7), pad(String(s.parts), 6), `$${smsCostUsd(s.parts).toFixed(4)}`,
  );
  if (s.offenders.length) console.log(`    ↳ UCS-2 forced by: ${s.offenders.map((c) => JSON.stringify(c)).join(" ")}`);
  if (process.argv.includes("--text")) console.log(r.text.replace(/\n/g, " ⏎ ").replace(/^/gm, "      | "));
}
console.log("-".repeat(90));
console.log(`messages: ${rows.length}   total parts: ${totalParts}   total cost: $${smsCostUsd(totalParts).toFixed(4)}`);
if (skipped.length) console.log(`\nskipped (not found / not evaluable):\n  ${skipped.join("\n  ")}`);
