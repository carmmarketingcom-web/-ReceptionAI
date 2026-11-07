/**
 * Per-organization health payload for the dashboard's System health page.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `GET /api/health` is the PLATFORM health endpoint (database reachable, Telnyx balance,
 * SMS/email delivery). The balance watchdog, external uptime monitors and the test suite
 * read it, and it has no notion of an organization.
 *
 * The dashboard's System health page needs org-scoped facts. In production `serve.ts`
 * answers `/api/*` with inline handlers that shadow `src/routes/api/*.ts`, so the page was
 * calling the platform endpoint and then reading `phoneStatus.provisioned` off it — a field
 * that endpoint has never had. The page threw on `undefined.provisioned` and a paying
 * customer opening System health got a blank screen.
 *
 * This module is the ONE implementation of the org payload. Both `serve.ts` trees import it
 * (for `GET /api/health/org`) and `src/routes/api/health.ts` imports it, so the shape cannot
 * drift between deployments. Keep the copy in `site/src/lib/org-health.ts` byte-identical.
 *
 * TRUTHFULNESS RULES
 * ------------------
 *  - every value comes from the database or a real API call;
 *  - a check we cannot perform is reported as `known: false` / `null`, never as a green tick;
 *  - texting is an optional add-on, off by default, and while the shared sending number is
 *    not carrier-verified no text is delivered — email carries every notification.
 *
 * No imports: this module is loaded by the Bun server, by the Vite-built route handler and
 * by the page (for `normalizeOrgHealth`), so it must stay dependency-free.
 */

/** The tagged-template shape of `neon(url)`, injected so tests can supply a fake. */
export type SqlTag = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<any[]>;

export interface OrgHealthPhoneStatus {
  provisioned: boolean;
  number: string | null;
  /** "active" | "inactive" when a number exists, "none" when it does not. */
  status: string;
  voiceEnabled: boolean;
  /** Per-number SMS capability (phone_numbers.capabilities.sms), NOT the add-on opt-in. */
  smsEnabled: boolean;
}

export interface OrgHealthTexting {
  /** organizations.sms_enabled — the paid text-alert upgrade. Off by default. */
  addonEnabled: boolean;
  /** Has any text from the shared sender ever been delivered? null = could not check. */
  delivering: boolean | null;
}

export interface OrgHealthLastCall {
  found: boolean;
  callerNumber: string | null;
  time: string | null;
  duration: number | null;
  outcome: string | null;
  /** Demo-line calls are excluded from every owner-facing count; say how many. */
  demoCallsExcluded: number;
}

export interface OrgHealthWebhook {
  /** False when we have no way to verify the Telnyx voice config for this org. */
  known: boolean;
  /** null when unknown. Never guessed from "we have seen a call". */
  configured: boolean | null;
  lastReceived: string | null;
  recent: boolean;
  source: "telnyx" | "call-events" | "none";
}

