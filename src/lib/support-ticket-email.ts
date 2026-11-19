/**
 * The emails a support ticket sends to the customer.
 *
 * Pure builders: they decide what a customer reads and never touch the network, so the wording
 * can be tested without sending anything. The caller (serve.ts / the API route) does the send.
 *
 * Rules the owner set for these:
 *   • only ever to the address that opened the ticket — no address, no email, no throw;
 *   • say what was actually done, in the customer's own words back to them;
 *   • no time promises anywhere (we have not measured a response time);
 *   • a reply goes to hello@receptionai.store, so answering the email reaches the team inbox.
 */

export const SUPPORT_REPLY_TO = "hello@receptionai.store";

export type TicketEmail = {
  to: string;
  subject: string;
  text: string;
  replyTo: string;
};

export type SupportTicketEmailInput = {
  id?: string | null;
  shortId?: string | null;
  subject?: string | null;
  message?: string | null;
  createdAt?: string | null;
  openedByEmail?: string | null;
  businessName?: string | null;
  status?: string | null;
  resolution?: string | null;
  resolvedAt?: string | null;
  teamReply?: string | null;
  repliedAt?: string | null;
  /** The rendered context snapshot, for the "email me a copy" record. */
  contextText?: string | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A date a customer can read. UTC on purpose: the server has no reliable local timezone. */
export function formatTicketDate(iso: string | null | undefined): string {
  if (!iso) return "an earlier date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "an earlier date";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function ticketShortId(t: SupportTicketEmailInput): string {
  const given = String(t.shortId || "").trim();
  if (given) return given;
  const id = String(t.id || "").trim();
  return id ? id.slice(0, 8) : "unknown";
}

/** The customer's own words, indented and trimmed so the email stays readable. */
function quoted(text: string | null | undefined, max = 400): string {
  let t = String(text || "").trim();
  if (!t) return "";
  if (t.length > max) t = t.slice(0, max).trimEnd() + "…";
  return t
    .split(/\r?\n/)
    .map((line) => "  " + line.trim())
    .join("\n");
}

function indented(text: string): string {
  return String(text || "")
    .trim()
    .split(/\r?\n/)
    .map((line) => "  " + line.trim())
    .join("\n");
}

function recipient(t: SupportTicketEmailInput): string {
  return String(t.openedByEmail || "").trim();
}

function businessName(t: SupportTicketEmailInput): string {
  return String(t.businessName || "").trim() || "your business";
}

/** The line the customer reads when we closed a ticket without writing anything down. */
export const DEFAULT_RESOLUTION_LINE =
  "We checked your report and closed it. Reply to this email if anything still looks wrong.";

/**
 * Sent when a ticket is resolved. Returns null when the ticket has no email address (a
 * phone-only business) — the caller then sends nothing, silently.
 */
export function buildResolutionEmail(t: SupportTicketEmailInput): TicketEmail | null {
  const to = recipient(t);
  if (!to) return null;
  const sid = ticketShortId(t);
  const resolution = String(t.resolution || "").trim();
  const lines: string[] = [
    "Hi,",
    "",
    `You reported this to ${businessName(t)} on ${formatTicketDate(t.createdAt)}:`,
    "",
    `  "${String(t.subject || "").trim() || "(no subject)"}"`,
  ];
  const message = quoted(t.message, 400);
  if (message) lines.push(`  "${message.trimStart()}"`);
  lines.push("");
  lines.push("What we did:");
  lines.push(indented(resolution || DEFAULT_RESOLUTION_LINE));
  lines.push("");
  lines.push("If it happens again, reply to this email and we will reopen the ticket.");
  lines.push("");
  lines.push(`Ticket: #${sid}`);
  lines.push("— ReceptionAI support");
  return {
    to,
    subject: `Your ReceptionAI support ticket #${sid} has been resolved`,
    text: lines.join("\n"),
    replyTo: SUPPORT_REPLY_TO,
  };
}

/** Sent when we reply to a ticket without closing it. */
export function buildReplyEmail(t: SupportTicketEmailInput): TicketEmail | null {
  const to = recipient(t);
  if (!to) return null;
  const reply = String(t.teamReply || "").trim();
  if (!reply) return null;
  const sid = ticketShortId(t);
  const lines: string[] = [
    "Hi,",
    "",
    `You reported this to ${businessName(t)} on ${formatTicketDate(t.createdAt)}:`,
    "",
    `  "${String(t.subject || "").trim() || "(no subject)"}"`,
    "",
    "Our reply:",
    indented(reply),
    "",
    "If anything still looks wrong, reply to this email and we will pick it up again.",
    "",
    `Ticket: #${sid}`,
    "— ReceptionAI support",
  ];
  return {
    to,
    subject: `Re: your ReceptionAI support ticket #${sid}`,
    text: lines.join("\n"),
    replyTo: SUPPORT_REPLY_TO,
  };
}

/**
 * "Email me a copy" — the whole record: what was reported, the context snapshot we captured,
 * what was done and the dates. No status change.
 */
export function buildTicketCopyEmail(t: SupportTicketEmailInput): TicketEmail | null {
  const to = recipient(t);
  if (!to) return null;
  const sid = ticketShortId(t);
  const status = String(t.status || "open").trim() || "open";
  const lines: string[] = [
    "Hi,",
    "",
    `Here is a copy of the report you sent to ${businessName(t)} on ${formatTicketDate(t.createdAt)}.`,
    "",
    "What you reported:",
    `  "${String(t.subject || "").trim() || "(no subject)"}"`,
  ];
  const message = quoted(t.message, 1200);
  if (message) lines.push(`  "${message.trimStart()}"`);
  lines.push("");
  lines.push(`Status: ${status}`);
  lines.push(`Reported: ${formatTicketDate(t.createdAt)}`);
  if (t.repliedAt) lines.push(`We replied: ${formatTicketDate(t.repliedAt)}`);
  if (t.resolvedAt) lines.push(`Resolved: ${formatTicketDate(t.resolvedAt)}`);
  const reply = String(t.teamReply || "").trim();
  if (reply) {
    lines.push("");
    lines.push("Our last reply:");
    lines.push(indented(reply));
  }
  const resolution = String(t.resolution || "").trim();
  if (resolution) {
    lines.push("");
    lines.push("What we did:");
    lines.push(indented(resolution));
  }
  const context = String(t.contextText || "").trim();
  if (context) {
    lines.push("");
    lines.push("--- What we recorded with your report ---");
    lines.push(context);
    lines.push("--- end of record ---");
  }
  lines.push("");
  lines.push(`Ticket: #${sid}`);
  lines.push("— ReceptionAI support");
  return {
    to,
    subject: `Your ReceptionAI support ticket #${sid} — full record`,
    text: lines.join("\n"),
    replyTo: SUPPORT_REPLY_TO,
  };
}
