/**
 * SMS encoding + segment counting (GSM 03.38 vs UCS-2).
 *
 * Why this exists: a message containing ONE character outside the GSM-7 default
 * alphabet is re-encoded as UCS-2, which drops capacity from 153 characters per
 * part to 67. That silently doubles (or triples) what we pay per SMS, because
 * Telnyx bills per part: $0.004/part + ~$0.012/part carrier.
 *
 * The default alphabet already covers most Spanish: ñ Ñ ¿ ¡ é à ü ä ö ß Ç É Ä Ö Ü.
 * What it does NOT cover: á í ó ú Á Í Ó Ú, emoji, curly quotes (“ ” ’), em/en dashes
 * (— –), ellipsis (…), bullet (•), and the box-drawing characters (─ →) used in code.
 *
 * Used by serve.ts (for the summary builder) and by scripts/sms-summary-parts.test.ts.
 * Pure functions, no imports — safe to run in Bun, Node and the browser.
 */

// GSM 03.38 default alphabet, basic table (one septet each).
const GSM7_BASIC = new Set<string>([
  "@", "£", "$", "¥", "è", "é", "ù", "ì", "ò", "Ç", "\n", "Ø", "ø", "\r", "Å", "å",
  "Δ", "_", "Φ", "Γ", "Λ", "Ω", "Π", "Ψ", "Σ", "Θ", "Ξ", "\u001B", "Æ", "æ", "ß", "É",
  " ", "!", "\"", "#", "¤", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?",
  "¡", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
  "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "Ä", "Ö", "Ñ", "Ü", "§",
  "¿", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o",
  "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "ä", "ö", "ñ", "ü", "à",
]);

// GSM 03.38 extension table — two septets each (escape + char), so they cost 2.
const GSM7_EXTENSION = new Set<string>(["\f", "^", "{", "}", "\\", "[", "]", "~", "|", "€"]);

export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SmsStats {
  encoding: SmsEncoding;
  /** Characters (UTF-16 code units) in the message. */
  characters: number;
  /** GSM-7 septets, or UTF-16 code units for UCS-2. This is the capacity that matters. */
  units: number;
  /** Number of SMS parts the carrier will bill. */
  parts: number;
  /** Characters that forced UCS-2 (empty when the message is GSM-7 clean). */
  offenders: string[];
}

/** Every character in `text` that is not representable in GSM-7. */
export function gsm7Offenders(text: string): string[] {
  const bad = new Set<string>();
  for (const ch of text) {
    if (!GSM7_BASIC.has(ch) && !GSM7_EXTENSION.has(ch)) bad.add(ch);
  }
  return [...bad];
}

/**
 * The encoding a carrier will actually use. Telnyx (like every US aggregator) does
 * NOT apply national-language shift tables, so anything outside the default
 * alphabet — accents included — means UCS-2 for the whole message.
 */
export function smsEncoding(text: string): SmsEncoding {
  return gsm7Offenders(text).length === 0 ? "GSM-7" : "UCS-2";
}

/**
 * Real segment count, exactly as the SMSC concatenates:
 *  - GSM-7: 160 septets single, then 153 per part (6 septets lost to the UDH).
 *  - UCS-2:  70 code units single, then  67 per part (3 lost to the UDH).
 */
export function smsParts(text: string): number {
  const encoding = smsEncoding(text);
  if (encoding === "GSM-7") {
    let septets = 0;
    for (const ch of text) septets += GSM7_EXTENSION.has(ch) ? 2 : 1;
    if (septets <= 160) return 1;
    return Math.ceil(septets / 153);
  }
  // UCS-2: count UTF-16 code units (an emoji is a surrogate pair = 2 units).
  const units = text.length;
  if (units <= 70) return 1;
  return Math.ceil(units / 67);
}

export function smsStats(text: string): SmsStats {
  const encoding = smsEncoding(text);
  let units = text.length;
  if (encoding === "GSM-7") {
    units = 0;
    for (const ch of text) units += GSM7_EXTENSION.has(ch) ? 2 : 1;
  }
  return { encoding, characters: text.length, units, parts: smsParts(text), offenders: gsm7Offenders(text) };
}

/**
 * Cut `text` to at most `max` characters on a word boundary, appending "..."
 * when anything was dropped. Never leaves a trailing space before the ellipsis,
 * and never splits a surrogate pair. ASCII-only output for ASCII-only input, so a
 * GSM-7 transcript cannot be flipped to UCS-2 by the truncation itself.
 */
export function truncateWords(text: string, max: number): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  // Reserve 3 chars for the ellipsis.
  const budget = Math.max(0, max - 3);
  let cut = clean.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > budget * 0.5) cut = cut.slice(0, lastSpace);
  // Drop a dangling surrogate half, then punctuation that now reads oddly.
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return cut.replace(/[\s,;:.!?-]+$/, "") + "...";
}

/** Cost in USD for one message at the measured $0.016 per part (Telnyx + carrier). */
export function smsCostUsd(parts: number): number {
  return Math.round(parts * 0.016 * 10000) / 10000;
}