export interface OrgHealth {
  organization: { id: string; name: string | null; timezone: string | null };
  phoneStatus: OrgHealthPhoneStatus;
  texting: OrgHealthTexting;
  lastCall: OrgHealthLastCall;
  webhookStatus: OrgHealthWebhook;
  scheduleStatus: { upcoming: number };
  /** True only when every check we could run came back healthy. */
  allOk: boolean;
  /** Names of checks that could not be verified from our side (e.g. "webhook"). */
  unknowns: string[];
  tips: string[];
  checkedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function countOf(row: any): number {
  const n = Number(row?.n ?? row?.count ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build the dashboard health payload for one organization.
 *
 * `sql` is the `neon()` tagged-template function (injected so this is testable without a
 * database). Every query is scoped to `organizationId` — a caller can never see another
 * tenant's number, calls or appointments.
 */
export async function buildOrgHealth(sql: SqlTag, organizationId: string): Promise<OrgHealth> {
  const now = Date.now();

  // 1. The organization itself — name/timezone for display, sms_enabled for the add-on state.
  const orgRows = await sql`
    SELECT id, name, timezone, sms_enabled
    FROM organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `;
  const org = orgRows[0] || null;

  // 2. Phone number. `phone_numbers` has no status/sms_enabled/voice_enabled columns:
  //    liveness is is_active and the capabilities live in the capabilities JSONB.
  const phoneRows = await sql`
    SELECT phone_number, is_active, capabilities, telnyx_number_id
    FROM phone_numbers
    WHERE organization_id = ${organizationId}
    ORDER BY is_active DESC, created_at DESC
    LIMIT 1
  `;
  const phone = phoneRows[0] || null;
  const caps = (phone?.capabilities || {}) as { voice?: boolean; sms?: boolean };
  const phoneStatus: OrgHealthPhoneStatus = phone
    ? {
        provisioned: true,
        number: phone.phone_number || null,
        status: phone.is_active === false ? "inactive" : "active",
        voiceEnabled: caps.voice !== false,
        smsEnabled: caps.sms !== false,
      }
    : { provisioned: false, number: null, status: "none", voiceEnabled: false, smsEnabled: false };

  // 3. Texting. The opt-in is organizations.sms_enabled. Whether a text can actually
  //    arrive is a property of the ONE shared sending number, so the platform-wide
  //    delivery record is the honest answer for every org. Unreadable → null (unknown).
  const texting: OrgHealthTexting = { addonEnabled: org?.sms_enabled === true, delivering: null };
  try {
    const delivered = await sql`SELECT COUNT(*) AS n FROM sms_deliveries WHERE status = 'delivered'`;
    texting.delivering = countOf(delivered[0]) > 0;
  } catch {
    texting.delivering = null;
  }

  // 4. Last real call. Demo-line traffic (is_demo) is excluded, exactly like every other
  //    owner-facing count on the dashboard, so a test call never reads as a customer call.
  const callRows = await sql`
    SELECT c.started_at, c.ended_at, c.status, c.ai_handled, c.escalated_to_human,
           co.phone AS caller_number
    FROM conversations c
    LEFT JOIN contacts co ON co.id = c.contact_id
    WHERE c.organization_id = ${organizationId}
      AND c.type = 'call'
      AND c.is_demo = false
    ORDER BY c.started_at DESC
    LIMIT 1
  `;
  const call = callRows[0] || null;
  let demoCallsExcluded = 0;
  try {
    const demoRows = await sql`
      SELECT COUNT(*) AS n FROM conversations
      WHERE organization_id = ${organizationId} AND is_demo = true
    `;
    demoCallsExcluded = countOf(demoRows[0]);
  } catch {
    demoCallsExcluded = 0;
  }

  const startedAt = isoOrNull(call?.started_at);
  const endedAt = isoOrNull(call?.ended_at);
  const duration = startedAt && endedAt
    ? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000))
    : null;
  const lastCall: OrgHealthLastCall = call
    ? {
        found: true,
        callerNumber: call.caller_number || null,
        time: startedAt,
        duration,
        outcome: call.ai_handled
          ? "AI handled"
          : call.escalated_to_human
            ? "Transferred to human"
            : (call.status || "unknown"),
        demoCallsExcluded,
      }
    : { found: false, callerNumber: null, time: null, duration: null, outcome: null, demoCallsExcluded };

  // 5. Webhook. The only way to VERIFY the Telnyx voice config is the Telnyx API for a
  //    number whose telnyx_number_id we hold. When we cannot check it we say so — the old
  //    code reported "configured" whenever a call had been seen, which is a guess, and a
  //    green tick built on a guess is worse than "not checked".
  const webhookStatus: OrgHealthWebhook = {
    known: false,
    configured: null,
    lastReceived: lastCall.time,
    recent: lastCall.time ? now - Date.parse(lastCall.time) < DAY_MS : false,
    source: lastCall.time ? "call-events" : "none",
  };
  const telnyxApiKey = process.env.TELNYX_API_KEY || "";
  const telnyxNumberId = phone?.telnyx_number_id || "";
  if (telnyxNumberId && telnyxApiKey) {
    try {
      const res = await fetch(`https://api.telnyx.com/v2/phone_numbers/${telnyxNumberId}/voice`, {
        headers: { Authorization: `Bearer ${telnyxApiKey}` },
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const voice = data?.data || {};
        webhookStatus.known = true;
        webhookStatus.source = "telnyx";
        webhookStatus.configured = !!(voice.connection_id || voice.call_hangup_url || voice.call_answering_url);
      }
    } catch {
      // Telnyx unreachable: leave known=false rather than inventing an answer.
    }
  }

  // 6. Upcoming appointments (the same window the schedule page shows).
  let upcoming = 0;
  try {
    const apptRows = await sql`
      SELECT COUNT(*) AS n FROM appointments
      WHERE organization_id = ${organizationId}
        AND start_time >= NOW()
        AND status IN ('confirmed', 'scheduled')
    `;
    upcoming = countOf(apptRows[0]);
  } catch {
    upcoming = 0;
  }

  // 7. Aggregate + honest tips.
  const unknowns: string[] = [];
  if (!webhookStatus.known) unknowns.push("webhook");

  const allOk =
    phoneStatus.provisioned &&
    lastCall.found &&
    webhookStatus.configured !== false;

  const tips: string[] = [];
  if (!phoneStatus.provisioned) {
    tips.push("No phone number is provisioned for this account yet. Contact support and we will assign one.");
  }
  if (!lastCall.found) {
    tips.push(
      phoneStatus.provisioned
        ? `No customer calls yet. Forward your business line to ${phoneStatus.number} so ReceptionAI can answer. If you kept your own number, set up call forwarding with your carrier.`
        : "No customer calls yet. Once a number is provisioned, forward your business line to it.",
    );
  }
  if (webhookStatus.configured === false) {
    tips.push("Telnyx reports that the voice webhook is not attached to your number, so incoming calls will not reach the AI. Contact support.");
  }
  if (texting.addonEnabled && texting.delivering === false) {
    tips.push("Text alerts are switched on, but no text has been delivered yet. Email is carrying every notification in the meantime.");
  }

  return {
    organization: { id: org?.id || organizationId, name: org?.name || null, timezone: org?.timezone || null },
    phoneStatus,
    texting,
    lastCall,
    webhookStatus,
    scheduleStatus: { upcoming },
    allOk,
    unknowns,
    tips,
    checkedAt: new Date(now).toISOString(),
  };
}

// ─── Client-side hardening ──────────────────────────────────────────────────
// The page must never throw because a field changed shape. Every read goes through this
// normalizer, which turns anything (null, an error body, the OLD platform /api/health
// payload) into a fully populated object and records which fields were absent.

export interface NormalizedOrgHealth extends OrgHealth {
  /** Top-level keys the server did not send — surfaced to the user, never hidden. */
  missing: string[];
}

const REQUIRED_KEYS = [
  "phoneStatus",
  "lastCall",
  "webhookStatus",
  "scheduleStatus",
  "allOk",
  "tips",
] as const;

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function asNumber(value: unknown): number | null {
  // Number(null) is 0 and Number("") is 0 — neither is a real measurement.
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Turn any server response into a fully-populated, renderable payload. Never throws. */
export function normalizeOrgHealth(raw: unknown): NormalizedOrgHealth {
  const src = asObject(raw);
  const phone = asObject(src.phoneStatus);
  const texting = asObject(src.texting);
  const call = asObject(src.lastCall);
  const hook = asObject(src.webhookStatus);
  const sched = asObject(src.scheduleStatus);
  const org = asObject(src.organization);

  const provisioned = phone.provisioned === true;
  const missing = REQUIRED_KEYS.filter((k) => src[k] === undefined || src[k] === null);

  return {
    organization: {
      id: asString(org.id) || "",
      name: asString(org.name),
      timezone: asString(org.timezone),
    },
    phoneStatus: {
      provisioned,
      number: asString(phone.number),
      status: asString(phone.status) || (provisioned ? "active" : "none"),
      voiceEnabled: phone.voiceEnabled === true,
      smsEnabled: phone.smsEnabled === true,
    },
    texting: {
      addonEnabled: texting.addonEnabled === true,
      delivering: typeof texting.delivering === "boolean" ? texting.delivering : null,
    },
    lastCall: {
      found: call.found === true,
      callerNumber: asString(call.callerNumber),
      time: asString(call.time),
      duration: asNumber(call.duration),
      outcome: asString(call.outcome),
      demoCallsExcluded: asNumber(call.demoCallsExcluded) || 0,
    },
    webhookStatus: {
      known: hook.known === true,
      configured: typeof hook.configured === "boolean" ? hook.configured : null,
      lastReceived: asString(hook.lastReceived),
      recent: hook.recent === true,
      source: asString(hook.source) || "none",
    },
    scheduleStatus: { upcoming: asNumber(sched.upcoming) || 0 },
    allOk: src.allOk === true,
    unknowns: Array.isArray(src.unknowns) ? src.unknowns.filter((u: unknown) => typeof u === "string") : [],
    tips: Array.isArray(src.tips) ? src.tips.filter((t: unknown) => typeof t === "string") : [],
    checkedAt: asString(src.checkedAt) || "",
    missing,
  };
}
