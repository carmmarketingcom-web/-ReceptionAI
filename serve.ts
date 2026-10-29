// Production server — AI Receptionist
// Auto-load .env file (Bun v1.3 does not support process.loadEnvFile)
try { const envContent = await (await import("fs")).promises.readFile(".env", "utf-8"); for (const line of envContent.split("\n")) { const idx = line.indexOf("="); if (idx > 0 && !line.startsWith("#")) { const key = line.slice(0, idx).trim(); const val = line.slice(idx + 1).trim(); if (key && !process.env[key]) process.env[key] = val; } } } catch {}
// Security: fail fast if JWT_SECRET is missing/short (never sign with a weak/fallback secret)
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("[FATAL] JWT_SECRET is missing or shorter than 32 chars. Refusing to start: auth tokens must never use a weak/fallback secret.");
  process.exit(1);
}
import handler from "./dist/server/server.js";
import { neon } from "@neondatabase/serverless";
import { createHmac, timingSafeEqual } from "node:crypto";

const PORT = parseInt(process.env.PORT || "3000");
const HOST = "0.0.0.0";
const CLIENT_DIR = `${import.meta.dir}/dist/client`;

// ── Gemini ───────────────────────────────────────────────────────────────────
async function aiRespond(userText: string): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) return "";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: "You are a professional AI receptionist. Keep responses BRIEF (1-2 sentences). Be friendly." }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );
    const data = await res.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch { return ""; }
}

// ── Telnyx API ───────────────────────────────────────────────────────────────
const TELNYX = "https://api.telnyx.com/v2";
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID || "";
function th() { return { Authorization: `Bearer ${process.env.TELNYX_API_KEY || ""}`, "Content-Type": "application/json" }; }

// The longer beat between "here is the menu" and the first option. Declared up here because
// DEMO_EN is a module-level initialiser that references it (a `const` declared further down
// would be in its temporal dead zone and crash the process at boot — caught by the call sim).
const OPTION_PAUSE = 500;

// ── Database-driven org lookup by phone number ────────────────────────────
async function getOrgByPhoneNumber(phoneNumber: string): Promise<{ name: string; orgId: string } | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT o.name, o.id as org_id
      FROM phone_numbers pn
      JOIN organizations o ON o.id = pn.organization_id
      WHERE pn.phone_number = ${phoneNumber}
        AND pn.is_active = true
      LIMIT 1
    `;
    if (rows[0]) return { name: rows[0].name as string, orgId: rows[0].org_id as string };
    return null;
  } catch (err) {
    console.error("[DB] phone lookup failed:", String(err).slice(0, 100));
    return null;
  }
}

// ── Greeting (owner-approved wording, 2026-10-29) ────────────────────────────
// The English greeting is the owner's verbatim script: warm welcome, "24/7 virtual receptionist,
// and we can help you right now", then the menu instruction, then ONE OPTION PER UTTERANCE. The
// old line spliced five options into one comma run — with a neural voice that reads as a single
// rushed breath, which is exactly the owner's complaint. The DTMF mapping is unchanged
// (1 appointments, 2 services, 3 team member, 4 reschedule, 5 availability, 9 voicemail), and
// the owner-rejected phrase "we're busy helping other clients" appears nowhere.
// Returns a list so the caller can speak it with real beats between ideas (see speakLines).
// Spanish used to return one run-on sentence; since 2026-10-29 it returns the same LIST shape
// as English (see ES_GREETING_BODY) so each option gets its own utterance and its own beat.
// The Spanish menu, one option per utterance (2026-10-29). Same options as English — including
// leave a message (9) and talk to a real person (3, the owner-transfer path) — because Spanish
// used to be a single run-on sentence and a caller could not tell what the menu actually offered.
// Declared here, above buildGreetingLines, because OPTION_PAUSE must already be initialised (the
// 2026-10-29 boot-crash lesson: a module-level initialiser reading a later const is a TDZ crash).
const ES_GREETING_BODY: SpokenLine[] = [
  `Le atiende nuestro recepcionista virtual, disponible las 24 horas, y podemos ayudarle ahora mismo.`,
  `Elija una opción del menú para que le dirijamos a la persona correcta.`,
  { pauseMs: OPTION_PAUSE },
  `Presione 1 para citas.`,
  `Presione 2 para servicios.`,
  `Presione 3 para hablar con una persona.`,
  `Presione 4 para reprogramar.`,
  `Presione 5 para disponibilidad.`,
  `O presione 9 para dejar un mensaje.`,
];
function buildGreetingLines(orgName: string, lang: string, callerContext?: CallerContext): SpokenLine[] {
  const es = lang === "es";
  if (callerContext) {
    if (callerContext.previousVisits > 0 && callerContext.firstName) {
      if (es) {
        const opener = callerContext.lastService
          ? `¡Bienvenido de nuevo, ${callerContext.firstName}! Su última visita fue por ${callerContext.lastService}.`
          : `¡Bienvenido de nuevo, ${callerContext.firstName}!`;
        return [opener, ...ES_GREETING_BODY];
      }
      if (callerContext.lastService) {
        return [`Welcome back, ${callerContext.firstName}! Last visit: ${callerContext.lastService}. Press 1 to book, 2 for services, or 3 for a team member.`];
      }
      return [`Welcome back, ${callerContext.firstName}! Press 1 for appointments, 2 for services, or 3 for a team member.`];
    }
  }
  if (es) {
    return [`Hola, se ha comunicado con ${orgName}.`, ...ES_GREETING_BODY];
  }
  return [
    `Thanks for calling ${orgName}!`,
    `You've reached our 24/7 virtual receptionist, and we can help you right now.`,
    `Please choose from the menu so we can get you to the right person faster.`,
    { pauseMs: OPTION_PAUSE },
    `Press 1 for appointments.`,
    `Press 2 for services.`,
    `Press 3 for a team member.`,
    `Press 4 to reschedule.`,
    `Press 5 for availability.`,
    `Or press 9 to leave a message.`,
  ];
}

interface CallerContext {
  firstName?: string;
  lastName?: string;
  preferredLanguage?: string;
  previousVisits: number;
  lastCallDaysAgo?: number;
  lastService?: string;
  contactId?: string;
}

// ── Caller history lookup ─────────────────────────────────────────────────
async function lookupCallerHistory(phoneNumber: string, orgId: string): Promise<CallerContext | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const sql = neon(dbUrl);

    // Look up contact by phone number within the org
    const contacts = await sql`
      SELECT id, first_name, last_name, preferred_language, last_contacted_at
      FROM contacts
      WHERE phone = ${phoneNumber}
        AND organization_id = ${orgId}
      ORDER BY last_contacted_at DESC NULLS LAST
      LIMIT 1
    `;

    // Count previous conversations
    const countRows = await sql`
      SELECT COUNT(*) as total
      FROM conversations
      WHERE organization_id = ${orgId}
        AND EXISTS (
          SELECT 1 FROM contacts c
          WHERE c.id = conversations.contact_id
            AND c.phone = ${phoneNumber}
        )
    `;
    const previousVisits = Number(countRows[0]?.total || 0);

    // Get the last service from conversations/messages
    const lastServiceRows = await sql`
      SELECT c.id as conversation_id, m.content, c.started_at
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE ct.phone = ${phoneNumber}
        AND c.organization_id = ${orgId}
      ORDER BY c.started_at DESC
      LIMIT 1
    `;

    let lastService: string | undefined;
    let lastCallDaysAgo: number | undefined;

    if (lastServiceRows[0]) {
      // Try to extract service name from the conversation subject or messages
      // Check if any appointment was booked from this conversation
      const aptRows = await sql`
        SELECT title FROM appointments
        WHERE conversation_id = ${lastServiceRows[0].conversation_id}
        LIMIT 1
      `;
      if (aptRows[0]?.title) {
        lastService = aptRows[0].title as string;
      }

      // Calculate days since last call
      if (lastServiceRows[0].started_at) {
        const lastCall = new Date(lastServiceRows[0].started_at as string);
        const now = new Date();
        lastCallDaysAgo = Math.floor((now.getTime() - lastCall.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const contact = contacts[0];
    if (!contact && previousVisits === 0) return null;

    return {
      firstName: contact?.first_name || undefined,
      lastName: contact?.last_name || undefined,
      preferredLanguage: contact?.preferred_language || undefined,
      previousVisits: previousVisits || (contact ? 1 : 0),
      lastCallDaysAgo,
      lastService,
      contactId: contact?.id || undefined,
    };
  } catch (err) {
    console.error("[DB] caller lookup failed:", String(err).slice(0, 100));
    return null;
  }
}

// ── Save caller history after call ────────────────────────────────────────
async function saveCallerHistory(cs: CallState): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !cs.orgId) return;
  try {
    const sql = neon(dbUrl);

    // Upsert contact
    const existingContact = await sql`
      SELECT id FROM contacts
      WHERE phone = ${cs.callerNumber}
        AND organization_id = ${cs.orgId}
      LIMIT 1
    `;

    let contactId: string;
    if (existingContact[0]) {
      contactId = existingContact[0].id as string;
      await sql`
        UPDATE contacts
        SET last_contacted_at = NOW(), updated_at = NOW()
        WHERE id = ${contactId}
      `;
    } else {
      const newId = crypto.randomUUID();
      contactId = newId;
      await sql`
        INSERT INTO contacts (id, organization_id, phone, last_contacted_at)
        VALUES (${newId}, ${cs.orgId}, ${cs.callerNumber}, NOW())
      `;
    }

    // Resolve the dialed line so per-line analytics work (best effort — never blocks the call record)
    let phoneNumberId: string | null = null;
    try {
      const pnRows = await sql`
        SELECT id FROM phone_numbers
        WHERE phone_number = ${cs.toNumber}
          AND is_active = true
        LIMIT 1
      `;
      phoneNumberId = (pnRows[0]?.id as string) || null;
    } catch (err) {
      console.warn("[DB] phone number lookup failed (analytics only):", String(err).slice(0, 100));
    }

    // Outcome wording is identical to buildCallSummary() and the hangup summary, so the
    // owner's SMS text and the database row can never disagree. Phase 2 unifies them.
    const outcome = cs.appointmentBooked ? "Appointment booked"
      : cs.requestedCallback ? "Requested owner callback"
      : cs.appointmentIntent ? "Appointment interest" : "General inquiry";
    // Status is derived from what actually happened, never hardcoded: a booking is a normal
    // completion, an owner transfer and a voicemail are their own outcomes, and "missed" means
    // the caller never engaged at all (no language choice, no DTMF) — the same heuristic the
    // missed-call auto-callback uses.
    const status = cs.appointmentBooked ? 'ended'
      : cs.transferred ? 'transferred'
      : cs.voicemail ? 'voicemail'
      : !cs.answered && cs.dtmfHistory.length === 0 ? 'missed'
      : 'ended';
    const endedAt = new Date();
    const metadata = JSON.stringify({
      outcome,
      appointmentBooked: cs.appointmentBooked,
      appointmentIntent: cs.appointmentIntent,
      requestedCallback: cs.requestedCallback,
      transferred: cs.transferred,
      answered: cs.answered,
      dtmf: cs.dtmfHistory,
      language: cs.language,
    });

    // The conversation row already exists — it was created when the call was ANSWERED
    // (ensureCallConversation). Finish it in place so one call stays one conversation row and
    // any recording written mid-call keeps a valid parent. The INSERT is only the fallback for
    // a call whose create-at-answer write never landed (server restart mid-call, or a call that
    // started before this deploy).
    await cs.convReady?.catch(() => {});
    let conversationId: string | null = cs.conversationId || null;
    if (!conversationId) {
      const existing = await sql`
        SELECT id FROM conversations
        WHERE organization_id = ${cs.orgId} AND twilio_call_sid = ${cs.callControlId || null}
        ORDER BY created_at DESC LIMIT 1
      `;
      conversationId = (existing[0]?.id as string) || null;
    }
    if (conversationId) {
      await sql`
        UPDATE conversations SET
          contact_id = ${contactId},
          phone_number_id = ${phoneNumberId},
          status = ${status}::conversation_status,
          ended_at = ${endedAt.toISOString()},
          escalated_to_human = ${cs.transferred},
          escalated_at = ${cs.transferred ? endedAt.toISOString() : null},
          metadata = ${metadata}::jsonb,
          updated_at = NOW()
        WHERE id = ${conversationId}
      `;
    } else {
      conversationId = crypto.randomUUID();
      await sql`
        INSERT INTO conversations
          (id, organization_id, contact_id, phone_number_id, type, status, direction,
           twilio_call_sid, started_at, ended_at, escalated_to_human, escalated_at, metadata)
        VALUES
          (${conversationId}, ${cs.orgId}, ${contactId}, ${phoneNumberId}, 'call', ${status}::conversation_status, 'inbound',
           ${cs.callControlId || null}, ${cs.startTime.toISOString()}, ${endedAt.toISOString()},
           ${cs.transferred}, ${cs.transferred ? endedAt.toISOString() : null}, ${metadata}::jsonb)
      `;
    }
    cs.conversationId = conversationId;

    // Missed calls get their own row (this table had no writer before). missed_calls has a
    // single timestamp column (created_at), so the call start goes there and the elapsed
    // time is kept in ring_duration_seconds.
    if (status === 'missed') {
      const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - cs.startTime.getTime()) / 1000));
      await sql`
        INSERT INTO missed_calls
          (id, organization_id, phone_number_id, contact_id, caller_number, caller_name,
           twilio_call_sid, ring_duration_seconds, callback_requested, created_at)
        VALUES
          (${crypto.randomUUID()}, ${cs.orgId}, ${phoneNumberId}, ${contactId}, ${cs.callerNumber},
           ${cs.callerFirstName || null}, ${cs.callControlId || null}, ${durationSeconds},
           ${cs.requestedCallback}, ${cs.startTime.toISOString()})
      `;
    }

    // If DTMF was pressed, record it as a message
    if (cs.dtmfHistory.length > 0) {
      const dtmfContent = `DTMF pressed: ${cs.dtmfHistory.join(' → ')}`;
      await sql`
        INSERT INTO messages (id, conversation_id, organization_id, role, content, content_type)
        VALUES (${crypto.randomUUID()}, ${conversationId}, ${cs.orgId}, 'user', ${dtmfContent}, 'text')
      `;
    }

    console.log(`[DB] Saved call history: ${cs.callerNumber} → contact ${contactId.slice(0, 8)}, conv ${conversationId.slice(0, 8)}`);
  } catch (err) {
    console.error("[DB] save call history failed:", String(err).slice(0, 100));
  }
}

function buildShortPrompt(lang: string): string {
  return lang === "es"
    ? `Presione 1 para citas, 2 para servicios, 3 para hablar con alguien, 4 para reprogramar, 5 para disponibilidad, o 9 para dejar un mensaje.`
    : `Press 1 for appointments, 2 for services, 3 for a team member, 4 to reschedule, 5 for availability, or 9 to leave a message.`;
}

// ── Demo-line English script (owner report 2026-10-28) ─────────────────────
// The demo number is the product's shop window, so the English side is written the way a
// calm human receptionist talks: one idea per utterance, the option list ONCE per prompt,
// and every natural ending says plainly that this was a demo. Spanish mirrors it (DEMO_ES).
// The first line is issued on its own with stop:"all" (to clear the Spanish language prompt),
// so it lives in a named constant rather than being index-0 of a mixed list.
const DEMO_GREETING_OPENER = "Thanks for calling ReceptionAI!";
const DEMO_EN: Record<string, SpokenLine[]> = {
  // Owner-approved demo greeting (2026-10-29): same warmth as the business line, same honesty,
  // one option per utterance, and a real beat before the menu. Demo disclosure still plays on
  // every ending (see book/pricing/transfer/closing/voicemail below).
  greeting: [
    DEMO_GREETING_OPENER,
    "You've reached our 24/7 virtual receptionist, and we can help you right now.",
    "Please choose from the menu so we can get you to the right person faster.",
    { pauseMs: OPTION_PAUSE },
    "Press 1 to see how the booking works.",
    "Press 2 for pricing.",
    "Or press 3 to talk to a person.",
  ],
  book: [
    "Perfect.",
    "In a live account, this is where I'd check the calendar and hold a real appointment for you.",
    "Then I'd text you the confirmation.",
    "You're on our demo line right now, so nothing gets booked today.",
    "That was a live example of how your own business will sound with ReceptionAI.",
    "Visit receptionai.store to get started.",
    "Thanks for calling!",
  ],
  pricing: [
    "Happy to help with that.",
    "Starter is $99 a month, Growth is $199, and Scale is $399.",
    "Every plan is month to month, so there's no contract and you can cancel any time.",
    "That was a live example of how your own business will sound with ReceptionAI.",
    "Visit receptionai.store to compare the plans, or press 3 for our team.",
  ],
  transfer: [
    "Of course.",
    "In a live account, I'd put you straight through to the team right now.",
    "And I'd text them your number if nobody picked up.",
    "This is the demo line, so there's nobody on the other end today.",
    "That was a live example of how your own business will sound with ReceptionAI.",
    "Visit receptionai.store to have this answering your own calls.",
    "Thanks for calling!",
  ],
  reschedule: [
    "Of course.",
    "In a live account, I'd look up the appointment under your number and move it in a few seconds.",
    "You're on the demo line, so there's nothing to look up today.",
    "That was a live example of how your own business will sound with ReceptionAI.",
    "Visit receptionai.store to get started.",
  ],
  hours: [
    "In a live account, I'd read the calendar live and offer you the next open times, usually within seconds.",
    "The demo line doesn't have a calendar behind it, so there's nothing real to offer you here.",
    "That was a live example of how your own business will sound with ReceptionAI.",
    "Visit receptionai.store to see it running for your business.",
  ],
  notHeard: [
    "Sorry, I didn't catch that.",
    { pauseMs: OPTION_PAUSE },
    "Press 1 to see how the booking works.",
    "Press 2 for pricing.",
    "Or press 3 to talk to a person.",
  ],
  nudge: [
    "Take your time.",
    { pauseMs: OPTION_PAUSE },
    "Press 1 to see how the booking works.",
    "Press 2 for pricing.",
    "Or press 3 to talk to a person.",
  ],
  closing: [
    "No problem, I'll let you go.",
    "That was a live example of how your own business will sound with ReceptionAI.",
    "Visit receptionai.store to have it answering your own calls.",
    "Thanks for calling, and have a great day!",
  ],
  voicemail: [
    "Thanks, I've got your message.",
    "That was a live example of how your own business will sound with ReceptionAI.",
    "Visit receptionai.store to have this answering your own calls.",
    "Goodbye!",
  ],
};

// ── Demo-line Spanish script (2026-10-29 — parity with DEMO_EN) ──────────────
// The Spanish demo menu used to be ONE flat 40-word line offering three options, and a caller who
// pressed 4 was answered in English. It now mirrors the English demo line: the four things a
// caller can actually do here (see the booking demo, hear pricing, talk to a person, leave a
// message), one idea per utterance, a real beat before the option list, and a demo disclosure in
// Spanish on every ending. The DTMF mapping is identical to English.
const DEMO_ES_OPENER = "Hola, y gracias por llamar a ReceptionAI.";
const DEMO_ES: Record<string, SpokenLine[]> = {
  greeting: [
    DEMO_ES_OPENER,
    "Se ha comunicado con nuestro recepcionista virtual, disponible las 24 horas, y podemos ayudarle ahora mismo.",
    "Elija una opción del menú para que le dirijamos a la persona correcta.",
    { pauseMs: OPTION_PAUSE },
    "Presione 1 para ver cómo funciona el agendamiento.",
    "Presione 2 para información de precios.",
    "Presione 3 para hablar con una persona.",
    "O presione 9 para dejar un mensaje.",
  ],
  book: [
    "Perfecto.",
    "En una cuenta real, aquí revisaría el calendario y le reservaría una cita de verdad.",
    "Después le enviaría la confirmación por mensaje de texto.",
    "Ahora mismo está en nuestra línea de demostración, así que hoy no se reserva nada.",
    "Esto fue un ejemplo real de cómo sonará su propio negocio con ReceptionAI.",
    "Visite receptionai.store para comenzar.",
    "¡Gracias por llamar!",
  ],
  pricing: [
    "Con gusto le ayudo con eso.",
    "Starter cuesta 99 dólares al mes, Growth 199, y Scale 399.",
    "Todos los planes son mes a mes, así que no hay contrato y puede cancelar cuando quiera.",
    "Esto fue un ejemplo real de cómo sonará su propio negocio con ReceptionAI.",
    "Visite receptionai.store para comparar los planes, o presione 3 para hablar con una persona.",
  ],
  transfer: [
    "Claro que sí.",
    "En una cuenta real, le comunicaría ahora mismo con una persona del equipo.",
    "Y si nadie contestara, les enviaría su número por mensaje de texto.",
    "Esta es la línea de demostración, así que hoy no hay nadie del otro lado.",
    "Esto fue un ejemplo real de cómo sonará su propio negocio con ReceptionAI.",
    "Visite receptionai.store para que esto conteste sus propias llamadas.",
    "¡Gracias por llamar!",
  ],
  reschedule: [
    "Claro que sí.",
    "En una cuenta real, buscaría su cita con su número y la movería en unos segundos.",
    "Está en la línea de demostración, así que hoy no hay nada que buscar.",
    "Esto fue un ejemplo real de cómo sonará su propio negocio con ReceptionAI.",
    "Visite receptionai.store para comenzar.",
  ],
  hours: [
    "En una cuenta real, revisaría el calendario en vivo y le ofrecería los próximos horarios disponibles, normalmente en segundos.",
    "La línea de demostración no tiene un calendario detrás, así que aquí no hay horarios reales que ofrecerle.",
    "Esto fue un ejemplo real de cómo sonará su propio negocio con ReceptionAI.",
    "Visite receptionai.store para verlo funcionando para su negocio.",
  ],
  notHeard: [
    "Disculpe, no le entendí.",
    { pauseMs: OPTION_PAUSE },
    "Presione 1 para ver cómo funciona el agendamiento.",
    "Presione 2 para información de precios.",
    "Presione 3 para hablar con una persona.",
    "O presione 9 para dejar un mensaje.",
  ],
  nudge: [
    "Tómese su tiempo.",
    { pauseMs: OPTION_PAUSE },
    "Presione 1 para ver cómo funciona el agendamiento.",
    "Presione 2 para información de precios.",
    "Presione 3 para hablar con una persona.",
    "O presione 9 para dejar un mensaje.",
  ],
  closing: [
    "No hay problema, le dejo seguir.",
    "Esto fue un ejemplo real de cómo sonará su propio negocio con ReceptionAI.",
    "Visite receptionai.store para que esto conteste sus propias llamadas.",
    "¡Gracias por llamar, y que tenga un buen día!",
  ],
  voicemail: [
    "Gracias, recibí su mensaje.",
    "Esto fue un ejemplo real de cómo sonará su propio negocio con ReceptionAI.",
    "Visite receptionai.store para que esto conteste sus propias llamadas.",
    "¡Adiós!",
  ],
};
// Business-line Spanish pricing (a real account, not the demo line).
const ES_PRICING_LINES: SpokenLine[] = [
  "Con gusto le ayudo con eso.",
  "Starter cuesta 99 dólares al mes, Growth 199, y Scale 399.",
  "Todos los planes son mes a mes, así que no hay contrato y puede cancelar cuando quiera.",
  "Visite receptionai.store para comparar los planes, o presione 3 para hablar con una persona.",
];

// One call-control POST. Never throws: a network error, an unparseable reply or a timeout is
// reported as ok=false so the caller can fall back instead of leaving the call waiting on audio
// that will never arrive. TTS commands (speak/gather carry a `voice`) get a timeout, which turns
// a hung request into a retryable failure; hangup/bridge/dial are left untimed on purpose.
//
// It returns the PROVIDER'S OWN error text, not just a boolean. The owner's real call on
// 2026-10-29 (wltelxMg) logged "TTS RETRY / TTS FALLBACK" with no reason attached — that is how
// the ElevenLabs voice stayed broken and invisible for a week. Every rejection is now logged at
// WARN level with the HTTP status and Telnyx's error body. The key itself is never logged: the
// Telnyx API key travels in the Authorization header, and `api_key_ref` is a reference (the
// identifier of an integration secret), not a secret value.
const TTS_CMD_TIMEOUT_MS = 12000;
// `http` separates "Telnyx answered and REFUSED this command" (a dead voice → step down the
// chain for good) from "the request never completed" (network blip / timeout → try the same
// voice again on the next prompt). Only an explicit refusal may retire a voice.
type SendResult = { ok: boolean; error: string; http?: boolean };
async function sendActionEx(cid: string, action: string, body: any): Promise<SendResult> {
  const timed = !!body?.voice;
  const label = `voice=${body?.voice || "-"}${body?.payload_type === "ssml" ? " ssml" : ""}`;
  try {
    const res = await fetch(`${TELNYX}/calls/${cid}/actions/${action}`, {
      method: "POST", headers: th(), body: JSON.stringify(body),
      ...(timed ? { signal: AbortSignal.timeout(TTS_CMD_TIMEOUT_MS) } : {}),
    });
    let d: any;
    try { d = await res.json(); } catch { d = res.ok ? {} : { errors: [{ detail: `HTTP ${res.status}` }] }; }
    if (d.errors) {
      const detail = JSON.stringify(d.errors).slice(0, 400);
      console.warn(`[TTS] ${action} rejected HTTP ${res.status} ${label} — ${detail}`);
      return { ok: false, error: detail, http: true };
    }
    return { ok: true, error: "" };
  } catch (e: any) {
    const detail = String(e?.message || e).slice(0, 200);
    console.warn(`[TTS] ${action} failed ${label} — ${detail}`);
    return { ok: false, error: detail, http: false };
  }
}
async function sendAction(cid: string, action: string, body: any): Promise<boolean> {
  return (await sendActionEx(cid, action, body)).ok;
}
// True when a call-control body asks Telnyx for an ElevenLabs voice (`ElevenLabs.Default.<id>`).
function isElevenLabsVoice(body: any): boolean {
  return typeof body?.voice === "string" && body.voice.startsWith("ElevenLabs.");
}
// The same command with the optional speech-rate setting removed (see cmd() below).
function withoutSpeed(body: any): any {
  const next: any = { ...body };
  if (next.voice_settings && typeof next.voice_settings === "object") {
    const settings = { ...next.voice_settings };
    delete settings.speed;
    next.voice_settings = settings;
  }
  return next;
}
// ── Slower, warmer delivery for the fallback voice ───────────────────────────
// The owner heard Polly.Joanna-Neural at its DEFAULT rate on 2026-10-29 and said the English
// side sounds "very fast and not friendly, in a rush". Polly has no rate knob in VoiceSettings
// (voice_speed is Telnyx-Ultra-only), so the honest lever is SSML: Telnyx `speak` takes
// payload_type "ssml" and Amazon Polly honours <prosody rate="..."> (confirmed in the Telnyx
// OpenAPI spec, SpeakRequest.payload_type enum ["text","ssml"]). Note SpeakRequest.service_level
// "basic" allows ONLY en-US + text, so SSML is never the only path: if a voice or account
// rejects it, cmd() retries the same words as plain text so a caller is never left in silence.
const POLLY_RATE = process.env.POLLY_RATE || "88%";
function ssmlEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function ssmlSlow(text: string): string {
  return `<speak><prosody rate="${POLLY_RATE}">${ssmlEscape(text)}</prosody></speak>`;
}
// The same command, spoken slowly by the default Polly neural voice for that language instead.
function pollyFallbackBody(body: any): any {
  const next: any = { ...body };
  delete next.voice_settings;
  next.voice = POLLY_VOICE.en.voice;
  next.language = POLLY_VOICE.en.language;
  if (next.payload_type !== "ssml") {
    next.payload_type = "ssml";
    next.payload = ssmlSlow(String(next.payload || ""));
  }
  return next;
}
// The same Polly command with the SSML stripped back to plain text (last resort: a voice or an
// account tier that refuses payload_type "ssml" must still make a sound).
function plainPollyBody(body: any): any {
  const next: any = { ...body };
  delete next.voice_settings;
  next.voice = POLLY_VOICE.en.voice;
  next.language = POLLY_VOICE.en.language;
  delete next.payload_type;
  next.payload = String(body?.payload || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
  return next;
}
// ── English voice chain: warmth first, never silence ─────────────────────────
// Owner report #2 (2026-10-29): the English line "still sounds rushed and unfriendly" and he
// asked for a "sympathetic, harmonious" voice. Pacing alone could not fix that — the caller was
// hearing Amazon Polly's Joanna, documented as "informative, professional", which is exactly the
// businesslike tone he describes, because the ElevenLabs premium voice is refused by Telnyx on
// every real call and cmd() quietly fell back. So the VOICE ITSELF changes here.
//
// The chain is walked at runtime, warmest first: the first voice this account ACCEPTS is the one
// callers hear, and a voice Telnyx refuses is retired for the life of the process so no caller
// pays for the same rejection twice. Generative voices take plain text — they need no SSML rate
// control, the pauses come from real silence between separate speaks (TTS_PACING). Only the
// neural safety nets keep the slowed SSML wrapper, and if the account refuses SSML the same
// voice says the same words as plain text.
//
// On "Generative": Telnyx's published voice catalog (developers.telnyx.com/docs/tts-stt/
// tts-available-voices) lists standard and -Neural Polly voices only — there is no -Generative
// entry — while the OpenAPI schema shows generative voices as `aws.Polly.Generative.<VoiceId>`.
// Both spellings are probed below; if the account accepts neither, the chain lands on the warm
// conversational neural voices and finally on the known-good Joanna. Which one won is logged at
// call start (logVoiceForCall) and on every step-down, so "what did the caller hear?" is never
// a guess again.
type EnVoice = { voice: string; language: string; ssml: boolean; note: string };
const EN_VOICE_CHAIN: EnVoice[] = [
  { voice: "Polly.Danielle-Generative",    language: "en-US", ssml: false, note: "generative, warm conversational female" },
  { voice: "AWS.Polly.Generative.Danielle", language: "en-US", ssml: false, note: "generative, OpenAPI spelling" },
  { voice: "Polly.Joanna-Generative",      language: "en-US", ssml: false, note: "generative, warm US female" },
  { voice: "Polly.Ruth-Generative",        language: "en-US", ssml: false, note: "generative, friendly US female" },
  { voice: "Polly.Danielle-Neural",        language: "en-US", ssml: true,  note: "neural, conversational + slowed" },
  { voice: "Polly.Ruth-Neural",            language: "en-US", ssml: true,  note: "neural, friendly + slowed" },
  { voice: "Polly.Joanna-Neural",          language: "en-US", ssml: true,  note: "known-good safety net + slowed" },
  { voice: "Polly.Joanna",                 language: "en-US", ssml: false, note: "standard engine, last resort" },
];
// Pin one voice without a deploy (TTS_EN_VOICE=Polly.Danielle-Neural). The rest of the chain
// stays behind the pin, so a pinned voice this account refuses still cannot leave a caller silent.
const EN_VOICE_PIN = String(process.env.TTS_EN_VOICE || "").trim();
const EN_VOICES: EnVoice[] = EN_VOICE_PIN
  ? [{ voice: EN_VOICE_PIN, language: "en-US", ssml: /-Neural$/i.test(EN_VOICE_PIN), note: "pinned by TTS_EN_VOICE" },
     ...EN_VOICE_CHAIN.filter((c) => c.voice !== EN_VOICE_PIN)]
  : EN_VOICE_CHAIN;
// Voices this account explicitly refused. Process-wide and bounded; a voice that merely failed
// to answer (network blip) is NOT retired — SendResult.http tells the two apart.
const EN_VOICE_DEAD = new Set<string>();
function currentEnVoice(): EnVoice {
  for (const v of EN_VOICES) if (!EN_VOICE_DEAD.has(v.voice)) return v;
  return EN_VOICES[EN_VOICES.length - 1];
}
type ChainVoice = { voice: string; language: string; ssml: boolean; note: string };
function chainVoiceBody(text: string, v: ChainVoice): any {
  return v.ssml
    ? { payload_type: "ssml", payload: ssmlSlow(text), voice: v.voice, language: v.language }
    : { payload: text, voice: v.voice, language: v.language };
}
function enVoiceBody(text: string, v: EnVoice): any {
  return chainVoiceBody(text, v);
}

// ── Spanish voice chain: warmth first, never silence (2026-10-29) ────────────
// Spanish was the weak leg: one fixed voice, plain text, and TTS_PACING.es = 0, so every prompt
// was issued in one breath on an un-slowed voice. It now walks a chain exactly like English, so
// the caller hears the warmest voice this account ACCEPTS and a refusal can never leave them in
// silence. Candidates come from Telnyx's live voice catalogue
// (developers.telnyx.com/docs/tts-stt/tts-available-voices), NOT from guesswork:
//   · es-US female voices that exist: Lupe-Neural (neural), Lupe, Penelope (standard).
//   · es-MX female neural: Mia-Neural.  es-ES: Lucia-Neural (Castilian accent — not for US callers).
//   · There is NO "Penelope-Neural" and NO es-US Mia: Penelope is standard-engine only and Mia is
//     es-MX. Probing a voice the catalogue does not list would just buy a rejected command on the
//     first Spanish call of every process, so the chain only contains real voices.
// Warmest first: Mia-Neural is the conversational, unhurried es-MX female; Lupe-Neural (the fixed
// default this replaces) is the es-US safety net so a refused es-MX voice changes nothing for the
// caller but the accent; plain Penelope is the standard-engine last resort.
// TTS_ES_VOICE=<voice>[:<locale>] pins any voice without a deploy; the chain stays behind the pin.
const ES_VOICE_CHAIN: ChainVoice[] = [
  { voice: "Polly.Mia-Neural",  language: "es-MX", ssml: true,  note: "neural, warm conversational female (es-MX)" },
  { voice: "Polly.Lupe-Neural", language: "es-US", ssml: true,  note: "neural, US-Spanish female — the previous fixed default" },
  { voice: "Polly.Penelope",    language: "es-US", ssml: false, note: "standard engine, last resort" },
];
const ES_VOICE_PIN_RAW = String(process.env.TTS_ES_VOICE || "").trim();
const ES_VOICE_PIN: ChainVoice | null = (() => {
  if (!ES_VOICE_PIN_RAW) return null;
  const [voice, locale] = ES_VOICE_PIN_RAW.split(":");
  const known = ES_VOICE_CHAIN.find((c) => c.voice.toLowerCase() === voice.toLowerCase());
  return {
    voice,
    language: (locale || known?.language || "es-US").trim(),
    ssml: /-Neural$/i.test(voice),
    note: "pinned by TTS_ES_VOICE",
  };
})();
const ES_VOICES: ChainVoice[] = (() => {
  const pin = ES_VOICE_PIN;
  if (!pin) return ES_VOICE_CHAIN;
  return [pin, ...ES_VOICE_CHAIN.filter((c) => c.voice.toLowerCase() !== pin.voice.toLowerCase())];
})();
const ES_VOICE_DEAD = new Set<string>();
function currentEsVoice(): ChainVoice {
  for (const v of ES_VOICES) if (!ES_VOICE_DEAD.has(v.voice)) return v;
  return ES_VOICES[ES_VOICES.length - 1];
}
// Walk one language's chain: warmest first, and the first voice the account ACCEPTS is the one
// the caller hears. A voice Telnyx explicitly refuses is retired for the life of the process so
// no caller pays for the same rejection twice; a network failure is NOT retired (SendResult.http
// tells the two apart). SSML refused by the account tier falls back to the same voice and the
// same words as plain text, so a rate setting can never cost a caller the prompt.
async function walkVoiceChain(
  cid: string, action: string, text: string,
  chain: ChainVoice[], dead: Set<string>, extra: any, label: string
): Promise<boolean> {
  for (const v of chain) {
    if (dead.has(v.voice)) continue;
    let res = await sendActionEx(cid, action, { ...chainVoiceBody(text, v), ...extra });
    if (!res.ok && v.ssml) {
      // SSML refused by the account tier → same voice, same words, plain text.
      console.warn(`[TTS] SSML refused — retrying ${v.voice} as plain text (call ${String(cid).slice(-8)})`);
      res = await sendActionEx(cid, action, { ...chainVoiceBody(text, { ...v, ssml: false }), ...extra });
    }
    if (res.ok) return true;
    if (res.http) {
      dead.add(v.voice);
      if (dead.size > 50) dead.clear(); // bounded: never grow forever
      console.warn(`[TTS] VOICE REJECTED: ${v.voice} (${v.note}) — provider said: ${res.error}. Stepping down the ${label} voice chain.`);
    } else {
      console.warn(`[TTS] voice unreachable this time: ${v.voice} — ${res.error}. Trying the next voice, not retiring it.`);
    }
  }
  console.error(`[TTS] every ${label} voice was refused — this prompt has no audio (call ${String(cid).slice(-8)})`);
  return false;
}
// Every spoken command goes through here. The opt-in ElevenLabs path behaves exactly as before
// (cmd() owns its fallback); English and Spanish each walk their own voice chain.
async function voiceCmd(cid: string, action: string, text: string, lang: string, extra: any = {}): Promise<boolean> {
  const l = lang === "es" ? "es" : "en";
  if (l === "es") {
    return walkVoiceChain(cid, action, text, ES_VOICES, ES_VOICE_DEAD, extra, "Spanish");
  }
  if (ELEVENLABS_ENABLED && ELEVENLABS_API_KEY_REF) {
    return cmd(cid, action, { ...ttsVoiceParams(text, l), ...extra });
  }
  return walkVoiceChain(cid, action, text, EN_VOICES, EN_VOICE_DEAD, extra, "English");
}
// The one line to grep after a real call: exactly which English voice the caller is about to hear.
function logVoiceForCall(cid: string) {
  const v = currentEnVoice();
  const s = currentEsVoice();
  const premium = ELEVENLABS_ENABLED && ELEVENLABS_API_KEY_REF ? `, premium=ElevenLabs.Default.${ELEVENLABS_VOICE_ID}` : "";
  console.log(
    `[TTS] English voice = ${v.voice} (pacing=${TTS_PACING.en}ms${v.ssml ? `, ssml rate=${POLLY_RATE}` : ""}${premium}) ` +
    `· Spanish voice = ${s.voice} · call ${String(cid).slice(-8)}`
  );
  // Same shape as the English line: exactly which Spanish voice a caller who presses 2 will hear.
  console.log(
    `[TTS] Spanish voice = ${s.voice} (lang=${s.language}, pacing=${TTS_PACING.es}ms${s.ssml ? `, ssml rate=${POLLY_RATE}` : ""}) ` +
    `· call ${String(cid).slice(-8)}`
  );
}
// Calls where ElevenLabs already failed: skip the premium voice for the REST of that call
// instead of paying two dead round-trips (and the silent beat they cost) on every prompt.
const ELEVENLABS_DOWN = new Set<string>();
async function cmd(cid: string, action: string, body: any = {}) {
  const eleven = isElevenLabsVoice(body);
  // Known-bad voice for this call → go straight to the slowed Polly path.
  if (eleven && ELEVENLABS_DOWN.has(cid)) {
    return (await sendActionEx(cid, action, pollyFallbackBody(body))).ok;
  }
  const first = await sendActionEx(cid, action, body);
  if (first.ok) return true;
  // ── ElevenLabs safety fallback (centralised here so it covers EVERY voice command: speak,
  // gather, speakWithQueueControl, promptAndWait and any future one) ───────────────────────
  // The premium voice must never cost a caller the prompt: when Telnyx refuses an ElevenLabs
  // command (bad/expired api_key_ref, freemium account, ElevenLabs-side error, timeout), the
  // SAME command is retried once with the equivalent Polly voice. It is one logical command, so
  // callers keep counting one segment (speakOnly's speakSegments reconciliation stays exact).
  if (eleven) {
    // Step 1: retry the SAME ElevenLabs command without the optional `speed` setting. Speech
    // rate is a nicety; the premium voice is the product. If a live API ever rejects that field,
    // the caller should still hear Rachel at her default rate rather than drop to Polly.
    if (body?.voice_settings && "speed" in body.voice_settings) {
      console.warn(
        `[TTS] RETRY without speed: ${action} ${body.voice} (call ${String(cid).slice(-8)}) — ` +
        `first attempt said: ${first.error}`
      );
      if ((await sendActionEx(cid, action, withoutSpeed(body))).ok) return true;
    }
    // Step 2: provider-level failure (bad/expired integration secret, ElevenLabs plan/outage).
    // This is a WARNING, not a debug line: a silent downgrade is what hid this for a week. The
    // call keeps working in the slowed Polly voice, and every prompt for the rest of this call
    // skips ElevenLabs entirely.
    ELEVENLABS_DOWN.add(cid);
    if (ELEVENLABS_DOWN.size > 500) ELEVENLABS_DOWN.clear(); // bounded: never grow forever
    console.warn(
      `[TTS] FALLBACK: ${body.voice} is unavailable — call ${String(cid).slice(-8)} continues in ` +
      `${pollyFallbackBody(body).voice} at ${POLLY_RATE} rate. Provider error: ${first.error}`
    );
    const polly = pollyFallbackBody(body);
    if ((await sendActionEx(cid, action, polly)).ok) return true;
    // Step 3: SSML refused (service_level "basic" allows only en-US + text). Same words, plain
    // text, still preceded by the pacing gaps — slower than before but never silence.
    console.warn(`[TTS] SSML refused — retrying ${polly.voice} as plain text (call ${String(cid).slice(-8)})`);
    return (await sendActionEx(cid, action, plainPollyBody(body))).ok;
  }
  // Non-ElevenLabs SSML (the normal slowed Polly path) refused → same words as plain text.
  if (body?.payload_type === "ssml") {
    console.warn(`[TTS] SSML refused — retrying ${body.voice} as plain text (call ${String(cid).slice(-8)})`);
    return (await sendActionEx(cid, action, plainPollyBody(body))).ok;
  }
  return false;
}
// ── TTS voice selection ──────────────────────────────────────────────────────
//   Spanish — the Spanish voice chain above (warmest first: Mia-Neural → Lupe-Neural → Penelope),
//             slowed SSML with a plain-text retry, paced at TTS_PACING.es.
//   English — the voice chain above (warmest first, one voice for the whole call).
//   ElevenLabs (BYOK) — opt-in only, English only; see ELEVENLABS_ENABLED.
// Additive — previous fixes (WebSocket port, greeting, iOS CSS) are untouched.
const ELEVENLABS_API_KEY_REF = process.env.ELEVENLABS_API_KEY_REF || "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs "Rachel" (English)
// Rate of speech for the English premium voice. ElevenLabs' default (1.0) reads the script
// faster than a person would; 0.9 is unhurried without sounding sedated. Env-tunable, clamped
// to ElevenLabs' documented range in ttsVoiceParams().
const ELEVENLABS_SPEED = Number(process.env.ELEVENLABS_SPEED || "0.9");
// ElevenLabs is now OPT-IN (2026-10-29). Telnyx refuses our ElevenLabs voice on every real
// call, so it was costing each caller two dead round-trips and a silent beat before the Polly
// fallback — and the caller heard Polly anyway. Set TTS_ENABLE_ELEVENLABS=1 to keep diagnosing
// the integration; until then the English voice comes from EN_VOICE_CHAIN.
const ELEVENLABS_ENABLED = /^(1|true|yes)$/i.test(String(process.env.TTS_ENABLE_ELEVENLABS || ""));
const POLLY_VOICE: Record<"en" | "es", { voice: string; language: string }> = {
  en: { voice: "Polly.Joanna-Neural", language: "en-US" },
  // Historical Spanish default, kept as the documented es-US fallback voice. Spanish prompts no
  // longer read this: they walk ES_VOICE_CHAIN (currentEsVoice), warmest first.
  es: { voice: "Polly.Lupe-Neural", language: "es-US" },
};
function ttsVoiceParams(text: string, lang: string): any {
  const l = lang === "es" ? "es" : "en";
  // Spanish: whichever voice in the Spanish chain this account accepts (warmest first).
  if (l === "es") {
    return chainVoiceBody(text, currentEsVoice());
  }
  // English premium tier — opt-in only. Kept intact so the integration can still be diagnosed by
  // flipping one env var; it is off the default path because Telnyx refuses it on real calls and
  // the caller heard Polly anyway.
  if (ELEVENLABS_ENABLED && ELEVENLABS_API_KEY_REF) {
    const settings: any = { api_key_ref: ELEVENLABS_API_KEY_REF };
    // `speed` is the documented ElevenLabs-only field of Telnyx VoiceSettings (distinct from
    // `voice_speed`, which applies to Telnyx Ultra voices only), kept inside ElevenLabs' 0.7–1.2
    // window. cmd() retries without it if the live API refuses it, so a tuning value can never
    // cost a caller the premium voice.
    if (Number.isFinite(ELEVENLABS_SPEED) && ELEVENLABS_SPEED >= 0.7 && ELEVENLABS_SPEED <= 1.2) {
      settings.speed = ELEVENLABS_SPEED;
    }
    return {
      payload: text,
      voice: `ElevenLabs.Default.${ELEVENLABS_VOICE_ID}`,
      voice_settings: settings,
    };
  }
  // English: whichever voice in the chain this account accepts (warmest first).
  return enVoiceBody(text, currentEnVoice());
}

async function promptAndWait(cid: string, text: string) {
  return voiceCmd(cid, "gather", text, "en", {
    type: "dtmf",
    minimum_digits: 1,
    maximum_digits: 1,
    timeout_millis: 8000,
  });
}

// NOTE: `lang` is intentionally required — omitting it silently sent Spanish text to the English
// voice (the original bilingual-prompt bug). Callers must pass the language of the text.
// How many speak commands we queued and have not yet seen `call.speak.ended` for.
const speakSegments = new Map<string, number>();
async function speakOnly(cid: string, text: string, lang: string) {
  speakSegments.set(cid, (speakSegments.get(cid) || 0) + 1);
  const ok = await voiceCmd(cid, "speak", text, lang);
  if (!ok) {
    // Never leave the counter stuck if Telnyx rejected the command — otherwise the call
    // would wait forever for an event that will not arrive.
    const left = Math.max(0, (speakSegments.get(cid) || 1) - 1);
    if (left === 0) speakSegments.delete(cid); else speakSegments.set(cid, left);
  }
  return ok;
}

// Optional stop/queue control for one speak (Telnyx SpeakRequest.stop):
// "current" stops the audio playing now, "all" also clears the rest of the queue.
async function speakWithQueueControl(cid: string, text: string, lang: string, stop: "current" | "all") {
  return voiceCmd(cid, "speak", text, lang, { stop });
}

// ── Natural pacing (owner report 2026-10-29: "the English voice is way too fast") ──────────
// Root cause: the segments of one prompt were ISSUED back to back with nothing but an HTTP
// round-trip between them, so ElevenLabs "Rachel" read "Thanks for calling ReceptionAI! You've
// reached a live demo ... press 1 ... press 2 ... So, how can I help you today?" as one rushed
// breath with no beat between the ideas. Telnyx neural voices take plain text (no SSML for
// them), so the only honest pause lever is REAL SILENCE between queued speaks: hold the next
// `speak` for a moment and the caller hears a human beat. (This block was English-only at first;
// Spanish was still issued in one breath. Since 2026-10-29 both languages are paced.)
// Bounded on purpose: nothing is ever added AFTER the last utterance, so the DTMF gather still
// arms the instant the audio ends (#34/#35 single-gather rule intact).
// 2026-10-29 (second owner report — "still very fast and not friendly"): 220 ms was not enough
// once the voice itself was slowed, so English now gets 320 ms between ideas and one longer beat
// (OPTION_PAUSE) before the option list. Spanish was 0 until 2026-10-29 — see below.
// Spanish now gets the same treatment as English (2026-10-29). 300 ms — not the English 320 —
// because Spanish is spoken faster per syllable and a Spanish speaker's natural inter-sentence
// beat is slightly shorter; the point is that the caller hears a beat at all instead of one
// 40-word breath. The longer beat before an option list is OPTION_PAUSE, shared by both languages.
// Nothing is ever added AFTER the last utterance (the single gather is armed by the last
// `call.speak.ended`), so keypresses are still never dropped.
const TTS_PACING: Record<"en" | "es", number> = { en: 320, es: 300 };
// A prompt is a list of things to say, in order. `{ pauseMs }` is a silent beat with no audio —
// the only honest way to get one, since a neural voice reads a comma as a breath, not a pause.
type SpokenLine = string | { pauseMs: number };
// A real gap between two queued speaks, per language (en 320 ms, es 300 ms).
async function paceGap(lang: string) {
  const ms = TTS_PACING[lang === "es" ? "es" : "en"];
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}
// Split ONE payload at sentence boundaries so a two-sentence line gets its own beat. Only splits
// where a sentence ends and the next one starts with a capital (so "$99 a month" and
// "receptionai.store" are never cut). Spanish text is always returned as a single segment.
function splitForPacing(text: string, lang: string): string[] {
  if (!text) return [];
  // Spanish used to be returned whole, so a two-sentence Spanish line was one utterance. It now
  // splits like English, but a Spanish sentence can also START with ¿ or ¡ (and its capitals are
  // accented), so those count as a boundary too. "$99.50" / "receptionai.store" / "9:00 a. m."
  // never split: a boundary needs a space AND a following capital or opening mark.
  const parts = (lang === "es"
    ? text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"'])/)
    : text.split(/(?<=[.!?])\s+(?=[A-Z"'])/)
  ).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}
// Speak several short lines as separate utterances. This is how this pipeline gets natural
// pauses: Telnyx drives its neural voices with plain text (`payload_type: "text"`, SSML is not
// supported for them), so one long comma-spliced sentence ("press 1 to ..., press 2 to ...")
// comes out as a single flat breath. Separate speaks queue in order and each one gets its own
// sentence-final intonation — the same mechanism the owner ear-confirmed in #26 — and the gap
// above gives each idea room to land instead of running them together.
async function speakLines(cid: string, lines: SpokenLine[], lang: string) {
  let spoken = 0;
  for (const raw of lines) {
    if (!raw) continue;
    if (typeof raw === "object") { await new Promise((r) => setTimeout(r, raw.pauseMs)); continue; }
    for (const line of splitForPacing(raw, lang)) {
      if (!line) continue;
      if (spoken > 0) await paceGap(lang);
      await speakOnly(cid, line, lang);
      spoken++;
    }
  }
}
// One payload, paced internally (sentence-ending beats) — used for single-line prompts that
// carry more than one idea, e.g. the demo silence nudge.
async function speakPaced(cid: string, text: string, lang: string) {
  return speakLines(cid, [text], lang);
}
// The Spanish menu opener. The FIRST segment is issued on its own with stop:"all" so the English
// prompt still queued behind the language question is dropped when the caller pressed 2 early —
// exactly what the English demo opener does for the Spanish leg — then one real beat, then every
// option as its own utterance. Nothing is issued after the last one, so the single DTMF gather
// still arms the instant the audio ends.
async function speakSpanishGreeting(cid: string, lines: SpokenLine[]) {
  const [first, ...rest] = lines;
  if (typeof first === "string" && first) {
    await speakWithQueueControl(cid, first, "es", "all");
    await paceGap("es");
  } else if (first) {
    await speakLines(cid, [first], "es");
  }
  if (rest.length) await speakLines(cid, rest, "es");
}

// ── Telnyx outbound dial ──────────────────────────────────────────────────
async function dialOutbound(toNumber: string, fromNumber: string, webhookUrl: string): Promise<string | null> {
  if (!TELNYX_CONNECTION_ID) {
    console.error("TELNYX_CONNECTION_ID not set — cannot dial outbound");
    return null;
  }
  const res = await fetch(`${TELNYX}/calls`, {
    method: "POST", headers: th(),
    body: JSON.stringify({
      connection_id: TELNYX_CONNECTION_ID,
      to: toNumber,
      from: fromNumber,
      webhook_url: webhookUrl,
    }),
  });
  const d = await res.json() as any;
  if (d.errors) { console.error("dialOutbound ERR:", JSON.stringify(d.errors).slice(0, 200)); return null; }
  return d.data?.call_control_id || null;
}

// ── Telnyx number lookup ──────────────────────────────────────────────────
async function lookupNumber(phoneNumber: string) {
  const res = await fetch(`${TELNYX}/phone_numbers/${phoneNumber}`, { headers: th() });
  const d = await res.json() as any;
  return d.data || null;
}

// ── Appointment lookup by phone ────────────────────────────────────────────
async function lookupAppointmentsByPhone(phoneNumber: string, orgId: string): Promise<any[]> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return [];
  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT a.id, a.title, a.start_time, a.status, a.service_type,
             c.first_name, c.last_name, c.phone
      FROM appointments a
      JOIN contacts c ON c.id = a.contact_id
      WHERE c.phone = ${phoneNumber}
        AND a.organization_id = ${orgId}
        AND a.status IN ('confirmed', 'scheduled')
        AND a.start_time >= NOW()
      ORDER BY a.start_time ASC
      LIMIT 5
    `;
    return rows;
  } catch (err) {
    console.error("[DB] appointment lookup failed:", String(err).slice(0, 100));
    return [];
  }
}

// ── Reschedule appointment in DB ──────────────────────────────────────────
async function rescheduleAppointment(apptId: string, newDate: string, newTime: string): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return false;
  try {
    const sql = neon(dbUrl);
    const newStart = `${newDate}T${newTime}:00`;
    const duration = await sql`SELECT EXTRACT(EPOCH FROM (end_time - start_time))/60 as mins FROM appointments WHERE id = ${apptId}`;
    const mins = Number(duration[0]?.mins || 60);
    const endDate = new Date(new Date(newStart).getTime() + mins * 60000);
    const endTime = endDate.toISOString().split("T")[1].substring(0, 5);
    const newEnd = `${newDate}T${endTime}:00`;
    await sql`UPDATE appointments SET start_time = ${newStart}::timestamp, end_time = ${newEnd}::timestamp, status = 'rescheduled', updated_at = NOW() WHERE id = ${apptId}`;
    syncAppointmentToGoogle(apptId).catch(() => {});
    console.log(`[DB] Rescheduled appointment ${apptId.slice(0, 8)} to ${newDate} ${newTime}`);
    return true;
  } catch (err) {
    console.error("[DB] reschedule failed:", String(err).slice(0, 100));
    return false;
  }
}

// ── Waitlist helpers ────────────────────────────────────────────────────────
async function addToWaitlist(phone: string, orgId: string, date: string, name: string): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return false;
  try {
    const sql = neon(dbUrl);
    // Insert or update contact with waitlist tag
    const existing = await sql`SELECT id FROM contacts WHERE phone = ${phone} AND organization_id = ${orgId} LIMIT 1`;
    if (existing[0]) {
      await sql`UPDATE contacts SET tags = COALESCE(tags, '[]'::jsonb) || '["waitlist"]'::jsonb, metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('waitlist_date', ${date}, 'waitlist_name', ${name}), updated_at = NOW() WHERE id = ${existing[0].id}`;
    } else {
      await sql`INSERT INTO contacts (id, organization_id, phone, first_name, tags, metadata) VALUES (gen_random_uuid(), ${orgId}, ${phone}, ${name}, '["waitlist"]'::jsonb, jsonb_build_object('waitlist_date', ${date}, 'waitlist_name', ${name}))`;
    }
    return true;
  } catch (err) {
    console.error("[DB] waitlist add failed:", String(err).slice(0, 100));
    return false;
  }
}

async function notifyFirstWaitlistEntry(orgId: string, date: string, fromNumber: string): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return false;
  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT id, phone, first_name, metadata->>'waitlist_date' as wdate
      FROM contacts
      WHERE organization_id = ${orgId}
        AND tags ? 'waitlist'
        AND metadata->>'waitlist_date' = ${date}
      ORDER BY created_at ASC LIMIT 1
    `;
    if (!rows[0]) return false;
    const entry = rows[0];
    await sendSms(fromNumber, entry.phone,
      `A slot just opened on ${date}! Reply YES to claim it, or visit receptionai.store to book.`);
    await sql`UPDATE contacts SET tags = tags - 'waitlist', updated_at = NOW() WHERE id = ${entry.id}`;
    console.log(`[Waitlist] Notified ${entry.phone} about slot on ${date}`);
    return true;
  } catch (err) {
    console.error("[DB] waitlist notify failed:", String(err).slice(0, 100));
    return false;
  }
}

// ── Conversation lifecycle: create at ANSWER, not at hangup ──────────────────
// The conversation row used to be INSERTed at hangup only. A voicemail recording arrives
// MID-call, so there was no parent row yet: the recordings INSERT violated its
// conversation_id FK, the error was swallowed, and the audio was lost while the owner still
// got the alert SMS (dashboard honestly said "Not available"). Now the row exists from the
// moment the call is answered (status 'active'), mid-call writes can reference it, and the
// hangup path UPDATEs the same row instead of inserting a second one (one call = one row).
// Demo line (727) 966-7556 is public and must never create rows: orgId is null there, so this
// returns immediately and the demo path is untouched.
async function ensureCallConversation(cs: CallState): Promise<void> {
  if (cs.conversationId) return;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !cs.orgId) return;
  try {
    const sql = neon(dbUrl);
    // Resolve the dialed line so per-line analytics work (best effort — never blocks the row)
    let phoneNumberId: string | null = null;
    try {
      const pnRows = await sql`
        SELECT id FROM phone_numbers
        WHERE phone_number = ${cs.toNumber}
          AND is_active = true
        LIMIT 1
      `;
      phoneNumberId = (pnRows[0]?.id as string) || null;
    } catch (err) {
      console.warn("[DB] phone number lookup failed (analytics only):", String(err).slice(0, 100));
    }
    const conversationId = crypto.randomUUID();
    await sql`
      INSERT INTO conversations
        (id, organization_id, contact_id, phone_number_id, type, status, direction,
         twilio_call_sid, started_at)
      VALUES
        (${conversationId}, ${cs.orgId}, ${cs.callerContactId || null}, ${phoneNumberId},
         'call', 'active'::conversation_status, 'inbound', ${cs.callControlId || null},
         ${cs.startTime.toISOString()})
    `;
    cs.conversationId = conversationId;
    console.log(`[DB] Conversation created at answer: ${conversationId.slice(0, 8)} (${cs.callerNumber})`);
  } catch (err) {
    // Never fatal: the hangup path falls back to its own INSERT so the call is still recorded.
    console.error("[DB] create conversation at answer failed:", String(err).slice(0, 140));
  }
}
// ── Recording playback links ────────────────────────────────────────────────
// An <audio> element cannot send an Authorization header, so the dashboard plays a recording
// through a link that carries its own short-lived signature: HMAC-SHA256 over id+expiry keyed
// with JWT_SECRET. A link is only ever minted for rows in the caller's own org, so it cannot
// be replayed against someone else's recording.
const RECORDING_LINK_TTL_SECONDS = 6 * 60 * 60;
function recordingAudioPath(recordingId: string): string {
  const exp = Math.floor(Date.now() / 1000) + RECORDING_LINK_TTL_SECONDS;
  const sig = createHmac("sha256", process.env.JWT_SECRET || "")
    .update(`${recordingId}.${exp}`)
    .digest("hex");
  return `/api/recordings/audio?id=${encodeURIComponent(recordingId)}&exp=${exp}&sig=${sig}`;
}
function verifyRecordingAudioSig(recordingId: string, exp: number, sig: string): boolean {
  const expected = createHmac("sha256", process.env.JWT_SECRET || "")
    .update(`${recordingId}.${exp}`)
    .digest("hex");
  const a = Buffer.from(sig, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  return a.length === b.length && timingSafeEqual(a, b);
}
// ── Voicemail helpers ────────────────────────────────────────────────────────
async function startVoicemailRecording(cid: string, lang: string): Promise<void> {
  const es = lang === "es";
  // Use Telnyx record_start for real audio recording
  await speakOnly(cid, es
    ? "Por favor deje su mensaje después del tono."
    : "Go ahead and leave your message after the tone, and I'll pass it along to the team.", lang);
  setTimeout(() => {
    cmd(cid, "record_start", {
      format: "mp3",
      channels: "single",
      timeout_secs: 60,
      play_beep: true,
    });
  }, 800);
}

function stopVoicemailRecording(cid: string): void {
  cmd(cid, "record_stop", {}).catch(() => {});
}

/**
 * Persist a voicemail recording against the conversation created at answer.
 * Returns true only when a row was actually written, so the caller can tell whether the owner
 * alert may point at audio that exists.
 *
 * What is stored, honestly:
 *  - twilio_recording_sid: the Telnyx recording id — the DURABLE handle. Webhook recording
 *    URLs expire; /api/recordings/audio exchanges this id for a fresh URL on every play.
 *  - recording_url: the URL Telnyx delivered, kept as a fallback (may expire).
 *  - duration_seconds: only when Telnyx actually reported one, otherwise NULL and the UI says
 *    "Duration not recorded".
 * No transcript is written: transcription is not built, and inventing text would be a lie.
 */
async function saveVoicemailRecording(
  cs: CallState,
  recordingUrl: string,
  durationSeconds: number | null,
  recordingId: string | null
): Promise<boolean> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || !cs.orgId) return false;
    const sql = neon(dbUrl);
    // The row was created at answer — wait for that insert if it is still in flight.
    await cs.convReady?.catch(() => {});
    let conversationId = cs.conversationId || null;
    if (!conversationId) {
      const conv = await sql`
        SELECT id FROM conversations
        WHERE organization_id = ${cs.orgId} AND twilio_call_sid = ${cs.callControlId || null}
        ORDER BY created_at DESC LIMIT 1
      `;
      conversationId = (conv[0]?.id as string) || null;
    }
    if (!conversationId) {
      // Without a parent row the FK rejects the insert — say so instead of losing audio silently.
      console.error(`[Voicemail] no conversation row for ${cs.callerNumber} — recording NOT stored`);
      return false;
    }
    await sql`
      INSERT INTO recordings
        (id, organization_id, conversation_id, recording_url, duration_seconds,
         storage_provider, twilio_recording_sid, created_at)
      VALUES
        (gen_random_uuid(), ${cs.orgId}, ${conversationId}, ${recordingUrl || null},
         ${durationSeconds}, 'telnyx', ${recordingId}, NOW())
    `;
    cs.recordingStored = true;
    console.log(
      `[Voicemail] Stored recording ${recordingId || "(no id)"} on conv ${conversationId.slice(0, 8)} ` +
      `(${durationSeconds === null ? "duration not reported" : durationSeconds + "s"})`
    );
    return true;
  } catch (err) {
    console.error("[Voicemail] save recording failed:", String(err).slice(0, 160));
    return false;
  }
}

async function notifyOwnerOfVoicemail(orgId: string, callerNumber: string, fromNumber: string, lang: string, recordingUrl?: string): Promise<void> {
  const es = lang === "es";
  const ownerPhone = await getOwnerPhone(orgId);
  if (ownerPhone && fromNumber) {
    const msg = es
      ? `📞 Nuevo mensaje de voz de ${callerNumber}. Escúchelo en su panel: receptionai.store/dashboard/recordings`
      : `📞 New voicemail from ${callerNumber}. Listen on your dashboard: receptionai.store/dashboard/recordings`;
    await sendSms(fromNumber, ownerPhone, msg);
  }
  // Also send email with recording link
  await sendEmailNotification(orgId,
    es ? `📞 Nuevo mensaje de voz de ${callerNumber}` : `📞 New voicemail from ${callerNumber}`,
    es
      ? `Tiene un nuevo mensaje de voz de ${callerNumber}.\n\nEscúchelo aquí: receptionai.store/dashboard/recordings`
      : `You have a new voicemail from ${callerNumber}.\n\nListen here: receptionai.store/dashboard/recordings`);
}

// ── After-hours check ──────────────────────────────────────────────────────
async function isBusinessClosed(orgId: string): Promise<{ closed: boolean }> {
  if (!orgId) return { closed: false };
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return { closed: false };
    const sql = neon(dbUrl);
    const now = new Date();
    const dayOfWeek = String(now.getDay());
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const rows = await sql`
      SELECT is_closed, open_time, close_time FROM business_hours
      WHERE organization_id = ${orgId} AND day_of_week = ${dayOfWeek} LIMIT 1
    `;
    if (!rows[0] || rows[0].is_closed) return { closed: true };
    const { open_time, close_time } = rows[0];
    if (!open_time || !close_time) return { closed: false };
    if (timeStr < open_time || timeStr >= close_time) return { closed: true };
    return { closed: false };
  } catch { return { closed: false }; }
}

// ── AI call transcript generator ─────────────────────────────────────────────
async function generateCallTranscript(cs: CallState): Promise<string> {
  const lang = cs.language || "en";
  const dtmfStr = cs.dtmfHistory.length > 0 ? cs.dtmfHistory.join(",") : "none";
  const duration = Math.round((Date.now() - cs.startTime.getTime()) / 1000);
  const name = cs.callerFirstName || cs.callerNumber || "Unknown";
  const prompt = lang === "es"
    ? `Resume esta llamada en UNA frase breve: Llamada de ${name}, presiono ${dtmfStr}, duro ${duration}s.`
    : `Summarize this call in ONE brief sentence: Call from ${name}, pressed ${dtmfStr}, lasted ${duration}s.`;

  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) return "";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 80, temperature: 0.5 },
        }) },
    );
    const data = await res.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  } catch { return ""; }
}

// ── Send email notification ─────────────────────────────────────────────────
async function sendEmailNotification(orgId: string, subject: string, body: string): Promise<void> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return;
    const sql = neon(dbUrl);
    const rows = await sql`SELECT email FROM organizations WHERE id = ${orgId} LIMIT 1`;
    const orgEmail = rows[0]?.email as string | undefined;
    if (!orgEmail) return;

    const { sendEmail } = await import("../lib/email");
    await sendEmail(orgEmail, subject, body);
    console.log(`[Email] Sent to ${orgEmail}: "${subject.slice(0, 50)}"`);
  } catch (err) {
    console.error("[Email] send failed:", String(err).slice(0, 100));
  }
}

// ── Call state tracking ──────────────────────────────────────────────────
interface CallState {
  callerNumber: string;
  toNumber: string;
  dtmfHistory: string[];
  startTime: Date;
  orgId: string | null;
  orgName: string | null;
  callerFirstName?: string;
  callerContactId?: string;
  appointmentIntent: boolean;
  appointmentBooked: boolean;
  language: 'en' | 'es';
  phase: 'language' | 'menu' | 'reschedule_lookup' | 'reschedule_confirm' | 'reschedule_date' | 'reschedule_time' | 'reschedule_final' | 'survey' | 'waitlist' | 'booking_slots';
  answered: boolean;
  callbackSent: boolean;
  rescheduleApptId?: string;
  rescheduleOldDate?: string;
  rescheduleOldTime?: string;
  rescheduleService?: string;
  rescheduleNewDate?: string;
  rescheduleNewTime?: string;
  surveySent: boolean;
  gatherTimeouts: number;
  transferred: boolean;
  transferring: boolean;
  requestedCallback: boolean;
  voicemail: boolean;
  callControlId: string;
  // ── Persistence (create-at-answer, 2026-10-29) ────────────────────────────
  // The conversations row is created when the call is ANSWERED, not at hangup, so anything
  // that happens mid-call — above all a voicemail recording — has a real parent row to point
  // at. convReady is that insert while it is still in flight; every dependent write awaits it.
  conversationId?: string | null;
  convReady?: Promise<void>;
  voicemailAlerted?: boolean;   // owner already got the voicemail SMS (never text twice)
  recordingStored?: boolean;    // a recordings row was actually written for this call
  bookingSlots?: { date: string; time: string; endTime: string }[];
  demoTurns?: number;     // demo line: how many answers the caller has heard
  demoNudged?: boolean;   // demo line: the single "take your time" nudge has played
}
const calls = new Map<string, CallState>(); // cid → CallState

// ── Idempotency guards (demo-line regression, owner report 2026-10-28) ──────
// Telnyx fires `call.speak.ended` once PER speak command. A multi-segment prompt therefore
// armed one DTMF gather per segment (the bilingual greeting armed two at once) and a
// multi-segment goodbye started the hangup timer from the first segment. A single press could
// also be delivered more than once, which replayed the whole response — the "it repeats the
// options after you press" the owner heard. All three are debounced/deduped here.
const gatherArmTimers = new Map<string, ReturnType<typeof setTimeout>>();
const hangupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastDtmf = new Map<string, { digit: string; ts: number }>();
const gatherActive = new Set<string>();
function armGather(cid: string, opts: any, delayMs = 200): void {
  // One listener at a time: a prompt made of several utterances must not stack up
  // duplicate gathers (each active gather can deliver the same keypress again, which is
  // what made the demo replay a response).
  if (gatherActive.has(cid)) return;
  gatherActive.add(cid);
  const prev = gatherArmTimers.get(cid);
  if (prev) clearTimeout(prev);
  gatherArmTimers.set(cid, setTimeout(() => {
    gatherArmTimers.delete(cid);
    cmd(cid, "gather", opts).catch(() => {});
  }, delayMs));
}
// Called once the last queued utterance has finished playing.
function finishSpeaking(cid: string): void {
  if (pendingHangups.has(cid) || hangupTimers.has(cid)) {
    pendingHangups.delete(cid);
    armHangup(cid, 1200);
  } else {
    armGather(cid, {
      type: "dtmf",
      minimum_digits: 1,
      maximum_digits: 1,
      timeout_millis: 8000,
    });
  }
}
function armHangup(cid: string, delayMs = 1500): void {
  const prev = hangupTimers.get(cid);
  if (prev) clearTimeout(prev);
  hangupTimers.set(cid, setTimeout(() => {
    hangupTimers.delete(cid);
    cmd(cid, "hangup").catch(() => {});
  }, delayMs));
}
const pendingHangups = new Set<string>();
const pendingCallbacks = new Map<string, { orgName: string; language: string; callerNumber: string; businessNumber: string }>(); // outbound cid → callback info
const callbackStates = new Map<string, { orgName: string; language: string; callerNumber: string; businessNumber: string; answered: boolean }>(); // outbound cid → active callback state
const transferStates = new Map<string, { inboundCid: string; ownerPhone: string; callerNumber: string; businessNumber: string; language: string; answered: boolean }>(); // outbound owner-leg cid → transfer info

// ── Reschedule flow handler ────────────────────────────────────────────────
async function handleReschedulePhase(cid: string, digit: string, cs: CallState): Promise<void> {
  const lang = cs.language || "en";
  const es = lang === "es";

  switch (cs.phase) {
    case "reschedule_lookup": {
      // digits are phone number; look up appointments
      const phone = cs.dtmfHistory.slice(-11).join("");
      if (!cs.orgId) {
        cs.phase = "menu";
        // Never answer a Spanish caller in English (belt and braces: digit 4 on the demo line is
        // now answered before it ever gets here).
        if (es) {
          await speakLines(cid, DEMO_ES.reschedule, "es");
        } else {
          await speakOnly(cid, "I can't look up appointments in demo mode. " + buildShortPrompt("en"), "en");
        }
        return;
      }
      if (phone.length < 10) {
        await speakOnly(cid, es
          ? "Necesito al menos 10 dígitos. Intente de nuevo."
          : "I need at least 10 digits. Please try again.", lang);
        return;
      }
      const apts = await lookupAppointmentsByPhone(phone, cs.orgId);
      if (apts.length === 0) {
        cs.phase = "menu";
        await speakOnly(cid, es
          ? "No encontré citas próximas con ese número. Volviendo al menú principal. " + buildShortPrompt("es")
          : "I couldn't find upcoming appointments for that number. Returning to the main menu. " + buildShortPrompt("en"), lang);
        return;
      }
      const a = apts[0];
      const dt = new Date(a.start_time);
      cs.rescheduleApptId = a.id;
      cs.rescheduleOldDate = dt.toISOString().split("T")[0];
      cs.rescheduleOldTime = dt.toISOString().split("T")[1].substring(0, 5);
      cs.rescheduleService = a.title || a.service_type || "your appointment";
      cs.phase = "reschedule_confirm";
      await speakOnly(cid, es
        ? `Encontré su cita: ${cs.rescheduleService} el ${cs.rescheduleOldDate} a las ${cs.rescheduleOldTime}. Presione 1 para confirmar que desea reprogramar, o 2 para cancelar.`
        : `I found your appointment: ${cs.rescheduleService} on ${cs.rescheduleOldDate} at ${cs.rescheduleOldTime}. Press 1 to confirm you want to reschedule, or 2 to cancel.`, lang);
      return;
    }

    case "reschedule_confirm": {
      if (digit === "1") {
        cs.phase = "reschedule_date";
        await speakOnly(cid, es
          ? "¿Qué fecha funciona mejor? Ingrese mes y día como 4 dígitos. Por ejemplo, 0725 para 25 de julio."
          : "What date works better? Enter month and day as 4 digits. For example, 0725 for July 25th.", lang);
        setTimeout(() => cmd(cid, "gather", { type: "dtmf", minimum_digits: 4, maximum_digits: 4, timeout_millis: 8000 }), 300);
      } else {
        cs.phase = "menu";
        await speakOnly(cid, es
          ? "De acuerdo, no reprogramaré su cita. " + buildShortPrompt("es")
          : "Okay, I won't reschedule your appointment. " + buildShortPrompt("en"), lang);
      }
      return;
    }

    case "reschedule_date": {
      // DTMF date MMDD (4 digits)
      const dateDigits = cs.dtmfHistory.slice(-4).join("");
      const month = parseInt(dateDigits.substring(0, 2));
      const day = parseInt(dateDigits.substring(2, 4));
      const year = new Date().getFullYear();
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        await speakOnly(cid, es
          ? "Fecha inválida. Ingrese mes y día como 4 dígitos, como 0725 para 25 de julio."
          : "Invalid date. Enter month and day as 4 digits, like 0725 for July 25th.", lang);
        return;
      }
      cs.rescheduleNewDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cs.phase = "reschedule_time";
      await speakOnly(cid, es
        ? `Entendido, ${cs.rescheduleNewDate}. ¿A qué hora? Ingrese 4 dígitos, como 0930 para las 9:30 AM.`
        : `Got it, ${cs.rescheduleNewDate}. What time? Enter 4 digits, like 0930 for 9:30 AM.`, lang);
      setTimeout(() => cmd(cid, "gather", { type: "dtmf", minimum_digits: 4, maximum_digits: 4, timeout_millis: 8000 }), 300);
      return;
    }

    case "reschedule_time": {
      const timeDigits = cs.dtmfHistory.slice(-4).join("");
      const hour = parseInt(timeDigits.substring(0, 2));
      const min = parseInt(timeDigits.substring(2, 4));
      if (hour < 0 || hour > 23 || min < 0 || min > 59) {
        await speakOnly(cid, es
          ? "Hora inválida. Ingrese 4 dígitos como 0930 para 9:30 AM."
          : "Invalid time. Enter 4 digits like 0930 for 9:30 AM.", lang);
        return;
      }
      cs.rescheduleNewTime = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      cs.phase = "reschedule_final";
      await speakOnly(cid, es
        ? `Tengo su cita reprogramada para ${cs.rescheduleNewDate} a las ${cs.rescheduleNewTime}. Presione 1 para confirmar, o 2 para cancelar.`
        : `I have you rescheduled to ${cs.rescheduleNewDate} at ${cs.rescheduleNewTime}. Press 1 to confirm, or 2 to cancel.`, lang);
      return;
    }

    case "reschedule_final": {
      if (digit === "1" && cs.rescheduleApptId && cs.rescheduleNewDate && cs.rescheduleNewTime) {
        await rescheduleAppointment(cs.rescheduleApptId, cs.rescheduleNewDate, cs.rescheduleNewTime);
        cs.appointmentBooked = true;
        // Notify waitlist for the OLD date (now freed)
        if (cs.rescheduleOldDate && cs.toNumber) {
          notifyFirstWaitlistEntry(cs.orgId!, cs.rescheduleOldDate, cs.toNumber);
        }
        // Send SMS confirmation
        if (cs.callerNumber && cs.toNumber) {
          await sendSms(cs.toNumber, cs.callerNumber, es
            ? `Su cita ha sido reprogramada para ${cs.rescheduleNewDate} a las ${cs.rescheduleNewTime}. ¡Gracias!`
            : `Your appointment has been rescheduled to ${cs.rescheduleNewDate} at ${cs.rescheduleNewTime}. Thank you!`);
        }
        // Start survey
        cs.phase = "survey";
        await speakOnly(cid, es
          ? "Cita reprogramada exitosamente. Recibirá un SMS de confirmación. Antes de irse — ¿cómo calificaría su experiencia? Presione del 1 al 5, siendo 5 excelente."
          : "Appointment rescheduled successfully. You'll receive an SMS confirmation. Before you go — how would you rate your experience? Press 1 to 5, 5 being best.", lang);
      } else {
        cs.phase = "menu";
        await speakOnly(cid, es
          ? "No reprogramamos su cita. " + buildShortPrompt("es")
          : "We won't reschedule. " + buildShortPrompt("en"), lang);
      }
      return;
    }

    case "survey": {
      const rating = parseInt(digit);
      if (cs.surveySent) return;
      cs.surveySent = true;
      if (rating >= 1 && rating <= 5) {
        // Store the rating on this caller's most recent conversation. The row for the call in
        // progress does not exist yet (it is INSERTed at hangup), so target the previous
        // conversation for THIS contact rather than the organization's latest one.
        if (cs.orgId) {
          try {
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl) {
              const sql = neon(dbUrl);
              let contactId: string | null = cs.callerContactId || null;
              if (!contactId) {
                const cRows = await sql`
                  SELECT id FROM contacts
                  WHERE phone = ${cs.callerNumber}
                    AND organization_id = ${cs.orgId}
                  ORDER BY created_at DESC
                  LIMIT 1
                `;
                contactId = (cRows[0]?.id as string) || null;
              }
              if (contactId) {
                // Postgres rejects ORDER BY/LIMIT on UPDATE — scope the subquery instead.
                const rated = await sql`
                  UPDATE conversations
                  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('rating', ${rating}::int),
                      updated_at = NOW()
                  WHERE id = (
                    SELECT id FROM conversations
                    WHERE organization_id = ${cs.orgId}
                      AND contact_id = ${contactId}
                    ORDER BY created_at DESC
                    LIMIT 1
                  )
                  RETURNING id
                `;
                if (!rated[0]) console.log("[Survey] No earlier conversation for this caller — rating not stored");
              } else {
                console.log("[Survey] Caller has no contact record yet — rating not stored");
              }
            }
          } catch (err) {
            console.warn("[Survey] storing rating failed:", String(err).slice(0, 120));
          }
        }
        if (rating <= 2 && cs.orgId) {
          // Notify owner for poor ratings
          const ownerPhone = await getOwnerPhone(cs.orgId);
          if (ownerPhone && cs.toNumber) {
            await sendSms(cs.toNumber, ownerPhone,
              `⚠️ Low rating (${rating}/5) from call with ${cs.callerFirstName || cs.callerNumber}. Please follow up.`);
          }
        }
      }
      cs.phase = "menu";
      await speakOnly(cid, rating <= 2 ? (es
        ? "Lamento escuchar eso. Alguien lo contactará pronto. Gracias por llamar. ¡Adiós!"
        : "Sorry to hear that. Someone will reach out. Thanks for calling. Goodbye!") : (es
        ? "¡Gracias por su valoración! Que tenga un excelente día. ¡Adiós!"
        : "Thanks for your feedback! Have a great day. Goodbye!"), lang);
      pendingHangups.add(cid);
      // Fallback: force hangup after 4s if speak.ended doesn't trigger
      setTimeout(() => cmd(cid, "hangup"), 4000);
      return;
    }

    case "waitlist": {
      // Use today's date as default
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      if (digit === "1") {
        const name = cs.callerFirstName || "Caller";
        if (cs.orgId && cs.callerNumber) {
          await addToWaitlist(cs.callerNumber, cs.orgId, date, name);
        }
        cs.phase = "menu";
        await speakOnly(cid, es
          ? "Está en la lista de espera. Le enviaremos un mensaje si se abre un espacio. Gracias."
          : "You're on the waitlist. We'll text you if a slot opens. Thank you.", lang);
      } else if (digit === "2") {
        cs.phase = "menu";
        await speakOnly(cid, es
          ? "Entendido. " + buildShortPrompt("es")
          : "Understood. " + buildShortPrompt("en"), lang);
      } else {
        await speakOnly(cid, es
          ? "Disculpe, no entendí. ¿Presione 1 para unirse a la lista de espera, o 2 para intentar otro día?"
          : "Sorry, I didn't catch that. Press 1 to join the waitlist, or 2 to try another day.", lang);
      }
      return;
    }
  }
}



// ── Voice booking helpers ────────────────────────────────────────────────
// Shared timezone + slot-generation + booking logic. Reuses the exact
// business-hours / holiday / buffer rules from the public web widget
// (/api/booking/slots) rather than duplicating them.

// IANA offset (ms) of `tz` at instant `date` as (local − utc).
function getTimezoneOffsetMs(date: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || "0", 10);
    let h = get("hour");
    if (h === 24) h = 0;
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
    return asUtc - date.getTime();
  } catch { return 0; }
}

// Convert an org-local wall-clock "YYYY-MM-DD" + "HH:MM" to a tz-aware UTC Date.
function zonedToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  const off1 = getTimezoneOffsetMs(naive, tz);
  let utc = new Date(naive.getTime() - off1);
  const off2 = getTimezoneOffsetMs(utc, tz);
  if (off2 !== off1) utc = new Date(naive.getTime() - off2);
  return utc;
}

async function getOrgTimezone(orgId: string): Promise<string> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return "America/Chicago";
  try {
    const sql = neon(dbUrl);
    const rows = await sql`SELECT timezone FROM organizations WHERE id = ${orgId} LIMIT 1`;
    return (rows[0]?.timezone as string) || "America/Chicago";
  } catch { return "America/Chicago"; }
}

// Generate available slots for one org-local date (same rules as /api/booking/slots).
async function getSlotsForDate(
  orgId: string, date: string, duration = 60, tz?: string,
): Promise<{ date: string; slots: any[]; closed: boolean; holiday?: boolean }> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { date, slots: [], closed: true };
  const sql = neon(dbUrl);
  const tzName = tz || (await getOrgTimezone(orgId));

  const [y, m, d] = date.split("-").map(Number);
  const dow = String(new Date(Date.UTC(y, m - 1, d)).getUTCDay());

  const hoursRows = await sql`
    SELECT day_of_week, is_closed, open_time, close_time
    FROM business_hours WHERE organization_id = ${orgId} AND day_of_week = ${dow}
    LIMIT 1
  `;
  const bh = hoursRows[0];
  if (!bh || bh.is_closed || !bh.open_time || !bh.close_time) {
    return { date, slots: [], closed: true };
  }

  const holiday = await sql`
    SELECT is_closed, open_time, close_time FROM holiday_overrides
    WHERE organization_id = ${orgId} AND date = ${date}::date LIMIT 1
  `;
  if (holiday[0]?.is_closed) {
    return { date, slots: [], closed: true, holiday: true };
  }
  const openT = holiday[0]?.open_time || bh.open_time;
  const closeT = holiday[0]?.close_time || bh.close_time;

  const dayStart = zonedToUtc(date, "00:00", tzName);
  const nd = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDate = `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, "0")}-${String(nd.getUTCDate()).padStart(2, "0")}`;
  const nextDayStart = zonedToUtc(nextDate, "00:00", tzName);

  const booked = await sql`
    SELECT start_time, end_time FROM appointments
    WHERE organization_id = ${orgId}
      AND status IN ('confirmed', 'scheduled')
      AND start_time >= ${dayStart.toISOString()}
      AND start_time < ${nextDayStart.toISOString()}
  `;

  const slots: any[] = [];
  const [oh, om] = openT.split(":").map(Number);
  const [ch, cm] = closeT.split(":").map(Number);
  let cur = oh * 60 + om;
  const endM = ch * 60 + cm;
  const buf = 15;

  while (cur + duration <= endM) {
    const st = `${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`;
    const et = `${String(Math.floor((cur + duration) / 60)).padStart(2, "0")}:${String((cur + duration) % 60).padStart(2, "0")}`;
    const slotStart = zonedToUtc(date, st, tzName);
    const slotEnd = zonedToUtc(date, et, tzName);

    const conflict = booked.some((b: any) => {
      const bs = new Date(new Date(b.start_time).getTime() - buf * 60000);
      const be = new Date(new Date(b.end_time).getTime() + buf * 60000);
      return slotStart < be && slotEnd > bs;
    });

    if (!conflict) slots.push({ date, time: st, endTime: et, available: true });
    cur += 30;
  }

  return { date, slots, closed: false };
}

// Find the next `count` future slots across upcoming days.
async function findNextAvailableSlots(
  orgId: string, tz: string, count = 4, daysAhead = 14, duration = 60,
): Promise<any[]> {
  const result: any[] = [];
  const now = Date.now();
  const today = new Date();
  for (let i = 0; i < daysAhead && result.length < count; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    let daySlots: any[] = [];
    try { daySlots = (await getSlotsForDate(orgId, dateStr, duration, tz)).slots; } catch { daySlots = []; }
    for (const s of daySlots) {
      if (zonedToUtc(s.date, s.time, tz).getTime() <= now) continue;
      result.push(s);
      if (result.length >= count) break;
    }
  }
  return result;
}

// Human-friendly spoken slot ("Tuesday, October 27 at 9:00 AM").
function formatSlotSpeech(slot: { date: string; time: string }, lang: "en" | "es"): string {
  const [y, m, d] = slot.date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const loc = lang === "es" ? "es-ES" : "en-US";
  const weekday = dt.toLocaleDateString(loc, { weekday: "long", timeZone: "UTC" });
  const month = dt.toLocaleDateString(loc, { month: "long", timeZone: "UTC" });
  const day = dt.getUTCDate();
  const [h, min] = slot.time.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h >= 12 ? "PM" : "AM";
  const timeStr = `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
  return lang === "es"
    ? `${weekday} ${day} de ${month} a las ${timeStr}`
    : `${weekday}, ${month} ${day} at ${timeStr}`;
}

// Bilingual reminder message (mirrors src/lib/reminders.ts templates).
function buildReminderMessage(
  p: { customerName: string; service: string; date: string; time: string; orgName: string },
  type: string, lang: "en" | "es",
): string {
  if (type === "24h_before") {
    return lang === "es"
      ? `Hola ${p.customerName}, recordatorio: tiene una cita en ${p.orgName} para ${p.service} mañana (${p.date}) a las ${p.time}.`
      : `Hi ${p.customerName}, reminder: you have an appointment at ${p.orgName} for ${p.service} tomorrow (${p.date}) at ${p.time}.`;
  }
  if (type === "2h_before") {
    return lang === "es"
      ? `Hola ${p.customerName}, su cita en ${p.orgName} para ${p.service} es en 2 horas (${p.time}). ¡Le esperamos!`
      : `Hi ${p.customerName}, your appointment at ${p.orgName} for ${p.service} is in 2 hours (${p.time}). See you soon!`;
  }
  return lang === "es"
    ? `Hola ${p.customerName}, esperamos que su cita de ${p.service} en ${p.orgName} haya sido excelente.`
    : `Hi ${p.customerName}, we hope your ${p.service} appointment at ${p.orgName} went well!`;
}

// Schedule reminder rows for a newly booked appointment (same as calendar/book).
async function scheduleRemindersInline(p: {
  appointmentId: string; organizationId: string; customerName: string; customerPhone: string;
  service: string; date: string; time: string; orgName: string; orgPhone: string; tz: string;
  lang: "en" | "es";
}): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;
  try {
    const sql = neon(dbUrl);
    const apptTime = zonedToUtc(p.date, p.time, p.tz);
    const reminders = [
      { type: "24h_before", at: apptTime.getTime() - 24 * 3600 * 1000 },
      { type: "2h_before", at: apptTime.getTime() - 2 * 3600 * 1000 },
      { type: "follow_up", at: apptTime.getTime() + 1 * 3600 * 1000 },
    ];
    const now = Date.now();
    for (const r of reminders) {
      if (r.at <= now) continue;
      const msg = buildReminderMessage(p, r.type, p.lang);
      await sql`
        INSERT INTO appointment_reminders
          (id, appointment_id, organization_id, reminder_type, scheduled_at, status, channel, recipient_phone, message_body)
        VALUES
          (gen_random_uuid(), ${p.appointmentId}, ${p.organizationId}, ${r.type},
           ${new Date(r.at).toISOString()}, 'pending', 'sms', ${p.customerPhone}, ${msg})
      `;
    }
    const next = await sql`
      SELECT MIN(scheduled_at) as next_at FROM appointment_reminders
      WHERE appointment_id = ${p.appointmentId} AND status = 'pending'
    `;
    if (next[0]?.next_at) {
      await sql`UPDATE appointments SET next_reminder_at = ${next[0].next_at}, updated_at = NOW() WHERE id = ${p.appointmentId}`;
    }
  } catch (err) {
    console.error("[Reminders] schedule failed:", String(err).slice(0, 120));
  }
}

// Shared appointment insert (reused by voice booking; mirrors /api/booking + calendar/book).
async function createVoiceBooking(p: {
  orgId: string; name: string; phone: string; date: string; time: string; endTime: string;
  service: string; tz: string; lang: "en" | "es"; orgName: string; fromNumber: string;
}): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { success: false, error: "DB not configured" };
  try {
    const sql = neon(dbUrl);
    const startUtc = zonedToUtc(p.date, p.time, p.tz);
    const endUtc = zonedToUtc(p.date, p.endTime, p.tz);

    let contactId = "";
    const existing = await sql`SELECT id, first_name FROM contacts WHERE organization_id = ${p.orgId} AND phone = ${p.phone} LIMIT 1`;
    if (existing[0]) {
      contactId = existing[0].id;
      await sql`
        UPDATE contacts SET
          first_name = COALESCE(NULLIF(first_name, ''), ${p.name}),
          preferred_language = ${p.lang},
          updated_at = NOW()
        WHERE id = ${contactId}
      `;
    } else {
      const c = await sql`
        INSERT INTO contacts (id, organization_id, first_name, last_name, phone, preferred_language, created_at, updated_at)
        VALUES (gen_random_uuid(), ${p.orgId}, ${p.name}, '', ${p.phone}, ${p.lang}, NOW(), NOW())
        RETURNING id
      `;
      contactId = c[0]?.id;
    }
    if (!contactId) return { success: false, error: "Contact creation failed" };

    const title = `${p.service} - ${p.name}`;
    const appt = await sql`
      INSERT INTO appointments
        (id, organization_id, contact_id, title, start_time, end_time, timezone, service_type, status, created_at, updated_at)
      VALUES
        (gen_random_uuid(), ${p.orgId}, ${contactId}, ${title},
         ${startUtc.toISOString()}, ${endUtc.toISOString()}, ${p.tz},
         ${p.service}, 'confirmed', NOW(), NOW())
      RETURNING id
    `;
    const apptId = appt[0]?.id;
    if (!apptId) return { success: false, error: "Appointment creation failed" };

    await scheduleRemindersInline({
      appointmentId: apptId, organizationId: p.orgId, customerName: p.name,
      customerPhone: p.phone, service: p.service, date: p.date, time: p.time,
      orgName: p.orgName, orgPhone: p.fromNumber, tz: p.tz, lang: p.lang,
    });

    const confirmation = p.lang === "es"
      ? `Hola ${p.name}, su cita para ${p.service} el ${p.date} a las ${p.time} está confirmada. Le enviaremos un recordatorio antes de su visita. ¿Preguntas? Llame al ${p.fromNumber}.`
      : `Hi ${p.name}, your appointment for ${p.service} on ${p.date} at ${p.time} is confirmed. We'll send a reminder before your visit. Questions? Call ${p.fromNumber}.`;
    if (p.fromNumber && p.phone) await sendSms(p.fromNumber, p.phone, confirmation);

    return { success: true, appointmentId: apptId };
  } catch (err) {
    console.error("[Voice Booking] create failed:", String(err).slice(0, 150));
    return { success: false, error: String(err).slice(0, 100) };
  }
}

// Entry point for digit "1" on a live org: offer slots over DTMF.
async function startVoiceBooking(cid: string, cs: CallState): Promise<void> {
  const lang = cs.language || "en";
  const es = lang === "es";
  if (!cs.orgId) return;
  try {
    const tz = await getOrgTimezone(cs.orgId);
    const slots = await findNextAvailableSlots(cs.orgId, tz, 4, 14, 60);
    if (slots.length === 0) {
      cs.phase = "waitlist";
      await speakOnly(cid, es
        ? "No hay citas disponibles en este momento. ¿Le gustaría unirse a la lista de espera? Le avisaremos cuando se abra un espacio. Presione 1 para sí, 2 para volver al menú."
        : "No appointments available right now. Would you like to join the waitlist? We'll text you when a slot opens. Press 1 for yes, 2 to return to the menu.", lang);
      return;
    }
    cs.bookingSlots = slots;
    cs.phase = "booking_slots";
    let msg = "";
    if (es) {
      msg = "Estos son los próximos horarios disponibles. ";
      slots.forEach((s, i) => { msg += `Opción ${i + 1}: ${formatSlotSpeech(s, "es")}. `; });
      msg += "Presione 1, 2, 3 o 4 para reservar, o 9 para hablar con el equipo.";
    } else {
      msg = "Here are the next available times. ";
      slots.forEach((s, i) => { msg += `Option ${i + 1}: ${formatSlotSpeech(s, "en")}. `; });
      msg += "Press 1, 2, 3, or 4 to book, or 9 to speak with the team.";
    }
    await speakOnly(cid, msg, lang);
  } catch (err) {
    console.error("[Voice Booking] slot fetch failed:", String(err).slice(0, 150));
    cs.phase = "waitlist";
    await speakOnly(cid, es
      ? "No pude consultar la disponibilidad en este momento. ¿Le gustaría unirse a la lista de espera? Presione 1 para sí, 2 para volver al menú."
      : "I couldn't check availability right now. Would you like to join the waitlist? Press 1 for yes, 2 to return to the menu.", lang);
  }
}

// Handle DTMF selections during the booking slot-offer phase.
async function handleBookingPhase(cid: string, digit: string, cs: CallState): Promise<void> {
  const lang = cs.language || "en";
  const es = lang === "es";
  const slots = cs.bookingSlots || [];

  if (digit >= "1" && digit <= "4") {
    const slot = slots[parseInt(digit, 10) - 1];
    if (!slot) {
      await speakOnly(cid, es ? "Opción no válida. " : "Invalid option. ", lang);
      return;
    }
    if (!cs.orgId) return;
    const name = cs.callerFirstName || "Caller";
    const tz = await getOrgTimezone(cs.orgId);
    const result = await createVoiceBooking({
      orgId: cs.orgId, name, phone: cs.callerNumber,
      date: slot.date, time: slot.time, endTime: slot.endTime,
      service: "General Service", tz, lang, orgName: cs.orgName || "our team", fromNumber: cs.toNumber,
    });
    if (result.success) {
      cs.appointmentBooked = true;
      cs.phase = "menu";
      await speakOnly(cid, es
        ? `Su cita quedó reservada para ${formatSlotSpeech(slot, "es")}. Le enviaremos un SMS de confirmación y un recordatorio. ¡Gracias! ¡Adiós!`
        : `Your appointment is booked for ${formatSlotSpeech(slot, "en")}. We'll text you a confirmation and a reminder. Thank you! Goodbye!`, lang);
      pendingHangups.add(cid);
    } else {
      cs.phase = "waitlist";
      await speakOnly(cid, es
        ? "Lo siento, no pudimos completar su reserva. ¿Le gustaría unirse a la lista de espera? Presione 1 para sí, 2 para volver al menú."
        : "Sorry, we couldn't complete your booking. Would you like to join the waitlist? Press 1 for yes, 2 to return to the menu.", lang);
    }
    return;
  }

  if (digit === "9") {
    cs.phase = "menu";
    await transferToOwner(cid, cs);
    return;
  }

  await speakOnly(cid, es
    ? "Disculpe, presione 1, 2, 3 o 4 para reservar, o 9 para hablar con el equipo."
    : "Sorry, press 1, 2, 3, or 4 to book, or 9 to speak with the team.", lang);
}

// ── Missed call auto-callback ─────────────────────────────────────────────
function scheduleCallback(cs: CallState): void {
  if (!cs.toNumber || !cs.callerNumber) return;
  const webhookUrl = `https://${process.env.HOST || "localhost:3000"}/api/telnyx/voice`;
  const lang = cs.language || "en";

  setTimeout(async () => {
    const outboundCid = await dialOutbound(cs.callerNumber, cs.toNumber, webhookUrl);
    if (outboundCid) {
      pendingCallbacks.set(outboundCid, {
        orgName: cs.orgName || "our team",
        language: lang,
        callerNumber: cs.callerNumber,
        businessNumber: cs.toNumber,
      });
      console.log(`[Callback] Scheduled callback to ${cs.callerNumber} (cid: ${outboundCid.slice(-8)})`);
    }
  }, 2 * 60 * 1000); // 2 minutes
}

// ── Real "talk to the owner" transfer ──────────────────────────────────
async function transferToOwner(cid: string, cs: CallState): Promise<void> {
  const es = cs.language === "es";
  cs.requestedCallback = true;
  const transferNumber = cs.orgId ? await getTransferNumber(cs.orgId) : null;
  if (!transferNumber || !cs.toNumber) {
    // No transfer number configured — tell the caller someone will reach out, then end gracefully.
    await speakOnly(cid, es
      ? "Gracias. No hay nadie disponible en este momento, pero le avisaremos al equipo y alguien lo contactará pronto."
      : "Thanks. No one is available right now, but we'll let the team know and someone will reach out shortly.", cs.language);
    pendingHangups.add(cid);
    return;
  }
  cs.transferring = true;
  await speakOnly(cid, es
    ? "Transfiriendo ahora. Por favor espere."
    : "Transferring now. Please hold.", cs.language);

  const webhookUrl = `https://${process.env.HOST || "localhost:3000"}/api/telnyx/voice`;
  const ownerCid = await dialOutbound(transferNumber, cs.toNumber, webhookUrl);
  if (!ownerCid) {
    cs.transferring = false;
    cs.transferred = false;
    await speakOnly(cid, es
      ? "Lo siento, no pudimos comunicarnos con el equipo. Le avisaremos y alguien lo contactará pronto."
      : "Sorry, we couldn't reach the team. We'll let them know and someone will reach out shortly.", cs.language);
    pendingHangups.add(cid);
    await sendSms(cs.toNumber, transferNumber, es
      ? `🔔 Un llamador (${cs.callerNumber}) pidió hablar con usted y no pudimos transferir la llamada. Por favor devuélvale la llamada.`
      : `🔔 A caller (${cs.callerNumber}) asked to speak with you and the transfer failed — call them back.`);
    return;
  }
  transferStates.set(ownerCid, {
    inboundCid: cid,
    ownerPhone: transferNumber,
    callerNumber: cs.callerNumber,
    businessNumber: cs.toNumber,
    language: cs.language,
    answered: false,
  });
  console.log(`[Transfer] Dialed owner ${transferNumber} (leg ${ownerCid.slice(-8)}) for caller ${cs.callerNumber}`);
}

// ── Resolve the transfer number for an org (transfer_number → owner phone) ──
async function getTransferNumber(orgId: string): Promise<string | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  const sql = neon(dbUrl);
  // 1) organizations.transfer_number (explicit override)
  try {
    const rows = await sql`SELECT transfer_number FROM organizations WHERE id = ${orgId} LIMIT 1`;
    const tn = (rows[0] as any)?.transfer_number;
    if (tn) return tn;
  } catch { /* column may not exist yet */ }
  // 2) owner notification phone — organizations.phone (fallback)
  return getOwnerPhone(orgId);
}

// ── Get the owner's notification phone number ───────────────────────────
// Reads organizations.phone — the number the org configured in Settings.
// It deliberately does NOT read users.phone: the users table has NO phone
// column, so the old `SELECT phone FROM users ... AND role = 'owner'` threw on
// every single call, the catch below swallowed the error and returned null, and
// every owner notification path silently no-oped (post-call summary SMS,
// voicemail alert, low-rating alert, and the owner-transfer fallback number).
// One organization row per tenant, and its phone is the owner's own number.
// Returns E.164 (Telnyx requirement): what is stored is whatever the owner typed.
async function getOwnerPhone(orgId: string): Promise<string | null> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return null;
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT phone FROM organizations
      WHERE id = ${orgId}
      LIMIT 1
    `;
    const raw = (rows[0] as any)?.phone;
    const digits = raw ? String(raw).replace(/\D/g, "") : "";
    if (!digits) return null;
    return digits.length === 10 ? `+1${digits}` : `+${digits}`;
  } catch (err) {
    console.warn("[OwnerPhone] lookup failed:", String(err).slice(0, 120));
    return null;
  }
}

// ── Send SMS via Telnyx ─────────────────────────────────────────────────
async function sendSms(from: string, to: string, text: string) {
  try {
    await fetch(`${TELNYX}/messages`, {
      method: "POST", headers: th(),
      body: JSON.stringify({
        from,
        to,
        text,
        ...(TELNYX_CONNECTION_ID ? { messaging_profile_id: TELNYX_CONNECTION_ID } : {}),
      }),
    });
    console.log(`[SMS] Sent to ${to}: "${text.slice(0, 80)}"`);
  } catch (err) {
    console.error("[SMS] Send failed:", String(err).slice(0, 100));
  }
}

// ── Support request → owner SMS alert ─────────────────────────────────────
// Same-day priority support (Scale plan): text the owner's phone the moment a
// support request arrives via an interceptable intake path (web chat, etc.).
// DB-independent (Telnyx only) — still works while Neon is down.
// Owner support-alert destination - internal routing only, never expose publicly.
const SUPPORT_ALERT_TO = process.env.SUPPORT_ALERT_TO || "";
// Sender (platform line) for support-alert SMS.
const SUPPORT_ALERT_FROM = process.env.SUPPORT_ALERT_FROM || "";

function isSupportEscalation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /\b(human|representative|agent|humano|representante|agente)\b/.test(m) ||
    m.includes("real person") ||
    m.includes("persona real") ||
    m.includes("talk to a person") ||
    m.includes("talk to someone") ||
    m.includes("speak to a person") ||
    m.includes("speak to someone") ||
    m.includes("contact support") ||
    m.includes("customer support") ||
    m.includes("hablar con una persona") ||
    m.includes("hablar con alguien") ||
    m.includes("atencion al cliente") ||
    m.includes("atención al cliente")
  );
}

async function notifyOwnerOfSupportRequest(source: string, detail: string): Promise<void> {
  if (!process.env.TELNYX_API_KEY) {
    console.warn("[Support] TELNYX_API_KEY not set — cannot alert owner");
    return;
  }
  if (!SUPPORT_ALERT_TO || !SUPPORT_ALERT_FROM) return;
  const text = `🚨 ReceptionAI support request\nSource: ${source}\n${detail}`;
  await sendSms(SUPPORT_ALERT_FROM, SUPPORT_ALERT_TO, text);
}

// ── Web-chat callback request → owner SMS alert ───────────────────────────
// A visitor who explicitly asks to be contacted AND leaves a phone number or an
// email gets a REAL alert to the owner, on the same SUPPORT_ALERT_TO/FROM path as
// the priority-support alerts (#24). Without a reachable address nothing is sent:
// the chat reply only says the request was noted (see the chat guardrails), so the
// bot can never claim a message to the owner went out if nothing did.
const CALLBACK_ALERT_COOLDOWN_MS = 60_000;
const lastCallbackAlertAt = new Map<string, number>(); // contact → epoch ms (in-memory, single instance)

// Returns the phone/email to call back, or null when the message is not an
// explicit contact request with a reachable address. EN + ES intent words.
function detectCallbackContact(message: string): string | null {
  const intent = /\b(callback|call ?back|call me|contact me|get in touch|reach me|text me|email me|message me|ll[aá]mame|llamarme|escr[ií]beme|escribirme|escribir|que me llamen|que me contacten|contactarme|m[aá]ndame)\b/i;
  if (!intent.test(message)) return null;
  const email = message.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (email) return email[0];
  const phone = message.match(/\+?\d[\d\s().-]{5,}\d/);
  if (phone) {
    const digits = phone[0].replace(/\D/g, "");
    // Normalize punctuation so "(305) 555-7788" alerts as "305 555-7788".
    if (digits.length >= 7 && digits.length <= 15) return phone[0].replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  }
  return null;
}

// Fire-and-forget: deduped per contact, never throws, never surfaces an error
// to the visitor. Missing env or a Telnyx failure only warn-logs.
async function alertOwnerOfCallbackRequest(contact: string, message: string): Promise<void> {
  try {
    if (!SUPPORT_ALERT_TO || !SUPPORT_ALERT_FROM) {
      console.warn("[Callback] SUPPORT_ALERT_TO/FROM not set — owner callback alert skipped");
      return;
    }
    const now = Date.now();
    const lastAt = lastCallbackAlertAt.get(contact) || 0;
    if (now - lastAt < CALLBACK_ALERT_COOLDOWN_MS) return;
    if (lastCallbackAlertAt.size > 500) lastCallbackAlertAt.clear(); // stay bounded
    lastCallbackAlertAt.set(contact, now);
    const snippet = message.replace(/\s+/g, " ").trim().slice(0, 100);
    await notifyOwnerOfSupportRequest("web chat callback request", `${contact} | "${snippet}"`);
  } catch (err) {
    console.warn("[Callback] owner alert failed:", String(err).slice(0, 120));
  }
}

// ── Build SMS summary from call state ───────────────────────────────────
function buildCallSummary(cs: CallState, transcript?: string): string {
  const duration = Math.round((Date.now() - cs.startTime.getTime()) / 1000);
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  const dtmfStr = cs.dtmfHistory.length > 0 ? cs.dtmfHistory.join(" → ") : "none";
  const callerLabel = cs.callerFirstName ? `${cs.callerFirstName} (${cs.callerNumber})` : cs.callerNumber;
  const outcome = cs.appointmentBooked ? "Appointment booked" : cs.requestedCallback ? "Requested owner callback" : cs.appointmentIntent ? "Appointment interest" : "General inquiry";

  return [
    `📞 ReceptionAI Call Summary`,
    `From: ${callerLabel}`,
    `Duration: ${durationStr}`,
    `Outcome: ${outcome}`,
    `DTMF: ${dtmfStr}`,
    transcript ? `AI Summary: ${transcript}` : null,
    `Time: ${cs.startTime.toLocaleString("en-US", { timeZone: "America/Chicago" })} CT`,
    `—`,
    `Check your dashboard: receptionai.store/dashboard`,
  ].filter(Boolean).join("\n");
}
// ── JSON response helper ───────────────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
// ── Auth helper for dashboard API routes ────────────────────────────────
async function requireOrgAuth(
  req: Request
): Promise<{ organizationId: string; userId: string; role: string } | Response> {
  const authHeader = req.headers.get("Authorization") || "";
  const t = authHeader.replace("Bearer ", "");
  if (!t) return json({ error: "Authentication required" }, 401);
  const { jwtVerify } = await import("jose");
  const secKey = process.env.JWT_SECRET!;
  let payload: any;
  try {
    const r = await jwtVerify(t, new TextEncoder().encode(secKey));
    payload = r.payload;
  } catch {
    return json({ error: "Invalid token" }, 401);
  }
  const organizationId = payload.organizationId as string;
  if (!organizationId) return json({ error: "No organization" }, 400);
  return {
    organizationId,
    userId: (payload.userId as string) || "",
    role: (payload.role as string) || "agent",
  };
}
// ── Token encryption at rest (AES-256-GCM; key derived from APP_ENC_KEY) ─
function getEncKey(): Buffer | null {
  const key = process.env.APP_ENC_KEY || "";
  if (!key) return null;
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(key);
  return Buffer.from(hasher.digest("hex"), "hex");
}
async function encryptToken(plain: string): Promise<string | null> {
  if (!plain) return null;
  const key = getEncKey();
  if (!key) return `plain:${plain}`;
  const { createCipheriv, randomBytes } = await import("node:crypto");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}
async function decryptToken(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith("plain:")) return stored.slice(6);
  if (!stored.startsWith("v1:")) return stored; // legacy plaintext
  const key = getEncKey();
  if (!key) return null;
  const parts = stored.split(":");
  if (parts.length !== 4) return null;
  try {
    const { createDecipheriv } = await import("node:crypto");
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

// ── Google OAuth + Calendar (plain REST via fetch — no extra deps) ──────
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
function googleEnv() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI || "",
  };
}
function googleConfigured(): boolean {
  const e = googleEnv();
  return !!(e.clientId && e.clientSecret && e.redirectUri);
}
async function exchangeGoogleCode(code: string): Promise<any | null> {
  const e = googleEnv();
  if (!e.clientId || !e.clientSecret || !e.redirectUri) return null;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: e.clientId, client_secret: e.clientSecret,
      redirect_uri: e.redirectUri, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}
async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  const e = googleEnv();
  if (!e.clientId || !e.clientSecret || !refreshToken) return null;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: e.clientId, client_secret: e.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.access_token || null;
}
async function getGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.email || null;
  } catch {
    return null;
  }
}
async function createGoogleCalendarEvent(accessToken: string, calendarId: string, event: any): Promise<string | null> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.id || null;
}
async function patchGoogleCalendarEvent(accessToken: string, calendarId: string, eventId: string, event: any): Promise<boolean> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  return res.ok;
}
async function deleteGoogleCalendarEvent(accessToken: string, calendarId: string, eventId: string): Promise<boolean> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok || res.status === 404 || res.status === 410;
}

// ── Calendar sync helpers ───────────────────────────────────────────────
async function getGoogleConnection(orgId: string): Promise<any | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT * FROM calendar_integrations
      WHERE organization_id = ${orgId} AND provider = 'google' AND sync_enabled = true
      ORDER BY created_at DESC LIMIT 1
    `;
    return rows[0] || null;
  } catch (e) {
    console.error("[Calendar] connection lookup failed", String(e).slice(0, 120));
    return null;
  }
}
async function logCalendarSync(orgId: string, appointmentId: string | null, action: string, status: string, detail?: string | null): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;
  try {
    const sql = neon(dbUrl);
    await sql`
      INSERT INTO calendar_sync_log (id, organization_id, appointment_id, provider, action, status, detail, created_at)
      VALUES (gen_random_uuid(), ${orgId}, ${appointmentId || null}, 'google', ${action}, ${status}, ${detail || null}, NOW())
    `;
  } catch (e) {
    console.error("[Calendar] sync log failed", String(e).slice(0, 120));
  }
}
// Sync an appointment to the org's connected Google Calendar.
async function syncAppointmentToGoogle(apptId: string): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;
  let sql: any;
  try { sql = neon(dbUrl); } catch { return; }
  let orgId = "";
  try {
    const apptRows = await sql`
      SELECT a.id, a.organization_id, a.title, a.start_time, a.end_time, a.status,
             a.service_type, a.external_calendar_event_id, a.notes,
             c.first_name, c.last_name, c.phone, c.email
      FROM appointments a
      LEFT JOIN contacts c ON a.contact_id = c.id
      WHERE a.id = ${apptId} LIMIT 1
    `;
    const appt = apptRows[0];
    if (!appt) return;
    orgId = appt.organization_id;
    const conn = await getGoogleConnection(orgId);
    if (!conn) return;
    if (!googleConfigured()) {
      await logCalendarSync(orgId, apptId, "create", "skipped", "Google OAuth not configured");
      return;
    }
    const refresh = await decryptToken(conn.refresh_token_encrypted);
    if (!refresh) {
      await logCalendarSync(orgId, apptId, "create", "failed", "No refresh token");
      return;
    }
    const accessToken = await refreshGoogleToken(refresh);
    if (!accessToken) {
      await logCalendarSync(orgId, apptId, "create", "failed", "Token refresh failed");
      return;
    }
    const calendarId = conn.calendar_id || "primary";
    // Cancelled → delete remote event
    if (appt.status === "cancelled") {
      if (appt.external_calendar_event_id) {
        const ok = await deleteGoogleCalendarEvent(accessToken, calendarId, appt.external_calendar_event_id);
        await logCalendarSync(orgId, apptId, "delete", ok ? "success" : "failed");
      }
      return;
    }
    const customerName = [appt.first_name, appt.last_name].filter(Boolean).join(" ").trim();
    const event: any = {
      summary: appt.title || appt.service_type || "Appointment",
      description: appt.notes || appt.service_type || "",
      start: { dateTime: new Date(appt.start_time).toISOString(), timeZone: "America/Chicago" },
      end: { dateTime: new Date(appt.end_time).toISOString(), timeZone: "America/Chicago" },
    };
    if (customerName && appt.email) {
      event.attendees = [{ displayName: customerName, email: appt.email, responseStatus: "accepted" }];
    }
    if (appt.external_calendar_event_id) {
      const ok = await patchGoogleCalendarEvent(accessToken, calendarId, appt.external_calendar_event_id, event);
      await logCalendarSync(orgId, apptId, "update", ok ? "success" : "failed");
    } else {
      const eventId = await createGoogleCalendarEvent(accessToken, calendarId, event);
      if (eventId) {
        await sql`UPDATE appointments SET external_calendar_event_id = ${eventId}, updated_at = NOW() WHERE id = ${apptId}`;
        await logCalendarSync(orgId, apptId, "create", "success", eventId);
      } else {
        await logCalendarSync(orgId, apptId, "create", "failed");
      }
    }
  } catch (e) {
    console.error("[Calendar] sync failed", String(e).slice(0, 200));
    if (orgId) await logCalendarSync(orgId, apptId, "create", "error", String(e).slice(0, 200));
  }
}
const freePort = `for _ in $(seq 1 25); do pids=$(lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true); if [ -z "$pids" ]; then exit 0; fi; kill $pids 2>/dev/null || true; sleep 0.2; done`;

for (let attempt = 1; ; attempt++) {
  await Bun.$`sudo sh -c ${freePort}`.quiet().nothrow();
  try {
    Bun.serve({
      port: PORT, hostname: HOST,
      async fetch(req) {
        const { pathname } = new URL(req.url);

        // ── Request logging (skip health checks) ──────────────────
        if (pathname !== "/api/reminders/process") {
          console.log(`${new Date().toISOString().slice(0,19).replace("T"," ")} ${req.method} ${pathname}`);
        }

        // ── Stale call cleanup (every ~200 requests, remove calls >2h old) ──
        if (Math.random() < 0.005) {
          const cutoff = Date.now() - 2 * 60 * 60 * 1000;
          for (const [cid, cs] of calls) {
            if (cs.startTime.getTime() < cutoff) { calls.delete(cid); pendingHangups.delete(cid); }
          }
          for (const [cid] of callbackStates) {
            if (callbackStates.get(cid) && !callbackStates.get(cid)!.answered) callbackStates.delete(cid);
          }
          // Transfer legs and pending outbound callbacks whose events never arrived are stale.
          transferStates.clear();
          pendingCallbacks.clear();
        }

        if (pathname === "/api/telnyx/voice" && req.method === "POST") {
          try {
            const p = await req.json();
            const ev = p.data?.event_type || "";
            const cid = p.data?.payload?.call_control_id || "";

            // ── New call: answer → language choice → speak → gather ───────
            if (ev === "call.initiated" || ev === "call_initiated") {
              // One line per call: the English voice and pacing this caller is about to hear.
              logVoiceForCall(cid);
              const toNumber = p.data?.payload?.to || "";
              const fromNumber = p.data?.payload?.from || "";

              // ── Outbound callback call? ──────────────────────────
              const cbInfo = pendingCallbacks.get(cid);
              if (cbInfo) {
                pendingCallbacks.delete(cid);
                callbackStates.set(cid, { ...cbInfo, answered: false });
                const es = cbInfo.language === "es";
                await cmd(cid, "answer");
                setTimeout(async () => {
                  await speakOnly(cid, es
                    ? `Hola, somos ${cbInfo.orgName}. Disculpe que no pudimos atender su llamada. Presione 1 para agendar una cita.`
                    : `Hi, this is ${cbInfo.orgName}. Sorry we missed your call. Press 1 to book an appointment.`, cbInfo.language);
                }, 600);
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }

              // ── Regular inbound call ─────────────────────────────
              const org = await getOrgByPhoneNumber(toNumber);
              const companyName = org?.name || process.env.COMPANY_NAME || "ReceptionAI";
              const isDemo = !org; // no org in DB = demo number

              // Look up caller history for known callers
              let callerContext: CallerContext | undefined;
              if (org?.orgId) {
                callerContext = await lookupCallerHistory(fromNumber, org.orgId) || undefined;
              }

              // Track call state (start with language selection phase)
              const callState: CallState = {
                callerNumber: fromNumber,
                toNumber,
                dtmfHistory: [],
                startTime: new Date(),
                orgId: org?.orgId || null,
                orgName: org?.name || null,
                callerFirstName: callerContext?.firstName,
                callerContactId: callerContext?.contactId,
                appointmentIntent: false,
                appointmentBooked: false,
                language: "en",
                phase: "language",
                answered: false,
                callbackSent: false,
                surveySent: false,
                gatherTimeouts: 0,
                transferred: false,
                transferring: false,
                requestedCallback: false,
                voicemail: false,
                callControlId: cid,
              };
              // Create the conversation row NOW (at answer) instead of at hangup, so a voicemail
              // recording that lands mid-call has a valid parent row. Deliberately not awaited:
              // a slow database must never delay answering a real caller. Every writer that
              // depends on the row awaits cs.convReady first.
              callState.convReady = ensureCallConversation(callState);
              calls.set(cid, callState);
              await cmd(cid, "answer");
              setTimeout(async () => {
                // Bilingual opening prompt — each language segment gets its OWN voice.
                // Previously one mixed-language string was sent with the default (English) voice,
                // so "Para español, presione 2." was read by Polly.Joanna-Neural with an English accent.
                // Telnyx call-control `speak` audio is queued in order (see SpeakRequest.stop: playback
                // is only interrupted/cleared when an explicit `stop` is sent), so two sequential
                // speak commands are safe and play back-to-back.
                await speakOnly(cid, "Welcome! For English, press 1.", "en");
                await speakOnly(cid, "Para español, presione 2.", "es");
              }, 600);
            }

            // ── Recording saved (voicemail completed) ──────────────
            else if (ev === "call.recording.saved" || ev === "call.recording.saved") {
              // Telnyx sends `recording_urls` (mp3/wav) on current payloads and `recording_url` /
              // `public_recording_url` on older ones — accept all, prefer mp3.
              const payloadUrls = p.data?.payload?.recording_urls || {};
              const recordingUrl: string = payloadUrls.mp3 || payloadUrls.wav
                || p.data?.payload?.recording_url || p.data?.payload?.public_recording_url || "";
              // The durable handle: webhook recording URLs expire, a recording id does not.
              const recordingId: string | null = p.data?.payload?.recording_id || null;
              // Duration is stored only when Telnyx actually reported one.
              const durationMs = parseInt(p.data?.payload?.duration_millis || "0", 10);
              const durationSeconds: number | null = durationMs > 0
                ? Math.round(durationMs / 1000)
                : (parseInt(p.data?.payload?.duration || "0", 10) || null);
              const cs = calls.get(cid);
              // This guard used to require cs.orgId, which made the DEMO ending below
              // unreachable: a caller on the demo line (no organization) left a message, heard
              // the beep, and the call just ended — no ending, no disclosure (owner directive
              // 2026-10-29: the ending must say what the demo was). The org-only work (recording
              // row + owner alert) is now inside its own check, so a business call behaves
              // exactly as before and a demo call still stores nothing.
              if (cs && recordingUrl) {
                cs.voicemail = true; // this call was a voicemail, not a normal completion
                if (cs.orgId) {
                  const stored = await saveVoicemailRecording(cs, recordingUrl, durationSeconds, recordingId);
                  // One alert per voicemail: pressing 9 already announced it, so only announce
                  // here if nothing was sent yet (never text the owner twice for one message).
                  if (!cs.voicemailAlerted) {
                    cs.voicemailAlerted = true;
                    await notifyOwnerOfVoicemail(cs.orgId, cs.callerNumber, cs.toNumber, cs.language || "en");
                  }
                  if (!stored) {
                    console.warn(`[Voicemail] audio for ${cs.callerNumber} could not be stored — owner alerted, dashboard will show "Not available"`);
                  }
                }
                const es = (cs.language || "en") === "es";
                if (!cs.orgId) {
                  // Demo ending: say plainly what they just heard (owner directive) — in the
                  // caller's language. Spanish used to promise "we received your message, we'll
                  // contact you shortly" on a demo line that stores nothing and calls nobody back.
                  await speakLines(cid, es ? DEMO_ES.voicemail : DEMO_EN.voicemail, es ? "es" : "en");
                } else {
                  await speakOnly(cid, es
                    ? "Gracias. Recibimos su mensaje. Le contactaremos pronto. Adiós."
                    : "Thank you. We received your message. We'll get back to you shortly. Goodbye.", cs.language || "en");
                }
                pendingHangups.add(cid);
              }
              return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
            }

            // ── Owner answered for a transfer → bridge caller to owner ──
            else if (ev === "call.answered") {
              const t = transferStates.get(cid);
              if (t) {
                t.answered = true;
                const inbound = calls.get(t.inboundCid);
                const bridged = await cmd(t.inboundCid, "bridge", { call_control_id: cid });
                if (bridged && inbound) inbound.transferred = true;
                console.log(`[Transfer] Owner answered; bridge ${bridged ? "ok" : "FAILED"} ${t.inboundCid.slice(-8)} <-> ${cid.slice(-8)}`);
              }
              return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
            }

            // ── Speak ended → gather or hangup ─────────────────────────
            else if (ev === "call.speak.ended") {
              const speakCs = calls.get(cid);
              if (speakCs?.transferring) {
                // Dialing the owner — wait for the bridge; do not re-prompt.
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }
              // `call.speak.ended` fires once PER speak command and the segments of a queued
              // prompt finish seconds apart, so wait for the last one: only then hang up (or
              // arm the single DTMF gather). Without this a multi-line goodbye was cut off
              // part-way and every extra segment armed another gather.
              const segsLeft = speakSegments.get(cid) || 0;
              if (segsLeft > 1) {
                speakSegments.set(cid, segsLeft - 1);
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }
              speakSegments.delete(cid);
              finishSpeaking(cid);
            }

            // ── DTMF pressed ───────────────────────────────────────
            else if (ev === "call.dtmf.received" || ev === "dtmf.received") {
              const digit = p.data?.payload?.digit || "";
              console.log(`DTMF: ${digit} — call ${cid.slice(-8)}`);

              // ── Callback call DTMF? ─────────────────────────────
              const cbState = callbackStates.get(cid);
              if (cbState) {
                const es = cbState.language === "es";
                if (digit === "1") {
                  cbState.answered = true;
                  await speakOnly(cid, es
                    ? "Gracias. Alguien lo contactará pronto. ¡Que tenga un buen día!"
                    : "Thank you. Someone will reach out shortly. Have a great day!", cbState.language);
                  setTimeout(() => cmd(cid, "hangup"), 2000);
                } else {
                  await speakOnly(cid, es
                    ? "Gracias por su tiempo. ¡Que tenga un buen día!"
                    : "Thank you for your time. Have a great day!", cbState.language);
                  setTimeout(() => cmd(cid, "hangup"), 2000);
                }
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }

              // Idempotency: one press can be delivered more than once (duplicate armed
              // gathers, provider retries). Repeating the whole response for the same digit
              // within 700 ms is what made the demo feel like it replayed the options.
              {
                const now = Date.now();
                const prevPress = lastDtmf.get(cid);
                if (prevPress && prevPress.digit === digit && now - prevPress.ts < 700) {
                  console.log(`[DTMF] duplicate ${digit} ignored (+${now - prevPress.ts}ms)`);
                  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
                }
                lastDtmf.set(cid, { digit, ts: now });
              }
              gatherActive.delete(cid); // this press satisfied the active gather

              // Track DTMF in call state (cap at 50 to prevent memory issues from spam)
              const cs = calls.get(cid);
              if (cs) {
                cs.dtmfHistory.push(digit);
                if (cs.dtmfHistory.length > 50) cs.dtmfHistory = cs.dtmfHistory.slice(-50);
              }

              // ── Language selection phase ────────────────────────
              if (cs?.phase === "language") {
                if (digit === "1") {
                  cs.language = "en";
                  cs.phase = "menu";
                  cs.answered = true; // caller interacted — mark as answered
                  const isDemo = !cs.orgId;
                  if (isDemo) {
                    // First English line carries stop:"all" — Telnyx then drops the Spanish
                    // leg still queued behind the language prompt ("stop current audio and
                    // clear the queue"), so a caller who pressed 1 no longer hears
                    // "Para español, presione 2" after choosing English.
                    await speakWithQueueControl(cid, DEMO_GREETING_OPENER, "en", "all");
                    // "Thanks for calling ReceptionAI!" is issued outside speakLines(), so give
                    // it the same beat before the next idea that the other segments get.
                    await paceGap("en");
                    await speakLines(cid, DEMO_EN.greeting.slice(1), "en");
                  } else {
                    const greeting = buildGreetingLines(cs.orgName || "ReceptionAI", "en", cs.callerFirstName ? { firstName: cs.callerFirstName, previousVisits: 1 } as CallerContext : undefined);
                    await speakLines(cid, greeting, "en");
                  }
                } else if (digit === "2") {
                  cs.language = "es";
                  cs.phase = "menu";
                  cs.answered = true; // caller interacted — mark as answered
                  const isDemo = !cs.orgId;
                  // Same shape as the English branch: the menu is a LIST, spoken one option per
                  // utterance with real beats. The old code spoke one 40-word sentence (and for a
                  // business line it spoke only element [0] of the greeting).
                  const greeting = isDemo
                    ? DEMO_ES.greeting
                    : buildGreetingLines(cs.orgName || "ReceptionAI", "es", cs.callerFirstName ? { firstName: cs.callerFirstName, previousVisits: 1 } as CallerContext : undefined);
                  await speakSpanishGreeting(cid, greeting);
                } else {
                  await speakOnly(cid, `Please press 1 for English, or 2 for Spanish.`, "en");
                }
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }

              // ── Reschedule phases ──────────────────────────
              if (cs?.phase?.startsWith("reschedule_") || cs?.phase === "survey" || cs?.phase === "waitlist") {
                await handleReschedulePhase(cid, digit, cs);
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }
              // ── Booking slot selection phase ────────────────
              if (cs?.phase === "booking_slots") {
                await handleBookingPhase(cid, digit, cs);
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }

              // ── Menu phase ──────────────────────────────────────
              const lang = cs?.language || "en";
              const es = lang === "es";

              if (digit === "1") {
                if (cs) cs.appointmentIntent = true;
                const isDemo = !cs?.orgId;
                if (isDemo) {
                  if (es) {
                    await speakLines(cid, DEMO_ES.book, "es");
                  } else {
                    if (cs) cs.demoTurns = (cs.demoTurns || 0) + 1;
                    await speakLines(cid, DEMO_EN.book, "en");
                  }
                } else if (cs) {
                  // Real voice booking: fetch next available slots and offer them over DTMF
                  await startVoiceBooking(cid, cs);
                }
              }

              else if (digit === "2") {
                if (es) {
                  await speakLines(cid, !cs?.orgId ? DEMO_ES.pricing : ES_PRICING_LINES, "es");
                } else if (!cs?.orgId) {
                  if (cs) cs.demoTurns = (cs.demoTurns || 0) + 1;
                  await speakLines(cid, DEMO_EN.pricing, "en");
                } else {
                  await speakOnly(cid, "ReceptionAI plans: Starter at $99 a month, Growth at $199, and Scale at $399. Visit our website to sign up.", "en");
                }
              }

              else if (digit === "3") {
                const isDemo = !cs?.orgId;
                if (isDemo) {
                  if (es) {
                    await speakLines(cid, DEMO_ES.transfer, "es");
                  } else {
                    if (cs) cs.demoTurns = (cs.demoTurns || 0) + 1;
                    await speakLines(cid, DEMO_EN.transfer, "en");
                  }
                  pendingHangups.add(cid);
                } else if (cs) {
                  await transferToOwner(cid, cs);
                }
              }

              else if (digit === "4") {
                // Demo line: no DB, so don't walk into the reschedule flow and read a menu.
                // Spanish used to FALL THROUGH here into the reschedule lookup, which then
                // answered a Spanish caller with an English line ("I can't look up appointments
                // in demo mode") — the long-standing "Spanish caller pressing 4 hears English"
                // bug. Spanish now gets its own demo answer, exactly like English.
                if (!cs?.orgId) {
                  if (es) {
                    await speakLines(cid, DEMO_ES.reschedule, "es");
                  } else {
                    if (cs) cs.demoTurns = (cs.demoTurns || 0) + 1;
                    await speakLines(cid, DEMO_EN.reschedule, "en");
                  }
                  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
                }
                // Start rescheduling flow
                if (cs) { cs.phase = "reschedule_lookup"; }
                await speakOnly(cid, es
                  ? "Déjeme buscar su cita. ¿Bajo qué número de teléfono está registrada? Ingrese los dígitos."
                  : "Let me look up your appointment. Enter the phone number it's under, digit by digit.", lang);
                // Use a gather with more digits for phone entry
                setTimeout(() => cmd(cid, "gather", {
                  type: "dtmf", minimum_digits: 10, maximum_digits: 11, timeout_millis: 10000,
                }), 500);
              }

              else if (digit === "5") {
                if (!cs?.orgId) {
                  if (es) {
                    await speakLines(cid, DEMO_ES.hours, "es");
                  } else {
                    if (cs) cs.demoTurns = (cs.demoTurns || 0) + 1;
                    await speakLines(cid, DEMO_EN.hours, "en");
                  }
                } else {
                  await speakOnly(cid, es
                    ? "Déjeme verificar la disponibilidad. Tenemos citas disponibles de lunes a viernes de 9 AM a 5 PM. Visite nuestro sitio web para ver horarios específicos o presione 1 para agendar."
                    : "Let me check availability. We have appointments Monday through Friday 9 AM to 5 PM. Visit our website for specific times or press 1 to schedule.", lang);
                }
              }

              else if (digit === "9") {
                // Voicemail recording
                if (cs) {
                  cs.answered = true;
                  cs.voicemail = true; // persisted as conversations.status = 'voicemail' at hangup
                  cs.phase = "menu";
                }
                await startVoicemailRecording(cid, lang);
                if (cs?.orgId && cs?.callerNumber && cs?.toNumber) {
                  // Announce once, here: the recording.saved handler would otherwise text again.
                  cs.voicemailAlerted = true;
                  notifyOwnerOfVoicemail(cs.orgId, cs.callerNumber, cs.toNumber, lang);
                }
              }

              else {
                if (!cs?.orgId) {
                  // Options once, in the same wording the greeting used — in the caller's language.
                  if (es) {
                    await speakLines(cid, DEMO_ES.notHeard, "es");
                  } else {
                    if (cs) cs.demoTurns = (cs.demoTurns || 0) + 1;
                    await speakLines(cid, DEMO_EN.notHeard, "en");
                  }
                } else {
                  await speakOnly(cid, es
                    ? "Lo siento, no entendí. " + buildShortPrompt("es")
                    : "Sorry, I didn't get that. " + buildShortPrompt("en"), lang);
                }
              }
            }

            // ── Gather ended (timeout, no DTMF) ─────────────────────
            else if (ev === "call.gather.ended") {
              gatherActive.delete(cid);
              const cs = calls.get(cid);
              // Telnyx fires `call.gather.ended` BOTH when the gather times out AND when it
              // completes with digits — the payload then carries `digits` (status "valid").
              // Only a gather that ended with NO digits means the caller stayed silent. Without
              // this check every valid keypress ALSO ran the silence logic below, so each press
              // got its correct answer followed by a second, contradicting prompt ("Take your
              // time. Press 1 to ..." / "I didn't hear anything") — the owner's 2026-10-28
              // "still duplicating the message" report. The press itself is answered exactly
              // once by the `call.dtmf.received` branch above, which owns the response.
              const gatheredDigits = String(p.data?.payload?.digits ?? "").trim();
              if (gatheredDigits) {
                console.log(`[Gather] ended with digits "${gatheredDigits}" — answered by dtmf.received, no silence prompt`);
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }
              // ── Demo line: never replay the whole option list (owner report 2026-10-28) ──
              // After the caller has had a response, 8s of silence means they're done — close
              // the call honestly instead of re-announcing the options. Only the very first
              // silence gets one gentle nudge.
              if (cs && !cs.orgId && !(cs.phase || "").startsWith("reschedule_")) {
                // Both languages (Spanish used to fall through to "No escuché nada" + the whole
                // option list after every silence, in the caller's language but never closing).
                const dlang = (cs.language || "en") === "es" ? "es" : "en";
                const script = dlang === "es" ? DEMO_ES : DEMO_EN;
                if (!cs.demoNudged) {
                  // One gentle nudge, once. The old code parked a -1 in demoTurns, which the
                  // next `demoTurns + 1` turned back into 0/falsy, so the nudge repeated after
                  // every press and the closing ("I'll let you go") never arrived.
                  cs.demoNudged = true;
                  setTimeout(() => { speakLines(cid, script.nudge, dlang).catch(() => {}); }, 300);
                } else {
                  pendingHangups.add(cid);
                  setTimeout(() => { speakLines(cid, script.closing, dlang).catch(() => {}); }, 300);
                }
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }
              // Handle reschedule/waitlist timeouts — return to menu
              if (cs?.phase?.startsWith("reschedule_") || cs?.phase === "waitlist" || cs?.phase === "booking_slots") {
                cs.phase = "menu";
                const lang = cs.language || "en";
                const es = lang === "es";
                setTimeout(() => speakOnly(cid, es
                  ? "No escuché nada. Volviendo al menú. " + buildShortPrompt("es")
                  : "I didn't hear anything. Back to the menu. " + buildShortPrompt("en"), lang), 300);
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }
              // Track consecutive timeouts — after 2, offer voicemail
              if (cs) cs.gatherTimeouts = (cs.gatherTimeouts || 0) + 1;
              if (cs && cs.gatherTimeouts >= 2 && !cs.answered) {
                const lang = cs.language || "en";
                const es = lang === "es";
                cs.gatherTimeouts = 0;
                setTimeout(() => speakOnly(cid, es
                  ? "Parece que tiene dificultades con el menú. Presione 9 para dejar un mensaje de voz, o espere para intentar de nuevo."
                  : "It seems you're having trouble with the menu. Press 1 to leave a voicemail, or wait to try again.", lang), 300);
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }
              const lang = cs?.language || "en";
              const es = lang === "es";
              setTimeout(() => speakOnly(cid, es
                ? "No escuché nada. " + buildShortPrompt("es")
                : "I didn't hear anything. " + buildShortPrompt("en"), lang), 500);
            }

            // ── Hangup ──────────────────────────────────────────────
            else if (ev === "call.hangup" || ev === "call.hungup") {
              const cs = calls.get(cid);
              console.log(`Hangup: ${cid.slice(-8)}${cs ? ` from ${cs.callerNumber}` : ""}`);

              // ── Owner transfer leg hung up ─────────────────────
              const tState = transferStates.get(cid);
              if (tState) {
                if (!tState.answered) {
                  // Owner missed — text owner to call the caller back
                  await sendSms(tState.businessNumber, tState.ownerPhone, tState.language === "es"
                    ? `🔔 Un llamador (${tState.callerNumber}) pidió hablar con usted y no atendió la transferencia. Por favor devuélvale la llamada.`
                    : `🔔 A caller (${tState.callerNumber}) asked to speak with you and you missed the transfer — call them back.`);
                  const inbound = calls.get(tState.inboundCid);
                  if (inbound) {
                    inbound.transferring = false;
                    inbound.transferred = false;
                    await speakOnly(tState.inboundCid, tState.language === "es"
                      ? "No hay nadie disponible en este momento. Le pediremos que lo llamen pronto."
                      : "No one is available right now. We'll have them call you back shortly.", tState.language);
                    pendingHangups.add(tState.inboundCid);
                  }
                } else {
                  // Owner hung up after talking — end the caller leg too
                  await cmd(tState.inboundCid, "hangup");
                }
                transferStates.delete(cid);
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }

              // ── Caller leg hung up while a transfer was in flight → end the owner leg ──
              for (const [ownerLegCid, st] of transferStates) {
                if (st.inboundCid === cid) {
                  await cmd(ownerLegCid, "hangup");
                  transferStates.delete(ownerLegCid);
                  break;
                }
              }

              // Stop any in-progress recording
              stopVoicemailRecording(cid);

              // Clean up callback state if it was a callback call
              if (callbackStates.has(cid)) {
                const cbState = callbackStates.get(cid);
                if (cbState && cbState.answered && cbState.callerNumber && cbState.businessNumber) {
                  // Send confirmation SMS
                  await sendSms(cbState.businessNumber, cbState.callerNumber,
                    cbState.language === "es"
                      ? `Hola, gracias por su interés. Alguien de ${cbState.orgName} lo contactará pronto.`
                      : `Hi, thanks for your interest. Someone from ${cbState.orgName} will reach out shortly.`);
                }
                callbackStates.delete(cid);
                calls.delete(cid);
                return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
              }

              // Save caller history to database
              if (cs && cs.orgId) {
                await saveCallerHistory(cs);

                // Transferred calls were handled by the owner — skip AI summary/notifications
                if (cs.transferred) {
                  calls.delete(cid);
                  pendingHangups.delete(cid);
                  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
                }

                // Generate AI transcript and send notifications
                const transcript = await generateCallTranscript(cs);
                const summary = buildCallSummary(cs, transcript);
                const outcome = cs.appointmentBooked ? "Appointment booked" : cs.requestedCallback ? "Requested owner callback" : cs.appointmentIntent ? "Appointment interest" : "General inquiry";

                // Send SMS summary to owner
                const ownerPhone = await getOwnerPhone(cs.orgId);
                if (ownerPhone) {
                  await sendSms(cs.toNumber, ownerPhone, summary);
                }

                // Send email notification
                await sendEmailNotification(cs.orgId,
                  `📞 Call from ${cs.callerFirstName || cs.callerNumber} — ${outcome}`,
                  summary);

                // ── Missed call auto-callback ────────────────────
                // Check: not answered, no DTMF interaction, not already sent callback, has caller number
                if (!cs.answered && cs.dtmfHistory.length === 0 && !cs.callbackSent && cs.callerNumber && cs.orgId) {
                  cs.callbackSent = true;
                  scheduleCallback(cs);
                  console.log(`[Missed Call] Scheduling callback to ${cs.callerNumber}`);
                }

                // If caller had appointment intent but no appt booked, schedule 15-min follow-up SMS
                if (cs.appointmentIntent && !cs.appointmentBooked) {
                  const toNumber = cs.toNumber;
                  const callerNumber = cs.callerNumber;
                  const orgName = cs.orgName || "our team";
                  const lang = cs.language || "en";
                  const followUp = lang === "es"
                    ? `Hola, somos ${orgName}. Notamos que llamó y estaba interesado en agendar una cita pero no pudimos completarla. ¿Le gustaría que lo contactemos para agendar? Responda SI y lo contactaremos pronto.`
                    : `Hi, this is ${orgName}. We noticed you called earlier and were interested in booking an appointment but we weren't able to complete it. Would you like us to reach out to schedule? Reply YES and we'll contact you shortly.`;
                  setTimeout(async () => {
                    await sendSms(toNumber, callerNumber, followUp);
                  }, 15 * 60 * 1000); // 15 minutes
                  console.log(`[Follow-up] Scheduled 15-min SMS to ${callerNumber} for missed appointment (${lang})`);
                }
              }

              // Clean up
              calls.delete(cid);
              pendingHangups.delete(cid);
            }

            return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }

        // SMS — Telnyx Messaging
// ── Voice Incoming API (TwiML webhook) ─────────────────────
        if (pathname === "/api/voice/incoming" && req.method === "POST") {
          try {
            const body = await req.text();
            const params = new URLSearchParams(body);
            const callSid = params.get("CallSid") || "unknown";
            const from = params.get("From") || "unknown";
            const to = params.get("To") || "unknown";
            console.log(`[Voice Incoming] CallSid: ${callSid}, From: ${from}, To: ${to}`);

            // Look up org by phone number for dynamic greeting
            let companyName = "ReceptionAI";
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl) {
              try {
                const sql = neon(dbUrl);
                const orgRow = await sql`
                  SELECT o.name FROM organizations o
                  JOIN phone_numbers pn ON pn.organization_id = o.id
                  WHERE pn.phone_number = ${to} AND pn.is_active = true LIMIT 1
                `;
                if (orgRow[0]) companyName = orgRow[0].name;
              } catch {}
            }

            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" timeout="10" action="/api/voice/incoming/gather">
    <Say voice="Polly.Joanna-Neural">Hello! Welcome to ${companyName}. Press 1 to book an appointment, press 2 for business hours, or press 0 to leave a message.</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Sorry, we did not receive your selection. Goodbye!</Say>
</Response>`;

            return new Response(twiml, {
              status: 200,
              headers: { "Content-Type": "text/xml" },
            });
          } catch (err) {
            console.error("[Voice Incoming]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Voice webhook error" }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        if (pathname === "/api/telnyx/sms" && req.method === "POST") {
          try {
            const p = await req.json();
            const from = p.data?.payload?.from?.phone_number || "";
            const to = p.data?.payload?.to?.[0]?.phone_number || "";
            const text = p.data?.payload?.text || "";

            console.log(`[Telnyx SMS] From: ${from}, Text: "${text.slice(0, 80)}"`);

            const ai = await aiRespond(
              `You are an AI receptionist. A caller sent this SMS: "${text}". Your number is ${to}. Reply helpfully in 1-2 sentences.`
            );
            const reply = ai || "Thanks for reaching out! A team member will reply shortly.";

            // Send reply via Telnyx Messaging API
            await fetch(`${TELNYX}/messages`, {
              method: "POST", headers: th(),
              body: JSON.stringify({
                from: to,
                to: from,
                text: reply,
                ...(TELNYX_CONNECTION_ID ? { messaging_profile_id: TELNYX_CONNECTION_ID } : {}),
              }),
            });

            return new Response(JSON.stringify({ status: "replied" }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            return new Response(JSON.stringify({ status: "error" }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── BYON: Bring Your Own Number ─────────────────────────
        if (pathname === "/api/phone-numbers/bring-your-own" && req.method === "POST") {
          try {
            const body = await req.json() as {
              phoneNumber?: string;
              organizationId?: string;
              label?: string;
            };
            const { phoneNumber, organizationId, label } = body;

            if (!phoneNumber || !organizationId) {
              return new Response(JSON.stringify({ error: "phoneNumber and organizationId required" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Verify the number exists in Telnyx
            const tnData = await lookupNumber(phoneNumber);
            if (!tnData) {
              return new Response(JSON.stringify({ error: "Phone number not found in Telnyx account" }),
                { status: 404, headers: { "Content-Type": "application/json" } });
            }

            // Store in database
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl) {
              const sql = neon(dbUrl);
              await sql`
                INSERT INTO phone_numbers (id, organization_id, phone_number, label, provider, telnyx_number_id, is_active, capabilities)
                VALUES (gen_random_uuid(), ${organizationId}, ${phoneNumber}, ${label || 'BYON'}, 'telnyx', ${tnData.id || null}, true, '{"voice":true,"sms":true,"mms":false}'::jsonb)
              `;
            } else {
              console.log(`[BYON] No DATABASE_URL — would store: ${phoneNumber} → org ${organizationId}`);
            }

            // Configure Telnyx webhook for this number
            if (TELNYX_CONNECTION_ID) {
              const webhookUrl = `https://${req.headers.get("host") || "localhost:3000"}/api/telnyx/voice`;
              await fetch(`${TELNYX}/phone_numbers/${tnData.id}/voice`, {
                method: "PATCH", headers: th(),
                body: JSON.stringify({
                  connection_id: TELNYX_CONNECTION_ID,
                  webhook_url: webhookUrl,
                }),
              });
            }

            return new Response(JSON.stringify({
              success: true,
              phoneNumber,
              telnyxNumberId: tnData.id,
              message: "Phone number registered. Voice and SMS webhooks configured.",
            }), { status: 201, headers: { "Content-Type": "application/json" } });

          } catch (err) {
            console.error("[BYON] Error:", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Failed to register phone number" }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── Schedule API ──────────────────────────────────────────────
        if (pathname === "/api/schedule" && req.method === "GET") {
          try {
            // JWT auth
            const authHeader = req.headers.get("Authorization") || "";
            const t = authHeader.replace("Bearer ", "");
            if (!t) {
              return new Response(JSON.stringify({ error: "Authentication required" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }
            const { jwtVerify } = await import("jose");
            const secKey = process.env.JWT_SECRET!;
            let payload: any;
            try {
              const r = await jwtVerify(t, new TextEncoder().encode(secKey));
              payload = r.payload;
            } catch {
              return new Response(JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }
            const organizationId = payload.organizationId as string;
            if (!organizationId) {
              return new Response(JSON.stringify({ error: "No organization" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return new Response(JSON.stringify({ error: "DB not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }

            const sql = neon(dbUrl);
            const url = new URL(req.url);
            const monthParam = url.searchParams.get("month") || "";

            // Parse month or default to current
            let year: number;
            let month: number;
            if (/^\d{4}-\d{2}$/.test(monthParam)) {
              [year, month] = monthParam.split("-").map(Number);
            } else {
              const now = new Date();
              year = now.getFullYear();
              month = now.getMonth() + 1;
            }

            // Calculate month boundaries
            const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
            const endDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

            const rows = await sql`
              SELECT
                a.id, a.title, a.start_time, a.end_time, a.status, a.service_type, a.notes,
                COALESCE(NULLIF(TRIM(CONCAT(c.first_name, ' ', c.last_name)), ''), c.phone, 'Unknown') as customer_name, c.phone as customer_phone, c.email as customer_email
              FROM appointments a
              LEFT JOIN contacts c ON a.contact_id = c.id
              WHERE a.organization_id = ${organizationId}
                AND DATE(a.start_time) >= ${startDate}::date
                AND DATE(a.start_time) <= ${endDate}::date
                AND a.status IN ('confirmed', 'scheduled', 'completed')
              ORDER BY a.start_time ASC
            `;

            const appointments = (rows as any[]).map((r: any) => ({
              id: r.id,
              title: r.title,
              date: new Date(r.start_time).toISOString().split("T")[0],
              time: new Date(r.start_time).toISOString().split("T")[1].substring(0, 5),
              endTime: r.end_time ? new Date(r.end_time).toISOString().split("T")[1].substring(0, 5) : null,
              status: r.status,
              service: r.service_type,
              customerName: r.customer_name,
              customerPhone: r.customer_phone,
              customerEmail: r.customer_email,
            }));

            // Build day-by-day map
            const byDay: Record<string, typeof appointments> = {};
            for (const a of appointments) {
              byDay[a.date] = byDay[a.date] || [];
              byDay[a.date].push(a);
            }

            // Count upcoming
            const upcomingRow = await sql`
              SELECT COUNT(*) as count FROM appointments
              WHERE organization_id = ${organizationId}
                AND start_time >= NOW()
                AND status IN ('confirmed', 'scheduled')
            `;

            return new Response(JSON.stringify({
              year, month,
              monthLabel: new Date(year, month - 1).toLocaleString("en", { month: "long", year: "numeric" }),
              appointments, byDay,
              totalInMonth: appointments.length,
              totalUpcoming: Number(upcomingRow[0]?.count || 0),
            }), { status: 200, headers: { "Content-Type": "application/json" } });

          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("[Schedule API]", errMsg);
            return new Response(JSON.stringify({ error: "Failed to load schedule", detail: errMsg }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }
        // ── Test Call API ────────────────────────────────────────────
        if (pathname === "/api/test-call" && req.method === "POST") {
          try {
            // JWT auth
            const authHeader = req.headers.get("Authorization") || "";
            const t = authHeader.replace("Bearer ", "");
            if (!t) {
              return new Response(JSON.stringify({ error: "Authentication required" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }
            const { jwtVerify } = await import("jose");
            const secKey = process.env.JWT_SECRET!;
            let payload: any;
            try {
              const r = await jwtVerify(t, new TextEncoder().encode(secKey));
              payload = r.payload;
            } catch {
              return new Response(JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }
            const organizationId = payload.organizationId as string;

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return new Response(JSON.stringify({ error: "DB not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }
            const sql = neon(dbUrl);

            const telnyxApiKey = process.env.TELNYX_API_KEY;
            if (!telnyxApiKey) {
              return new Response(JSON.stringify({ success: false, error: "Telnyx not configured on server" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }

            // Get org phone number
            const phoneRow = await sql`
              SELECT phone_number, telnyx_number_id, voice_enabled
              FROM phone_numbers WHERE organization_id = ${organizationId} AND is_active = true
              ORDER BY created_at DESC LIMIT 1
            `;
            if (!phoneRow[0]) {
              return new Response(JSON.stringify({
                success: false, error: "No phone number found",
                tip: "Your organization doesn't have a phone number yet. Please provision one first.",
              }), { status: 400, headers: { "Content-Type": "application/json" } });
            }
            const orgPhone = phoneRow[0].phone_number;

            // Get owner phone to call — organizations.phone, via the shared resolver.
            // (The users table has no phone column, so the old query here always
            // threw and the test call silently rang the org's own number instead.)
            const ownerPhone = await getOwnerPhone(organizationId);
            const toNumber = ownerPhone || orgPhone;

            const proto = req.headers.get("x-forwarded-proto") || "https";
            const host = req.headers.get("host") || "localhost:3000";
            const baseUrl = proto + "://" + host;
            const connectionId = process.env.TELNYX_CONNECTION_ID;
            if (!connectionId) {
              return new Response(JSON.stringify({ success: false, error: "TELNYX_CONNECTION_ID not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }

            const telRes = await fetch("https://api.telnyx.com/v2/calls", {
              method: "POST",
              headers: { Authorization: `Bearer ${telnyxApiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                connection_id: connectionId, to: toNumber, from: orgPhone,
                webhook_url: `${baseUrl}/api/telnyx/voice`, caller_id_name: "ReceptionAI Test",
              }),
            });
            const telnyxResponse = (await telRes.json()) as any;
            if (!telRes.ok) {
              const errMsg = telnyxResponse?.errors?.[0]?.detail || "Telnyx API error";
              return new Response(JSON.stringify({ success: false, error: errMsg, telnyxResponse }),
                { status: 502, headers: { "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify({
              success: true,
              message: `Test call initiated to ${toNumber} from ${orgPhone}`,
              callControlId: telnyxResponse.data?.call_control_id,
              callLegId: telnyxResponse.data?.call_leg_id,
            }), { status: 200, headers: { "Content-Type": "application/json" } });

          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("[Test Call]", errMsg);
            return new Response(JSON.stringify({ success: false, error: errMsg }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

// ── Health API (public, no auth) ────────────────────────────
        if (pathname === "/api/health" && req.method === "GET") {
          try {
            const dbUrl = process.env.DATABASE_URL;
            const serverStatus: any = { status: "ok", timestamp: new Date().toISOString() };

            if (!dbUrl) {
              serverStatus.database = "not configured";
            } else {
              try {
                const sql = neon(dbUrl);
                const dbCheck = await sql`SELECT 1 as ok`;
                serverStatus.database = "connected";
              } catch { serverStatus.database = "error"; }
            }

            serverStatus.telnyx = process.env.TELNYX_API_KEY ? "configured" : "not configured";
            serverStatus.stripe = process.env.STRIPE_SECRET_KEY ? "configured" : "not configured";
            serverStatus.cronSecret = process.env.CRON_SECRET ? "set" : "not set";

            return new Response(JSON.stringify(serverStatus),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("[Health API]", errMsg);
            return new Response(JSON.stringify({ error: "Health check failed", detail: errMsg }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }




        // ── Conversations API ────────────────────────────────────────
        if (pathname === "/api/conversations" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const url = new URL(req.url);
            const limit = parseInt(url.searchParams.get("limit") || "20", 10);
            const offset = parseInt(url.searchParams.get("offset") || "0", 10);
            const rows = await sql`
              SELECT c.id, c.organization_id, c.contact_id, c.type, c.status, c.direction,
                     c.started_at, c.ended_at, c.ai_handled, c.escalated_to_human, c.subject,
                     c.created_at,
                     co.first_name, co.last_name, co.phone as contact_phone, co.email as contact_email
              FROM conversations c
              LEFT JOIN contacts co ON c.contact_id = co.id
              WHERE c.organization_id = ${organizationId}
              ORDER BY c.started_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `;
            const conversations = (rows as any[]).map((r: any) => {
              const first = r.first_name || "";
              const last = r.last_name || "";
              const customerName = (first + " " + last).trim() || r.contact_phone || "Unknown";
              const startedAt = r.started_at ? new Date(r.started_at).toISOString() : null;
              const durationSec = r.started_at && r.ended_at
                ? Math.max(0, Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 1000))
                : null;
              const duration = durationSec === null
                ? null
                : durationSec >= 60
                  ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
                  : `${durationSec}s`;
              return {
                id: r.id,
                organizationId: r.organization_id,
                customerName,
                customerPhone: r.contact_phone || null,
                customerEmail: r.contact_email || null,
                channel: r.type || "call",
                status: r.status || "completed",
                direction: r.direction || "inbound",
                summary: r.subject || null,
                duration,
                timestamp: startedAt,
                createdAt: r.created_at ? new Date(r.created_at).toISOString() : startedAt,
                startedAt,
                aiHandled: r.ai_handled,
                escalatedToHuman: r.escalated_to_human,
              };
            });
            const totalRows = await sql`SELECT COUNT(*) as count FROM conversations WHERE organization_id = ${organizationId}`;
            return json({
              conversations,
              total: Number(totalRows[0]?.count || 0),
              limit, offset,
            });
          } catch (err) {
            console.error("[Conversations API]", String(err).slice(0, 200));
            return json({ error: "Failed to fetch conversations" }, 500);
          }
        }
        // ── Missed calls (real rows written by the turn pipeline when a call ends unengaged) ──
        // GET /api/missed-calls — list for the authenticated org.
        // Keep in sync with src/routes/api/missed-calls.ts and the other serve.ts tree.
        if (pathname === "/api/missed-calls" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const url = new URL(req.url);
            const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 500);
            const rows = await sql`
              SELECT id, caller_number, caller_name, ring_duration_seconds, callback_requested,
                     callback_status, voicemail_url, voicemail_transcription, created_at
              FROM missed_calls
              WHERE organization_id = ${organizationId}
              ORDER BY created_at DESC
              LIMIT ${limit}
            `;
            const missedCalls = (rows as any[]).map((r: any) => ({
              id: r.id,
              callerNumber: r.caller_number || null,
              callerName: r.caller_name || null,
              ringDurationSeconds:
                r.ring_duration_seconds === null || r.ring_duration_seconds === undefined
                  ? null
                  : Number(r.ring_duration_seconds),
              callbackRequested: r.callback_requested === true,
              callbackStatus: r.callback_status || "pending",
              voicemailUrl: r.voicemail_url || null,
              voicemailTranscription: r.voicemail_transcription || null,
              createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
            }));
            return json({ missedCalls, total: missedCalls.length, limit });
          } catch (err) {
            console.error("[Missed Calls API]", String(err).slice(0, 200));
            return json({ error: "Failed to fetch missed calls" }, 500);
          }
        }
        // PATCH /api/missed-calls — set callback status for one row (org-scoped).
        if (pathname === "/api/missed-calls" && req.method === "PATCH") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const body: any = await req.json().catch(() => null);
            const id = typeof body?.id === "string" ? body.id : "";
            const callbackStatus = body?.callbackStatus;
            const allowed = ["pending", "contacted", "resolved", "declined"];
            if (!id || !allowed.includes(callbackStatus)) {
              return json({ error: "id and callbackStatus are required" }, 400);
            }
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const updated: any = await sql`
              UPDATE missed_calls SET callback_status = ${callbackStatus}::callback_status
              WHERE id = ${id} AND organization_id = ${auth.organizationId}
              RETURNING id, callback_status
            `;
            if (!updated.length) return json({ error: "Missed call not found" }, 404);
            return json({ id: updated[0].id, callbackStatus: updated[0].callback_status });
          } catch (err) {
            console.error("[Missed Calls API]", String(err).slice(0, 200));
            return json({ error: "Failed to update missed call" }, 500);
          }
        }
        // ── Analytics (real counts only — no demo arrays, no estimates) ──
        // GET /api/analytics?days=7|30|90 — org-scoped aggregates over the rows this business
        // actually has: conversations (type='call'), missed_calls and appointments. Every number
        // is a COUNT over real rows; anything the schema cannot answer is simply not returned.
        // Keep in sync with src/routes/api/analytics.ts and the other serve.ts tree.
        if (pathname === "/api/analytics" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const url = new URL(req.url);
            const requestedDays = parseInt(url.searchParams.get("days") || "7", 10);
            const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 7;
            const now = new Date();
            const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
            const to = now.toISOString();

            // $1 = org timezone, $2 = organization id, $3 = from, $4 = to, $5 = days (all bound, never interpolated)
            const CALL_AGG_SQL = `
              WITH day_series AS (
                -- Exactly N buckets ending today, in the organization's timezone.
                SELECT generate_series(
                  (($4::timestamptz - interval '1 second') AT TIME ZONE $1::text)::date - ($5::int - 1),
                  (($4::timestamptz - interval '1 second') AT TIME ZONE $1::text)::date,
                  interval '1 day'
                )::date AS day
              ),
              call_rows AS (
                SELECT status::text AS status,
                       COALESCE(metadata->>'outcome', '') AS outcome,
                       COALESCE(metadata->>'language', '') AS language,
                       (started_at AT TIME ZONE $1::text)::date AS day,
                       EXTRACT(hour FROM (started_at AT TIME ZONE $1::text))::int AS hour
                FROM conversations
                WHERE organization_id = $2
                  AND type = 'call'
                  AND started_at >= $3::timestamptz
                  AND started_at < $4::timestamptz
              )
              SELECT
                (SELECT count(*)::int FROM call_rows) AS total,
                (SELECT count(*)::int FROM call_rows WHERE status <> 'missed') AS answered,
                (SELECT count(*)::int FROM call_rows WHERE status = 'missed') AS missed,
                (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
                   SELECT status, count(*)::int AS count
                   FROM call_rows GROUP BY status ORDER BY count(*) DESC, status
                 ) x) AS statuses,
                (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
                   SELECT outcome, count(*)::int AS count
                   FROM call_rows WHERE outcome <> '' GROUP BY outcome ORDER BY count(*) DESC, outcome
                 ) x) AS outcomes,
                (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
                   SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
                          count(c.status)::int AS calls,
                          count(c.status) FILTER (WHERE c.status <> 'missed')::int AS answered,
                          count(c.status) FILTER (WHERE c.status = 'missed')::int AS missed
                   FROM day_series d
                   LEFT JOIN call_rows c ON c.day = d.day
                   GROUP BY d.day ORDER BY d.day
                 ) x) AS by_day,
                (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
                   SELECT h.hour, count(c.status)::int AS count
                   FROM generate_series(0, 23) AS h(hour)
                   LEFT JOIN call_rows c ON c.hour = h.hour
                   GROUP BY h.hour ORDER BY h.hour
                 ) x) AS by_hour,
                (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
                   SELECT language, count(*)::int AS count
                   FROM call_rows WHERE language <> '' GROUP BY language ORDER BY count(*) DESC, language
                 ) x) AS languages
            `;

            const tzRows: any[] = await sql.query(
              `SELECT timezone FROM organizations WHERE id = $1`,
              [organizationId]
            );
            let timezone = String(tzRows?.[0]?.timezone || "UTC");
            try {
              new Intl.DateTimeFormat("en-US", { timeZone: timezone });
            } catch {
              timezone = "UTC";
            }

            const callRows: any[] = await sql.query(CALL_AGG_SQL, [timezone, organizationId, from, to, days]);
            const channelRows: any[] = await sql.query(
              `SELECT type::text AS channel, count(*)::int AS count
               FROM conversations
               WHERE organization_id = $1 AND started_at >= $2::timestamptz AND started_at < $3::timestamptz
               GROUP BY type ORDER BY count(*) DESC, type`,
              [organizationId, from, to]
            );
            const missedRows: any[] = await sql.query(
              `SELECT count(*)::int AS total,
                      count(*) FILTER (WHERE callback_requested)::int AS callback_requested,
                      count(*) FILTER (WHERE callback_status IN ('contacted', 'resolved'))::int AS called_back
               FROM missed_calls
               WHERE organization_id = $1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
              [organizationId, from, to]
            );
            const appointmentRows: any[] = await sql.query(
              `SELECT status::text AS status, count(*)::int AS count,
                      count(*) FILTER (WHERE conversation_id IS NOT NULL)::int AS from_calls
               FROM appointments
               WHERE organization_id = $1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz
               GROUP BY status ORDER BY count(*) DESC, status`,
              [organizationId, from, to]
            );
            const upcomingRows: any[] = await sql.query(
              `SELECT count(*)::int AS upcoming
               FROM appointments
               WHERE organization_id = $1 AND status IN ('scheduled', 'confirmed') AND start_time >= now()`,
              [organizationId]
            );

            const asArr = (v: any): any[] => {
              if (Array.isArray(v)) return v;
              if (typeof v === "string") {
                try {
                  const p = JSON.parse(v);
                  return Array.isArray(p) ? p : [];
                } catch {
                  return [];
                }
              }
              return [];
            };
            const n = (v: any): number => {
              const x = Number(v);
              return Number.isFinite(x) ? x : 0;
            };

            const c: any = callRows?.[0] || {};
            const total = n(c.total);
            const answered = n(c.answered);
            const apptRows: any[] = appointmentRows || [];
            const apptTotal = apptRows.reduce((s: number, r: any) => s + n(r.count), 0);
            const apptFromCalls = apptRows.reduce((s: number, r: any) => s + n(r.from_calls), 0);

            const statuses = asArr(c.statuses).map((r: any) => ({ status: String(r.status), count: n(r.count) }));
            const outcomes = asArr(c.outcomes).map((r: any) => ({ outcome: String(r.outcome), count: n(r.count) }));
            const callsByDay = asArr(c.by_day).map((r: any) => ({
              date: String(r.date),
              calls: n(r.calls),
              answered: n(r.answered),
              missed: n(r.missed),
            }));
            const channels = (channelRows || []).map((r: any) => ({ channel: String(r.channel), count: n(r.count) }));

            return json({
              range: { days, from, to, timezone },
              calls: {
                total,
                answered,
                missed: n(c.missed),
                answerRate: total > 0 ? Math.round((answered / total) * 100) : null,
              },
              statuses,
              outcomes,
              callsByDay,
              callsByHour: asArr(c.by_hour).map((r: any) => ({ hour: n(r.hour), count: n(r.count) })),
              channels,
              languages: asArr(c.languages).map((r: any) => ({ language: String(r.language), count: n(r.count) })),
              missedCalls: {
                total: n(missedRows?.[0]?.total),
                callbackRequested: n(missedRows?.[0]?.callback_requested),
                calledBack: n(missedRows?.[0]?.called_back),
              },
              appointments: {
                total: apptTotal,
                byStatus: apptRows.map((r: any) => ({ status: String(r.status), count: n(r.count) })),
                fromCalls: apptFromCalls,
                upcoming: n(upcomingRows?.[0]?.upcoming),
              },
              hasData: total > 0 || n(missedRows?.[0]?.total) > 0 || apptTotal > 0 || channels.length > 0,
            });
          } catch (err) {
            console.error("[Analytics API]", String(err).slice(0, 200));
            return json({ error: "Failed to load analytics" }, 500);
          }
        }

        // ── Team (real user accounts; there is no invented member list) ──
        // GET /api/users — list team members for the authenticated org.
        // Keep in sync with src/routes/api/users.ts and the other serve.ts tree.
        if (pathname === "/api/users" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const rows = await sql`
              SELECT id, name, email, role, avatar_url, is_active, last_login_at, created_at
              FROM users
              WHERE organization_id = ${organizationId}
              ORDER BY created_at DESC
            `;
            const users = (rows as any[]).map((r: any) => ({
              id: r.id,
              name: r.name || null,
              email: r.email || null,
              role: r.role || null,
              avatarUrl: r.avatar_url || null,
              isActive: r.is_active === "1" || r.is_active === true,
              lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
              createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
            }));
            return json({ users, total: users.length });
          } catch (err) {
            console.error("[Users API]", String(err).slice(0, 200));
            return json({ error: "Failed to fetch team members" }, 500);
          }
        }
        // ── Recording playback ────────────────────────────────────────────────
        // GET /api/recordings/audio?id=…&exp=…&sig=… — turns a stored voicemail into a playable
        // url. The webhook recording URL Telnyx sends expires, so the durable handle is the
        // recording id (recordings.twilio_recording_sid): it is exchanged for a fresh download
        // URL each time the owner presses play. If Telnyx cannot be asked, the URL delivered at
        // call time is used as-is. Keep in sync with src/routes/api/recordings.ts and the other
        // serve.ts tree.
        if (pathname === "/api/recordings/audio" && req.method === "GET") {
          try {
            const url = new URL(req.url);
            const recordingId = url.searchParams.get("id") || "";
            const exp = parseInt(url.searchParams.get("exp") || "0", 10) || 0;
            const sig = url.searchParams.get("sig") || "";
            if (!recordingId || !exp || !sig) return json({ error: "id, exp and sig are required" }, 400);
            if (Math.floor(Date.now() / 1000) > exp) {
              return json({ error: "This recording link expired — reload the Recordings page." }, 410);
            }
            if (!verifyRecordingAudioSig(recordingId, exp, sig)) {
              return json({ error: "Invalid recording link" }, 403);
            }
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const rows = await sql`
              SELECT id, recording_url, twilio_recording_sid
              FROM recordings WHERE id = ${recordingId} LIMIT 1
            `;
            const rec = rows[0] as any;
            if (!rec) return json({ error: "Recording not found" }, 404);
            let target: string | null = null;
            if (rec.twilio_recording_sid && process.env.TELNYX_API_KEY) {
              try {
                const res = await fetch(
                  `${TELNYX}/recordings/${encodeURIComponent(rec.twilio_recording_sid)}`,
                  { headers: th() }
                );
                if (res.ok) {
                  const body = await res.json() as any;
                  const urls = body?.data?.download_urls || {};
                  target = urls.mp3 || urls.wav || null;
                } else {
                  console.warn(`[Recordings] Telnyx download-url lookup failed (${res.status})`);
                }
              } catch (err) {
                console.warn("[Recordings] Telnyx download-url lookup error:", String(err).slice(0, 120));
              }
            }
            if (!target) target = rec.recording_url || null;
            if (!target) return json({ error: "No audio is stored for this recording." }, 404);
            // Redirect rather than proxy: the browser streams straight from Telnyx.
            return new Response(null, {
              status: 302,
              headers: { Location: target, "Cache-Control": "no-store" },
            });
          } catch (err) {
            console.error("[Recordings audio]", String(err).slice(0, 200));
            return json({ error: "Failed to resolve recording audio" }, 500);
          }
        }
        // ── Recordings (voicemail audio is stored against the answer-time conversation) ──
        // GET /api/recordings — list call recordings for the authenticated org.
        // Keep in sync with src/routes/api/recordings.ts and the other serve.ts tree.
        if (pathname === "/api/recordings" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const url = new URL(req.url);
            const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 500);
            const rows = await sql`
              SELECT r.id, r.conversation_id, r.recording_url, r.duration_seconds,
                     r.transcription_text, r.transcription_status, r.created_at,
                     r.twilio_recording_sid,
                     c.first_name AS contact_first_name, c.last_name AS contact_last_name,
                     c.phone AS contact_phone
              FROM recordings r
              LEFT JOIN conversations cv ON cv.id = r.conversation_id
              LEFT JOIN contacts c ON c.id = cv.contact_id
              WHERE r.organization_id = ${organizationId}
              ORDER BY r.created_at DESC
              LIMIT ${limit}
            `;
            const recordings = (rows as any[]).map((r: any) => {
              const name = [r.contact_first_name, r.contact_last_name].filter(Boolean).join(" ").trim();
              return {
                id: r.id,
                conversationId: r.conversation_id || null,
                callerName: name || null,
                callerNumber: r.contact_phone || null,
                // Playable only when audio is really stored. The link is our own signed
                // endpoint (see /api/recordings/audio): the raw Telnyx URL expires.
                recordingUrl: r.twilio_recording_sid || r.recording_url ? recordingAudioPath(r.id) : null,
                audioAvailable: !!(r.twilio_recording_sid || r.recording_url),
                durationSeconds:
                  r.duration_seconds === null || r.duration_seconds === undefined
                    ? null
                    : Number(r.duration_seconds),
                transcriptionText: r.transcription_text || null,
                transcriptionStatus: r.transcription_status || null,
                createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
              };
            });
            return json({ recordings, total: recordings.length, limit });
          } catch (err) {
            console.error("[Recordings API]", String(err).slice(0, 200));
            return json({ error: "Failed to fetch recordings" }, 500);
          }
        }
        // ── Follow-up campaigns (the engine is not built yet — no invented stats) ──
        // GET /api/follow-up-campaigns — list campaigns for the authenticated org.
        // Keep in sync with src/routes/api/follow-up-campaigns.ts and the other serve.ts tree.
        if (pathname === "/api/follow-up-campaigns" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const rows = await sql`
              SELECT id, name, description, trigger_event, delay_minutes, max_attempts,
                     interval_minutes, channels, language, is_active, created_at
              FROM follow_up_campaigns
              WHERE organization_id = ${organizationId}
              ORDER BY created_at DESC
            `;
            const campaigns = (rows as any[]).map((r: any) => ({
              id: r.id,
              name: r.name || null,
              description: r.description || null,
              triggerEvent: r.trigger_event || null,
              delayMinutes:
                r.delay_minutes === null || r.delay_minutes === undefined ? null : Number(r.delay_minutes),
              maxAttempts:
                r.max_attempts === null || r.max_attempts === undefined ? null : Number(r.max_attempts),
              intervalMinutes:
                r.interval_minutes === null || r.interval_minutes === undefined
                  ? null
                  : Number(r.interval_minutes),
              channels: Array.isArray(r.channels)
                ? r.channels.filter((c: unknown) => typeof c === "string")
                : [],
              language: r.language || null,
              isActive: r.is_active === true,
              createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
            }));
            return json({ campaigns, total: campaigns.length });
          } catch (err) {
            console.error("[Follow-Up Campaigns API]", String(err).slice(0, 200));
            return json({ error: "Failed to fetch campaigns" }, 500);
          }
        }
        if (pathname === "/api/conversations" && req.method === "POST") {
          try {
            const authHeader = req.headers.get("Authorization") || "";
            const t = authHeader.replace("Bearer ", "");
            if (!t) {
              return new Response(JSON.stringify({ error: "Authentication required" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }
            const { jwtVerify } = await import("jose");
            const secKey = process.env.JWT_SECRET!;
            let payload: any;
            try { const r = await jwtVerify(t, new TextEncoder().encode(secKey)); payload = r.payload; }
            catch { return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { "Content-Type": "application/json" } }); }
            const organizationId = payload.organizationId as string;

            const body = await req.json() as { conversationId?: string; message?: string; humanName?: string };
            const { conversationId, message, humanName } = body;
            if (!conversationId || !message) {
              return new Response(JSON.stringify({ error: "conversationId and message are required" }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return new Response(JSON.stringify({ error: "DB not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
            const sql = neon(dbUrl);

            // Verify conversation belongs to org
            const conv = await sql`SELECT id FROM conversations WHERE id = ${conversationId} AND organization_id = ${organizationId} LIMIT 1`;
            if (!conv[0]) {
              return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
            }

            // Insert human reply
            await sql`
              INSERT INTO messages (id, conversation_id, organization_id, role, content, content_type)
              VALUES (${crypto.randomUUID()}, ${conversationId}, ${organizationId}, 'agent',
                      ${`[Human agent${humanName ? ` ${humanName}` : ""}]: ${message}`}, 'text')
            `;

            return new Response(JSON.stringify({ success: true, conversationId }), { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Conversations POST]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Failed to process message" }), { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── Appointments API ──────────────────────────────────────────
        if (pathname === "/api/appointments" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const url = new URL(req.url);
            const status = url.searchParams.get("status") || "";
            const start = url.searchParams.get("start") || "";
            const end = url.searchParams.get("end") || "";
            const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 500);
            // Build the WHERE clause conditionally so empty-string filters are
            // never cast (''::timestamptz throws NeonDbError). Values stay bound.
            const conditions: string[] = ["a.organization_id = $1"];
            const params: any[] = [organizationId];
            if (status) { params.push(status); conditions.push(`a.status::text = $${params.length}`); }
            if (start) { params.push(start); conditions.push(`a.start_time >= $${params.length}::timestamptz`); }
            if (end) { params.push(end); conditions.push(`a.start_time <= $${params.length}::timestamptz`); }
            const rows = await sql.query(
              `SELECT a.id, a.organization_id, a.contact_id, a.title, a.description,
                      a.start_time, a.end_time, a.status, a.service_type, a.staff_assigned_id,
                      a.location, a.notes, a.created_at, a.updated_at,
                      co.first_name, co.last_name, co.phone as contact_phone, co.email as contact_email
               FROM appointments a
               LEFT JOIN contacts co ON a.contact_id = co.id
               WHERE ${conditions.join(" AND ")}
               ORDER BY a.start_time DESC
               LIMIT $${params.length + 1}`,
              [...params, limit]
            );
            const appointments = (rows as any[]).map((r: any) => ({
              id: r.id,
              organizationId: r.organization_id,
              contactId: r.contact_id,
              title: r.title,
              description: r.description,
              startTime: r.start_time ? new Date(r.start_time).toISOString() : null,
              endTime: r.end_time ? new Date(r.end_time).toISOString() : null,
              status: r.status,
              serviceType: r.service_type,
              staffAssignedId: r.staff_assigned_id,
              location: r.location,
              notes: r.notes,
              customerName: [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || null,
              customerPhone: r.contact_phone || null,
              customerEmail: r.contact_email || null,
              createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
              updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
            }));
            const total = await sql`SELECT COUNT(*) as count FROM appointments WHERE organization_id = ${organizationId}`;
            return json({ appointments, total: Number(total[0]?.count || 0), limit });
          } catch (err) {
            console.error("[Appointments API]", String(err).slice(0, 200));
            return json({ error: "Failed to fetch appointments" }, 500);
          }
        }
        // ── Settings API ─────────────────────────────────────────────
        if (pathname === "/api/settings" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const orgRows = await sql`SELECT * FROM organizations WHERE id = ${organizationId} LIMIT 1`;
            const org = orgRows[0] || null;
            const hours = await sql`SELECT * FROM business_hours WHERE organization_id = ${organizationId} ORDER BY day_of_week::int ASC`;
            const settingsRows = await sql`SELECT key, value FROM organization_settings WHERE organization_id = ${organizationId}`;
            const settings: Record<string, unknown> = {};
            for (const s of settingsRows as any[]) settings[s.key] = s.value;
            return json({
              organization: org ? {
                id: org.id, name: org.name, slug: org.slug, timezone: org.timezone,
                locale: org.locale, industry: org.industry, email: org.email, phone: org.phone,
                website: org.website, addressLine1: org.address_line1, city: org.city,
                state: org.state, postalCode: org.postal_code, transferNumber: org.transfer_number,
              } : null,
              businessHours: (hours as any[]).map((h: any) => ({
                dayOfWeek: h.day_of_week, openTime: h.open_time, closeTime: h.close_time, isClosed: h.is_closed,
              })),
              settings,
            });
          } catch (err) {
            console.error("[Settings API]", String(err).slice(0, 200));
            return json({ error: "Failed to fetch settings" }, 500);
          }
        }
        if (pathname === "/api/settings" && req.method === "PUT") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            const body = (await req.json().catch(() => ({}))) as Record<string, any>;
            // Org fields
            if (typeof body.name === "string") await sql`UPDATE organizations SET name = ${body.name}, updated_at = NOW() WHERE id = ${organizationId}`;
            if (typeof body.industry === "string") await sql`UPDATE organizations SET industry = ${body.industry}, updated_at = NOW() WHERE id = ${organizationId}`;
            if (typeof body.timezone === "string") await sql`UPDATE organizations SET timezone = ${body.timezone}, updated_at = NOW() WHERE id = ${organizationId}`;
            if (typeof body.locale === "string") await sql`UPDATE organizations SET locale = ${body.locale}, updated_at = NOW() WHERE id = ${organizationId}`;
            if (typeof body.phone === "string") await sql`UPDATE organizations SET phone = ${body.phone}, updated_at = NOW() WHERE id = ${organizationId}`;
            if (typeof body.email === "string") await sql`UPDATE organizations SET email = ${body.email}, updated_at = NOW() WHERE id = ${organizationId}`;
            if (typeof body.website === "string") await sql`UPDATE organizations SET website = ${body.website}, updated_at = NOW() WHERE id = ${organizationId}`;
            if (typeof body.transferNumber === "string" || body.transferNumber === null) await sql`UPDATE organizations SET transfer_number = ${body.transferNumber}, updated_at = NOW() WHERE id = ${organizationId}`;
            // Business hours upsert
            if (Array.isArray(body.businessHours)) {
              for (const bh of body.businessHours) {
                const dow = String(bh?.dayOfWeek ?? "");
                if (!/^[0-6]$/.test(dow)) continue;
                const openTime = bh?.openTime || null;
                const closeTime = bh?.closeTime || null;
                const isClosed = !!bh?.isClosed;
                await sql`
                  INSERT INTO business_hours (id, organization_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at)
                  VALUES (gen_random_uuid(), ${organizationId}, ${dow}, ${openTime}, ${closeTime}, ${isClosed}, NOW(), NOW())
                  ON CONFLICT (organization_id, day_of_week)
                  DO UPDATE SET open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time, is_closed = EXCLUDED.is_closed, updated_at = NOW()
                `;
              }
            }
            // Free-form settings keys (smsSummaries, services, etc.)
            const reserved = ["name", "timezone", "locale", "email", "phone", "website", "industry", "addressLine1", "addressLine2", "city", "state", "postalCode", "businessHours", "transferNumber"];
            for (const [key, value] of Object.entries(body)) {
              if (reserved.includes(key) || value === undefined) continue;
              await sql`
                INSERT INTO organization_settings (id, organization_id, key, value, created_at, updated_at)
                VALUES (gen_random_uuid(), ${organizationId}, ${key}, ${JSON.stringify(value)}::jsonb, NOW(), NOW())
                ON CONFLICT (organization_id, key)
                DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
              `;
            }
            return json({ success: true });
          } catch (err) {
            console.error("[Settings PUT]", String(err).slice(0, 200));
            return json({ error: "Failed to update settings" }, 500);
          }
        }
        // ── Billing API ──────────────────────────────────────────────
        if (pathname === "/api/billing" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const PLANS = [
              { id: "starter", name: "Starter", priceMonthly: 99, priceAnnual: 79, includedPhoneLines: 1, includedAiMinutes: 500, includedSmsMessages: 200, stripePriceId: "price_1TxrHbP7NtNpgQde64Zp1tgM", stripePaymentLink: "https://buy.stripe.com/6oU5kD6rW2C52Fd1D3aVa02" },
              { id: "growth", name: "Growth", priceMonthly: 199, priceAnnual: 159, includedPhoneLines: 2, includedAiMinutes: 2000, includedSmsMessages: 1000, stripePriceId: "price_1TxrJCP7NtNpgQdeNBA9dxqn", stripePaymentLink: "https://buy.stripe.com/eVq14ng2w90tfrZ4PfaVa03", popular: true },
              { id: "scale", name: "Scale", priceMonthly: 399, priceAnnual: 319, includedPhoneLines: 5, includedAiMinutes: 10000, includedSmsMessages: 5000, stripePriceId: "price_1TxrKSP7NtNpgQdeh8Jh1P2Z", stripePaymentLink: "https://buy.stripe.com/14AaEX03ygsVbbJchHaVa04" },
            ];
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return json({ subscription: null, usage: { aiMinutesUsed: 0, aiMinutesLimit: 500, aiMinutesPercent: 0, smsUsed: 0, smsLimit: 200, smsPercent: 0, phoneLinesUsed: 1, phoneLinesLimit: 1, phoneLinesPercent: 100 }, plans: PLANS, invoices: [], stripeCustomerPortalUrl: null });
            }
            const sql = neon(dbUrl);
            const subRows = await sql`
              SELECT s.id, s.status, s.billing_cycle, s.stripe_customer_id,
                     s.current_period_start, s.current_period_end, s.trial_ends_at, s.cancel_at_period_end,
                     p.name as plan_id, p.display_name as plan_name, p.price_monthly_cents,
                     p.included_ai_minutes, p.included_phone_lines, p.included_sms_messages
              FROM subscriptions s
              LEFT JOIN subscription_plans p ON s.plan_id = p.id
              WHERE s.organization_id = ${organizationId}
              ORDER BY s.created_at DESC
              LIMIT 1
            `;
            const sub = subRows[0] || null;
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const usageRows = await sql`SELECT record_type, SUM(quantity) as qty FROM usage_records WHERE organization_id = ${organizationId} AND recorded_at >= ${monthStart}::timestamptz GROUP BY record_type`;
            const usageMap: Record<string, number> = {};
            for (const u of usageRows as any[]) usageMap[u.record_type] = Number(u.qty || 0);
            const aiMinutesUsed = usageMap["ai_minutes"] || 0;
            const smsUsed = (usageMap["sms_outbound"] || 0) + (usageMap["sms_inbound"] || 0);
            const aiLimit = sub?.included_ai_minutes || 500;
            const smsLimit = sub?.included_sms_messages || 200;
            const phoneLimit = sub?.included_phone_lines || 1;
            return json({
              subscription: sub ? {
                id: sub.id, planId: sub.plan_id, planName: sub.plan_name, status: sub.status,
                billingCycle: sub.billing_cycle,
                priceMonthly: sub.price_monthly_cents ? Number(sub.price_monthly_cents) / 100 : null,
                currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start).toISOString() : null,
                currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end).toISOString() : null,
                trialEndsAt: sub.trial_ends_at ? new Date(sub.trial_ends_at).toISOString() : null,
                cancelAtPeriodEnd: sub.cancel_at_period_end,
              } : null,
              usage: {
                aiMinutesUsed, aiMinutesLimit: aiLimit, aiMinutesPercent: aiLimit ? Math.round((aiMinutesUsed / aiLimit) * 100) : 0,
                smsUsed, smsLimit, smsPercent: smsLimit ? Math.round((smsUsed / smsLimit) * 100) : 0,
                phoneLinesUsed: 1, phoneLinesLimit: phoneLimit, phoneLinesPercent: phoneLimit ? Math.round((1 / phoneLimit) * 100) : 100,
              },
              plans: PLANS,
              invoices: [],
              stripeCustomerPortalUrl: sub?.stripe_customer_id ? `https://billing.stripe.com/p/login/${sub.stripe_customer_id}` : null,
            });
          } catch (err) {
            console.error("[Billing API]", String(err).slice(0, 200));
            return json({ error: "Billing request failed" }, 500);
          }
        }
        if (pathname === "/api/billing/change-plan" && req.method === "POST") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const organizationId = auth.organizationId;
            const body = (await req.json().catch(() => ({}))) as { plan?: string };
            const plan = body.plan;
            const validPlans = ["basic", "starter", "growth", "scale"];
            if (!plan || !validPlans.includes(plan)) return json({ error: "Invalid plan" }, 400);
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl) {
              const sql = neon(dbUrl);
              await sql`
                INSERT INTO organization_settings (id, organization_id, key, value, created_at, updated_at)
                VALUES (gen_random_uuid(), ${organizationId}, 'requested_plan', ${JSON.stringify(plan)}::jsonb, NOW(), NOW())
                ON CONFLICT (organization_id, key)
                DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
              `;
            }
            return json({ success: true, message: `Plan change to ${plan} requested`, plan });
          } catch (err) {
            console.error("[Billing change-plan]", String(err).slice(0, 200));
            return json({ error: "Failed to change plan" }, 500);
          }
        }
        // ── Calendar Connect (Google OAuth) ─────────────────────────
        if (pathname === "/api/calendar/connect/google" && req.method === "GET") {
          try {
            if (!googleConfigured()) {
              return json({ error: "Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI." }, 503);
            }
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const e = googleEnv();
            const { SignJWT } = await import("jose");
            const secKey = process.env.JWT_SECRET!;
            const state = await new SignJWT({
              organizationId: auth.organizationId, userId: auth.userId, role: auth.role,
              purpose: "google_calendar_connect", nonce: crypto.randomUUID(),
            }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("15m")
              .sign(new TextEncoder().encode(secKey));
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(e.clientId)}&redirect_uri=${encodeURIComponent(e.redirectUri)}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email")}&access_type=offline&prompt=consent&include_granted_scopes=true&state=${encodeURIComponent(state)}`;
            return json({ url: authUrl });
          } catch (err) {
            console.error("[Calendar connect]", String(err).slice(0, 200));
            return json({ error: "Failed to start Google Calendar connection" }, 500);
          }
        }
        if (pathname === "/api/calendar/oauth/google/callback" && req.method === "GET") {
          const redirectTo = (qs: string) => new Response(null, { status: 302, headers: { Location: "/dashboard/settings" + qs } });
          try {
            const url = new URL(req.url);
            const code = url.searchParams.get("code") || "";
            const state = url.searchParams.get("state") || "";
            const gerr = url.searchParams.get("error") || "";
            if (gerr) return redirectTo("?calendar=error&reason=" + encodeURIComponent(gerr));
            if (!code || !state) return redirectTo("?calendar=error&reason=missing_params");
            const { jwtVerify } = await import("jose");
            const secKey = process.env.JWT_SECRET!;
            let payload: any;
            try {
              const r = await jwtVerify(state, new TextEncoder().encode(secKey));
              payload = r.payload;
            } catch {
              return redirectTo("?calendar=error&reason=invalid_state");
            }
            if (payload.purpose !== "google_calendar_connect") return redirectTo("?calendar=error&reason=invalid_state");
            const organizationId = payload.organizationId as string;
            const userId = (payload.userId as string) || "";
            if (!organizationId) return redirectTo("?calendar=error&reason=no_org");
            const tokens = await exchangeGoogleCode(code);
            if (!tokens?.access_token) return redirectTo("?calendar=error&reason=token_exchange_failed");
            const email = (await getGoogleUserEmail(tokens.access_token)) || "";
            const accessEnc = await encryptToken(tokens.access_token);
            const refreshEnc = tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null;
            const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return redirectTo("?calendar=error&reason=db_not_configured");
            const sql = neon(dbUrl);
            await sql`
              INSERT INTO calendar_integrations (id, organization_id, user_id, provider, provider_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, sync_enabled, calendar_id, calendar_name, created_at, updated_at)
              VALUES (gen_random_uuid(), ${organizationId}, ${userId}, 'google', ${email || "unknown@google.com"}, ${accessEnc}, ${refreshEnc}, ${expiresAt}, true, 'primary', 'Google Calendar', NOW(), NOW())
              ON CONFLICT (organization_id, provider, provider_email)
              DO UPDATE SET access_token_encrypted = EXCLUDED.access_token_encrypted, refresh_token_encrypted = EXCLUDED.refresh_token_encrypted, token_expires_at = EXCLUDED.token_expires_at, sync_enabled = true, user_id = EXCLUDED.user_id, updated_at = NOW()
            `;
            return redirectTo("?calendar=connected&email=" + encodeURIComponent(email || ""));
          } catch (err) {
            console.error("[Calendar callback]", String(err).slice(0, 300));
            return redirectTo("?calendar=error&reason=exception");
          }
        }
        if (pathname === "/api/calendar/disconnect" && req.method === "POST") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return json({ error: "DB not configured" }, 500);
            const sql = neon(dbUrl);
            await sql`DELETE FROM calendar_integrations WHERE organization_id = ${auth.organizationId} AND provider = 'google'`;
            return json({ success: true });
          } catch (err) {
            console.error("[Calendar disconnect]", String(err).slice(0, 200));
            return json({ error: "Failed to disconnect" }, 500);
          }
        }
        if (pathname === "/api/calendar/status" && req.method === "GET") {
          try {
            const auth = await requireOrgAuth(req);
            if (auth instanceof Response) return auth;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return json({ configured: googleConfigured(), connected: false, provider: null, email: null, syncEnabled: false });
            }
            const sql = neon(dbUrl);
            const rows = await sql`
              SELECT provider, provider_email, sync_enabled, calendar_id, calendar_name, last_synced_at, token_expires_at
              FROM calendar_integrations
              WHERE organization_id = ${auth.organizationId} AND provider = 'google'
              ORDER BY created_at DESC LIMIT 1
            `;
            const conn = rows[0] || null;
            return json({
              configured: googleConfigured(),
              connected: !!conn,
              provider: conn?.provider || null,
              email: conn?.provider_email || null,
              syncEnabled: !!conn?.sync_enabled,
              calendarId: conn?.calendar_id || null,
              calendarName: conn?.calendar_name || null,
              lastSyncedAt: conn?.last_synced_at ? new Date(conn.last_synced_at).toISOString() : null,
            });
          } catch (err) {
            console.error("[Calendar status]", String(err).slice(0, 200));
            return json({ error: "Failed to load calendar status" }, 500);
          }
        }
        // ── Contacts API ─────────────────────────────────────────────
        if (pathname === "/api/contacts" && req.method === "GET") {
          try {
            const authHeader = req.headers.get("Authorization") || "";
            const t = authHeader.replace("Bearer ", "");
            if (!t) {
              return new Response(JSON.stringify({ error: "Authentication required" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }
            const { jwtVerify } = await import("jose");
            const secKey = process.env.JWT_SECRET!;
            let payload: any;
            try { const r = await jwtVerify(t, new TextEncoder().encode(secKey)); payload = r.payload; }
            catch { return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { "Content-Type": "application/json" } }); }
            const organizationId = payload.organizationId as string;

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return new Response(JSON.stringify({ error: "DB not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
            const sql = neon(dbUrl);
            const url = new URL(req.url);
            const q = url.searchParams.get("q") || "";
            const limit = parseInt(url.searchParams.get("limit") || "20", 10);
            const offset = parseInt(url.searchParams.get("offset") || "0", 10);

            let rows: any[];
            let total: number;

            if (q) {
              const pattern = `%${q}%`;
              rows = await sql`
                SELECT * FROM contacts
                WHERE organization_id = ${organizationId}
                  AND (first_name ILIKE ${pattern} OR last_name ILIKE ${pattern}
                       OR email ILIKE ${pattern} OR phone ILIKE ${pattern})
                ORDER BY updated_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `;
              const countRow = await sql`
                SELECT COUNT(*) as count FROM contacts
                WHERE organization_id = ${organizationId}
                  AND (first_name ILIKE ${pattern} OR last_name ILIKE ${pattern}
                       OR email ILIKE ${pattern} OR phone ILIKE ${pattern})
              `;
              total = Number(countRow[0]?.count || 0);
            } else {
              rows = await sql`
                SELECT * FROM contacts
                WHERE organization_id = ${organizationId}
                ORDER BY updated_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `;
              const countRow = await sql`SELECT COUNT(*) as count FROM contacts WHERE organization_id = ${organizationId}`;
              total = Number(countRow[0]?.count || 0);
            }

            return new Response(JSON.stringify({ contacts: rows, total, limit, offset }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Contacts API]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Failed to fetch contacts" }), { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── Chat API (keyword fallback + optional Gemini) ──────────
        if (pathname === "/api/chat" && req.method === "POST") {
          try {
            const body = await req.json() as { message?: string; lang?: string };
            const { message = "", lang = "en" } = body;
            if (!message.trim()) {
              return new Response(JSON.stringify({ reply: "" }),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }
            const apiKey = process.env.GEMINI_API_KEY || "";
            const msg = message.toLowerCase();
            const isEs = lang === "es";
            // Explicit callback request with a phone/email → alert the owner for real.
            // No contact address → nothing is sent and the guardrails keep the reply honest.
            const callbackContact = detectCallbackContact(message);
            if (callbackContact) void alertOwnerOfCallbackRequest(callbackContact, message);
            // Same-day priority support: text the owner when a visitor asks for a human.
            if (isSupportEscalation(message)) {
              void notifyOwnerOfSupportRequest("web chat", `Message: "${message.slice(0, 300)}\nLanguage: ${lang}`);
              return new Response(JSON.stringify({
                reply: isEs
                  ? "Gracias — he avisado a nuestro equipo. Para ayuda más rápida, llama al (727) 966-7556 o escribe a hello@receptionai.store."
                  : "Thanks — I've flagged this to our team. For the fastest help, call (727) 966-7556 or email hello@receptionai.store.",
              }), { status: 200, headers: { "Content-Type": "application/json" } });
            }

            // Keyword fallback, used only when the model is unavailable.
            // Whole-word matching only: substring matching answered the wrong question
            // (e.g. "do" inside "window", "plan" inside "planning").
            const fallback = (reason: string) => {
              // Accent-insensitive whole-word matching: "qué hacen" must match "que hacen" and
              // "facturación" must match "facturacion". Substring matching answered the wrong
              // question (e.g. "do" inside "window", "plan" inside "planning").
              const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
              const nmsg = norm(msg);
              const has = (...words: string[]) => words.some((w) => new RegExp(`\\b${norm(w)}\\b`, "i").test(nmsg));
              // Branch ORDER matters: contract/cancellation sit above pricing ("plan"/"planes" is a
              // pricing keyword), trial sits above demo ("prueba" is a demo keyword), and coming-soon
              // sits above services ("funciones"/"features" is a services keyword). Every answer below
              // uses ONLY facts the model path is given, and fits the 300-char reply cap.
              if (has("contract", "contracts", "commitment", "binding", "long-term", "contrato", "contratos", "compromiso", "obligacion", "a plazo")) {
                return isEs
                  ? "Sin contratos — todos los planes son mensuales y puedes cancelar cuando quieras."
                  : "No contracts — every plan is month-to-month and you can cancel anytime.";
              }
              if (has("cancel", "cancellation", "cancelar", "cancela", "cancelo", "cancelas", "cancelan", "cancelacion", "darse de baja", "darme de baja", "dar de baja")) {
                return isEs
                  ? "Puedes cancelar cuando quieras desde tu panel (Facturación → cancelar) o escribiendo a hello@receptionai.store — sin cargos."
                  : "Cancel anytime from your dashboard (Billing → cancel) or email hello@receptionai.store — no cancellation fees.";
              }
              if (has("price", "prices", "pricing", "cost", "costs", "precio", "precios", "costo", "costos", "tarifa", "tarifas", "plan", "plans", "planes", "how much", "cuanto")) {
                return isEs
                  ? "Planes: Starter $99/mes (1 linea, 500 min IA), Growth $199/mes (2 lineas, 2000 min IA), Scale $399/mes (ilimitado)."
                  : "Plans: Starter $99/mo (1 line, 500 AI-min), Growth $199/mo (2 lines, 2,000 AI-min), Scale $399/mo (unlimited).";
              }
              // Trial sits ABOVE demo: "prueba" is also a demo keyword, and there is no free trial.
              if (has("trial", "free trial", "free version", "free month", "prueba gratis", "prueba gratuita", "mes gratis", "version gratuita")) {
                return isEs
                  ? "No hay prueba gratis — los planes son suscripciones mensuales y el primer mes se cobra al momento de la compra. Puedes probar la demo en vivo llamando al (727) 966-7556."
                  : "There's no free trial — plans are monthly subscriptions and the first month is charged at checkout. You can try the live demo first: call (727) 966-7556.";
              }
              if (has("billing", "billed", "bill", "invoice", "invoices", "charged", "charge", "charges", "facturacion", "factura", "facturas", "cobran", "cobro", "cobrar", "pago", "pagos")) {
                return isEs
                  ? "El primer mes se cobra al momento de la compra y después se renueva automáticamente cada mes hasta que canceles. Precio de fundador: 50% de descuento los primeros 3 meses para los primeros 100 clientes."
                  : "The first month is charged at checkout, then it renews automatically each month until you cancel. Founder pricing: 50% off the first 3 months for the first 100 customers.";
              }
              if (has("hours", "hour", "business hours", "open", "abierto", "abren", "horario", "horarios", "24/7", "24-7", "what time", "a que hora")) {
                return isEs
                  ? "La recepcionista IA contesta 24/7, sin horario de oficina: llamadas, chat web y textos de día y de noche en inglés y español. Las citas siguen el horario que configures en el calendario."
                  : "The AI receptionist answers 24/7 — there are no business hours. Calls, web chat and texts are handled day and night in English and Spanish, and bookings follow the hours you set.";
              }
              // Coming-soon sits ABOVE services: "funciones"/"features" is a services keyword.
              if (has("coming soon", "roadmap", "upcoming", "future", "not yet available", "proximamente", "por venir", "futuro", "planean", "van a agregar", "todavia no", "que sigue")) {
                return isEs
                  ? "Disponible hoy: llamadas 24/7 en inglés y español, citas por teléfono y web, confirmaciones y recordatorios por SMS, buzón de voz, avisos de llamadas perdidas, chat web, transferencia al dueño y calendario. Próximamente: WhatsApp, Facebook, bandeja unificada, horarios por miembro."
                  : "Live today: 24/7 calls in English and Spanish, booking by phone and web, SMS confirmations and reminders, voicemail with playable recordings, missed-call alerts, web chat, owner transfer, built-in calendar, call analytics. Coming soon: WhatsApp, Facebook, unified inbox, team schedules.";
              }
              // Services: the same capabilities the model path is given as facts.
              if (has("services", "service", "servicios", "servicio", "features", "feature", "funciones", "funcion", "what do you do", "what do you offer", "que hace", "que hacen", "que ofrece", "que ofrecen", "ofrece", "ofrecen")) {
                return isEs
                  ? "ReceptionAI contesta llamadas 24/7 en inglés y español, agenda citas por teléfono y en la web, envía confirmaciones y recordatorios por SMS y te manda un resumen después de cada llamada. También recibe mensajes de voz, avisa de llamadas perdidas, tiene chat web y SMS y transfiere llamadas al dueño."
                  : "ReceptionAI answers calls 24/7 in English and Spanish, books appointments by phone and web, sends SMS confirmations and reminders, and texts you a summary after every call. It also catches voicemail, alerts you to missed calls, runs web chat and SMS, and can transfer callers to you.";
              }
              if (has("book", "booking", "appointment", "appointments", "reserva", "reservas", "reservar", "cita", "citas")) {
                return isEs
                  ? "Reserva una demo llamando al (727) 966-7556, o registrate en receptionai.store/signup. Los planes empiezan en $99 al mes."
                  : "Book a demo by calling (727) 966-7556, or sign up at receptionai.store/signup. Plans start at $99/month.";
              }
              if (has("demo", "try", "probar", "prueba", "test")) {
                return isEs
                  ? "Prueba la demo llamando al (727) 966-7556, o registrate en receptionai.store/signup. Los planes empiezan en $99 al mes."
                  : "Try the live demo by calling (727) 966-7556, or sign up at receptionai.store/signup. Plans start at $99/month.";
              }
              if (has("signup", "sign up", "register", "start", "registrate", "registrarme", "registro", "empezar")) {
                return isEs
                  ? "Registrate en receptionai.store/signup. Los planes empiezan en $99 al mes."
                  : "Sign up at receptionai.store/signup. Plans start at $99/month.";
              }
              if (has("calendar", "schedule", "calendario", "agenda", "agendar")) {
                return isEs
                  ? "Calendario incorporado con horario de atencion preconfigurado, sin Google. Tus clientes reservan por telefono, chat o SMS y reciben confirmacion por SMS."
                  : "Built-in calendar with business hours preset - no Google setup. Clients book by phone, chat, or SMS and get SMS confirmations.";
              }
              if (has("support", "soporte", "talk to a person", "hablar con una persona", "hablar con alguien", "atencion al cliente", "customer service", "servicio al cliente", "help desk")) {
                return isEs
                  ? "Para hablar con una persona, escribe a hello@receptionai.store o llama a nuestra demo en vivo al (727) 966-7556. El plan Scale incluye soporte prioritario 24/7 con respuesta humana el mismo día."
                  : "For a person, email hello@receptionai.store or call our live demo line at (727) 966-7556. The Scale plan includes 24/7 priority support with a same-day human response.";
              }
              if (has("callback", "call back", "call me", "contact me", "reach me", "llamame", "llamarme", "que me llamen", "contactenme", "que me contacten", "escribeme", "escribirme")) {
                return isEs
                  ? "Deja tu teléfono o correo en este chat y lo anoto para nuestro equipo. Para hablar con una persona ahora, llama a nuestra demo en vivo al (727) 966-7556."
                  : "Leave your phone or email in this chat and I'll note it for our team. For a human right now, call our live demo line at (727) 966-7556.";
              }
              if (/\b(hi|hello|hey|hola|buenas|saludos)\b/.test(nmsg)) {
                return isEs
                  ? "Hola! Como puedo ayudarte? Puedo contarte sobre planes, funciones o como reservar una demo."
                  : "Hi! How can I help? I can tell you about plans, features, or how to book a demo.";
              }
              // No keyword matched: say so honestly instead of guessing.
              return isEs
                ? "No estoy segura de eso — lo dejaré anotado para nuestro equipo. También puedes escribir a hello@receptionai.store o llamar a nuestra demo en vivo al (727) 966-7556."
                : "I'm not sure about that — I'll flag it for our team. You can also email hello@receptionai.store or call our live demo at (727) 966-7556.";
            };
            // Reply-length cap: cut at a real sentence end, never mid-sentence or mid-word.
            const REPLY_MAX_CHARS = 300;
            const REPLY_MIN_SENTENCE = 150;
            const capReply = (raw: string): string => {
              const text = raw.trim();
              if (text.length <= REPLY_MAX_CHARS) return text;
              const head = text.slice(0, REPLY_MAX_CHARS);
              let sentenceEnd = -1;
              for (let i = head.length - 1; i >= 0; i--) {
                const ch = text[i];
                if (ch === "." || ch === "!" || ch === "?" || ch === "…") {
                  const next = text[i + 1];
                  if (next === undefined || /\s/.test(next)) { sentenceEnd = i; break; }
                }
              }
              if (sentenceEnd >= REPLY_MIN_SENTENCE - 1) return text.slice(0, sentenceEnd + 1).trim();
              const space = text.lastIndexOf(" ", REPLY_MAX_CHARS - 1);
              const cutAt = space > 0 ? space : REPLY_MAX_CHARS - 1;
              return text.slice(0, cutAt).trim().replace(/[.,;:!?]+$/, "") + "…";
            };
            let failReason = apiKey ? "" : "no gemini api key";
            if (apiKey) {
              const startedAt = Date.now();
              try {
                // Product facts — EN and ES must carry THE SAME facts (full parity): every
                // English fact has a fluent Spanish equivalent below. Never add a fact to one
                // language only, and keep every line true today (future features are marked
                // "coming soon").
                const FACT_LINES_EN = [
                  "- Plans: Starter $99/mo (1 line, 500 AI-min), Growth $199/mo (2 lines, 2,000 AI-min), Scale $399/mo (unlimited lines, 10,000+ AI-min).",
                  "- No long-term contracts: every plan is month-to-month. Cancel anytime before the next renewal — it takes effect at the end of the current paid month, with no cancellation fee.",
                  "- How to cancel: from your account dashboard (Settings → Billing → cancel) or email hello@receptionai.store.",
                  "- Billing: the first month is charged at checkout, then it renews monthly automatically. Founder pricing: 50% off the first 3 months for the first 100 customers.",
                  "- Live today: answers calls 24/7 in English and Spanish; books appointments by phone and on the web; sends SMS confirmations and reminders; sends a post-call SMS summary to the owner after every call; recognizes returning callers.",
                  "- Live today: catches voicemail and sends missed-call alerts; web chat; SMS messaging; “talk to the owner” call transfer (press 3); built-in calendar with preset business hours (no Google account needed).",
                  "- Free live demo line: call (727) 966-7556.",
                  "- Support: email hello@receptionai.store.",
                  "- Coming soon (NOT live yet — say so honestly if asked): WhatsApp and Facebook messaging, a unified multi-channel inbox, per-member team schedules and routing, custom call scripts, and sentiment-based smart handoff.",
                  "- Scale plan: 24/7 priority support with same-day human response; web-chat requests for a human or support are passed to the team.",
                ];
                const FACT_LINES_ES = [
                  "- Planes: Starter $99/mes (1 línea, 500 min IA), Growth $199/mes (2 líneas, 2000 min IA), Scale $399/mes (líneas ilimitadas, más de 10,000 min IA).",
                  "- Sin contratos a largo plazo: todos los planes son mes a mes. Puedes cancelar cuando quieras antes de la próxima renovación — se hace efectivo al final del mes que ya pagaste, sin cargo por cancelación.",
                  "- Cómo cancelar: desde el panel de tu cuenta (Configuración → Facturación → cancelar) o escribiendo a hello@receptionai.store.",
                  "- Facturación: el primer mes se cobra al momento de la compra y después se renueva automáticamente cada mes. Precio de fundador: 50% de descuento los primeros 3 meses para los primeros 100 clientes.",
                  "- Disponible hoy: contesta llamadas 24/7 en inglés y español; agenda citas por teléfono y en la web; envía confirmaciones y recordatorios por SMS; manda al dueño un resumen por SMS después de cada llamada; reconoce a los clientes que vuelven a llamar.",
                  "- Disponible hoy: recibe mensajes de voz y avisa de llamadas perdidas; chat en la web; mensajería por SMS; transferencia “hablar con el dueño” (presione 3); calendario incorporado con el horario de atención ya configurado (sin cuenta de Google).",
                  "- Línea de demostración gratuita: llama al (727) 966-7556.",
                  "- Soporte: escribe a hello@receptionai.store.",
                  "- Próximamente (TODAVÍA no disponible — dilo con honestidad si te preguntan): mensajería por WhatsApp y Facebook, bandeja de entrada unificada multicanal, panel de analíticas avanzadas, horarios y enrutamiento por miembro del equipo, reproducción del audio de las grabaciones de llamadas, guiones de llamada personalizados y traspaso inteligente según el sentimiento del cliente.",
                  "- Plan Scale: soporte prioritario 24/7 con respuesta humana el mismo día; las solicitudes de una persona o de soporte por el chat de la web se pasan al equipo.",
                ];
                const facts = isEs
                  ? "Datos del producto (usa SOLO estos; no inventes precios ni funciones):\n" + FACT_LINES_ES.join("\n")
                  : "Product facts (use ONLY these; do not invent prices or features):\n" + FACT_LINES_EN.join("\n");
                const guardrail = isEs
                  ? "Regla de honestidad: nunca afirmes que se envió o se enviará un texto, correo, llamada o mensaje a menos que el sistema realmente lo envíe. Si alguien deja un teléfono o correo para contacto, di que quedó anotado para nuestro equipo — no prometas detalles ni un horario. Nunca anuncies que le vas a enviar algo al dueño; si te piden que los contacten, confirma la nota y sigue adelante."
                  : "Honesty rule: never claim that a text, email, call, or message has been or will be sent unless the system actually sends it. If a visitor leaves a phone number or email for contact, say it has been noted for the team — do not promise specifics or a time. Never announce that you are sending something to the owner; if a visitor asks to be contacted, confirm the note and move on.";
                const sysPrompt = (isEs
                  ? "Eres ReceptionAI, recepcionista IA de un producto SaaS. Responde usando SOLO los datos del producto. Responde en 1-3 frases cortas (max ~250 caracteres). No uses preambulos como 'Como recepcionista IA'. No inventes precios ni funciones."
                  : "You are ReceptionAI, an AI receptionist for a SaaS product. Answer using ONLY the product facts. Reply in 1-3 short sentences (max ~250 characters). No preamble like 'As an AI receptionist'. Do not invent prices or features.") + "\n\n" + guardrail + "\n\n" + facts;
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 8000);
                const gRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
                  { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      system_instruction: { parts: [{ text: sysPrompt }] },
                      contents: [{ role: "user", parts: [{ text: message }] }],
                      generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
                    }), signal: ctrl.signal },
                );
                clearTimeout(t);
                if (gRes.ok) {
                  const data = await gRes.json() as any;
                  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
                  if (raw) {
                    return new Response(JSON.stringify({ reply: capReply(raw) }),
                      { status: 200, headers: { "Content-Type": "application/json" } });
                  }
                  failReason = "gemini returned an empty reply";
                } else {
                  failReason = "gemini status=" + gRes.status;
                  console.error("[chat] gemini error: status=" + gRes.status + " ms=" + (Date.now() - startedAt));
                }
              } catch {
                failReason = "gemini network/abort";
                console.error("[chat] gemini error: status=network/abort ms=" + (Date.now() - startedAt));
              }
            }
            return new Response(JSON.stringify({ reply: fallback(failReason || "no gemini reply") }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Chat API]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ reply: "Something went wrong." }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }
        // ── Booking API — public web booking (no auth) ────────────
        if (pathname === "/api/booking/slots" && req.method === "GET") {
          try {
            const url = new URL(req.url);
            const orgId = url.searchParams.get("org_id") || "";
            const date = url.searchParams.get("date") || "";
            const duration = parseInt(url.searchParams.get("duration") || "60", 10);

            if (!orgId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
              return new Response(JSON.stringify({ error: "org_id and date (YYYY-MM-DD) required" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return new Response(JSON.stringify({ error: "DB not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }

            const result = await getSlotsForDate(orgId, date, duration);
            if (result.closed) {
              return new Response(JSON.stringify({ date, slots: [], closed: true, ...(result.holiday ? { holiday: true } : {}) }),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ date, slots: result.slots, total: result.slots.length }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Booking Slots]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Failed to load slots" }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

// ── Calendar Slots API (public) ─────────────────────────────
        if (pathname === "/api/calendar/slots" && req.method === "GET") {
          try {
            const url = new URL(req.url);
            const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
            const service = url.searchParams.get("service") || "General Service";
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return new Response(JSON.stringify({ slots: [] }),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }
            const sql = neon(dbUrl);

            // Get day of week (0=Sun, 6=Sat)
            const dayOfWeek = new Date(date + "T00:00:00").getDay();
            const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

            // Default slots: 9am-5pm, 30-min intervals
            const slots: string[] = [];
            const startHour = 9, endHour = 17;

            // Check business hours for first org that has them, or use defaults
            const bhRows = await sql`
              SELECT day_of_week, open_time, close_time, is_closed
              FROM business_hours WHERE day_of_week = ${days[dayOfWeek]} LIMIT 1
            `;

            let openHour = startHour, closeHour = endHour;
            if (bhRows[0] && !bhRows[0].is_closed) {
              openHour = parseInt(bhRows[0].open_time?.split(":")[0] || `${startHour}`);
              closeHour = parseInt(bhRows[0].close_time?.split(":")[0] || `${endHour}`);
            } else if (bhRows[0]?.is_closed) {
              return new Response(JSON.stringify({ slots: [], closed: true }),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }

            for (let h = openHour; h < closeHour; h++) {
              for (let m = 0; m < 60; m += 30) {
                const time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
                slots.push(time);
              }
            }

            return new Response(JSON.stringify({ date, service, slots, closed: false }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Calendar Slots]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ slots: [], error: "Failed to load slots" }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }

        if (pathname === "/api/booking" && req.method === "POST") {
          try {
            const body = await req.json() as {
              org_id?: string; name?: string; phone?: string; email?: string;
              date?: string; time?: string; service?: string; notes?: string;
            };
            const { org_id = "", name = "", phone = "", email = "",
                    date = "", time = "", service = "General Service", notes = "" } = body;

            if (!org_id || !name || !phone || !date || !time) {
              return new Response(JSON.stringify({ error: "org_id, name, phone, date, and time are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return new Response(JSON.stringify({ error: "DB not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }

            const sql = neon(dbUrl);
            const [hour, min] = time.split(":").map(Number);
            const endMin = hour * 60 + min + 60; // default 60 min
            const endTime = `${String(Math.floor(endMin/60)).padStart(2,"0")}:${String(endMin%60).padStart(2,"0")}`;

            // Create or find contact
            let contactId = "";
            const existing = await sql`
              SELECT id FROM contacts WHERE organization_id = ${org_id} AND phone = ${phone} LIMIT 1
            `;
            if (existing[0]) {
              contactId = existing[0].id;
            } else {
              const c = await sql`
                INSERT INTO contacts (id, organization_id, first_name, last_name, phone, email, created_at, updated_at)
                VALUES (gen_random_uuid(), ${org_id}, ${name}, '', ${phone}, ${email || null}, NOW(), NOW())
                RETURNING id
              `;
              contactId = c[0]?.id;
            }

            // Create appointment
            const appt = await sql`
              INSERT INTO appointments
                (id, organization_id, contact_id, title, start_time, end_time,
                 service_type, status, notes, created_at, updated_at)
              VALUES
                (gen_random_uuid(), ${org_id}, ${contactId},
                 ${service + " - " + name},
                 ${date + "T" + time + ":00"}, ${date + "T" + endTime + ":00"},
                 ${service}, 'confirmed', ${notes || null}, NOW(), NOW())
              RETURNING id
            `;
            const apptId = appt[0]?.id;
            if (apptId) syncAppointmentToGoogle(apptId).catch(() => {});

            // Send SMS confirmation
            const orgRow = await sql`
              SELECT pn.phone_number FROM phone_numbers pn
              WHERE pn.organization_id = ${org_id} AND pn.is_active = true LIMIT 1
            `;
            const orgPhone = orgRow[0]?.phone_number || "";

            if (orgPhone && phone) {
              const telnyxKey = process.env.TELNYX_API_KEY || "";
              if (telnyxKey) {
                await fetch("https://api.telnyx.com/v2/messages", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${telnyxKey}` },
                  body: JSON.stringify({
                    from: orgPhone, to: phone,
                    text: `Hi ${name}, your appointment for ${service} on ${date} at ${time} is confirmed. We'll send a reminder before your visit. Questions? Call ${orgPhone}.`,
                  }),
                }).catch(() => {});
              }
            }

            return new Response(JSON.stringify({
              success: true,
              appointment: { id: appt[0]?.id, date, time, endTime, service, customerName: name },
            }), { status: 201, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Booking Create]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Failed to create appointment" }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── Reminders Cron ──────────────────────────────────────────
        if (pathname === "/api/reminders/process" && req.method === "GET") {
          try {
            const cronSecret = process.env.CRON_SECRET || "receptionai-cron-secret-dev";
            // Accept secret via Authorization header OR ?secret= query param (for cron-job.org)
            const authHeader = req.headers.get("Authorization") || "";
            const token = authHeader.replace("Bearer ", "");
            const url = new URL(req.url);
            const querySecret = url.searchParams.get("secret") || "";
            const providedSecret = token || querySecret;

            if (providedSecret !== cronSecret) {
              return new Response(JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return new Response(JSON.stringify({ processed: 0, status: "ok", message: "No database configured" }),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }

            const sql = neon(dbUrl);
            const now = new Date().toISOString();

            const due = await sql`
              SELECT ar.id as reminder_id, ar.appointment_id, ar.organization_id,
                     ar.reminder_type, ar.recipient_phone, ar.recipient_email, ar.message_body,
                     a.title as appt_title
              FROM appointment_reminders ar
              JOIN appointments a ON ar.appointment_id = a.id
              WHERE ar.status = 'pending' AND ar.scheduled_at <= ${now}
              LIMIT 50
            `;

            let sent = 0, failed = 0;
            for (const r of due as any[]) {
              const phoneRow = await sql`
                SELECT phone_number FROM phone_numbers
                WHERE organization_id = ${r.organization_id} AND is_active = true LIMIT 1
              `;
              const fromNum = phoneRow[0]?.phone_number || "";

              if (!r.recipient_phone || !fromNum) {
                await sql`UPDATE appointment_reminders SET status='failed', error_message='Missing phone', updated_at=NOW() WHERE id=${r.reminder_id}`;
                failed++; continue;
              }

              const telnyxKey = process.env.TELNYX_API_KEY || "";
              let smsOk = false;
              if (telnyxKey) {
                const smsRes = await fetch("https://api.telnyx.com/v2/messages", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${telnyxKey}` },
                  body: JSON.stringify({ from: fromNum, to: r.recipient_phone, text: r.message_body }),
                }).catch(() => null);
                smsOk = smsRes?.ok === true;
              }

              if (smsOk || !telnyxKey) {
                await sql`UPDATE appointment_reminders SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=${r.reminder_id}`;
                await sql`UPDATE appointments SET reminder_sent_at=NOW(), reminder_sent_count=COALESCE(NULLIF(reminder_sent_count,'0')::int+1,1)::text, updated_at=NOW() WHERE id=${r.appointment_id}`;
                sent++;
              } else {
                await sql`UPDATE appointment_reminders SET status='failed', error_message='Telnyx error', updated_at=NOW() WHERE id=${r.reminder_id}`;
                failed++;
              }
            }

            return new Response(JSON.stringify({ processed: due.length, sent, failed }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Reminders Cron]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ processed: 0, error: String(err).slice(0, 100) }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── Auth: Login ──────────────────────────────────────────────
        if (pathname === "/api/auth/login" && req.method === "POST") {
          try {
            const body = await req.json() as { email?: string; password?: string };
            const { email = "", password = "" } = body;

            if (!email || !password) {
              return new Response(JSON.stringify({ error: "Email and password required" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Zod-style email validation
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              return new Response(JSON.stringify({ error: "Validation failed", details: [{ message: "Invalid email" }] }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              // Mock mode: accept demo credentials
              if (email === "demo@receptionai.com" && password === "demo1234") {
                const { SignJWT } = await import("jose");
                const secret = process.env.JWT_SECRET!;
                const token = await new SignJWT({
                  userId: "mock-user-1", organizationId: "mock-org-1", email, role: "owner",
                }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("24h")
                  .sign(new TextEncoder().encode(secret));

                return new Response(JSON.stringify({
                  token, user: { userId: "mock-user-1", organizationId: "mock-org-1", email, name: "Demo User", role: "owner", organizationName: "Demo Business" },
                }), { status: 200, headers: { "Content-Type": "application/json" } });
              }
              return new Response(JSON.stringify({ error: "Invalid email or password" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }

            const sql = neon(dbUrl);
            const row = await sql`
              SELECT u.id as user_id, u.organization_id, u.email, u.name, u.role, u.password_hash,
                     o.name as organization_name
              FROM users u
              INNER JOIN organizations o ON u.organization_id = o.id
              WHERE u.email = ${email}
              LIMIT 1
            `;

            const user = row[0] as any;
            if (!user || !user.password_hash) {
              return new Response(JSON.stringify({ error: "Invalid email or password" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }

            const bcrypt = await import("bcryptjs");
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
              return new Response(JSON.stringify({ error: "Invalid email or password" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }

            const { SignJWT } = await import("jose");
            const secret = process.env.JWT_SECRET!;
            const token = await new SignJWT({
              userId: user.user_id, organizationId: user.organization_id,
              email: user.email, role: user.role,
            }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("24h")
              .sign(new TextEncoder().encode(secret));

            return new Response(JSON.stringify({
              token, user: {
                userId: user.user_id, organizationId: user.organization_id,
                email: user.email, name: user.name, role: user.role,
                organizationName: user.organization_name,
              },
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Login]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Login failed" }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── Stripe Checkout ──────────────────────────────────────────
// ── Auth Register API ────────────────────────────────────────
        if (pathname === "/api/auth/register" && req.method === "POST") {
          try {
            const body = await req.json() as {
              name?: string; email?: string; password?: string;
              companyName?: string; industry?: string; timezone?: string;
            };
            const { name = "", email = "", password = "" } = body;
            if (!name || !email || !password) {
              return new Response(JSON.stringify({ error: "name, email, and password are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }
            if (password.length < 8) {
              return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return new Response(JSON.stringify({ error: "Database not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }
            const sql = neon(dbUrl);

            // Check if email already exists
            const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
            if (existing[0]) {
              return new Response(JSON.stringify({ error: "Email already registered" }),
                { status: 409, headers: { "Content-Type": "application/json" } });
            }

            // Hash password (simple SHA-256 via Bun)
            const hasher = new Bun.CryptoHasher("sha256");
            hasher.update(password);
            const passwordHash = hasher.digest("hex");

            // Create org
            const companyName = body.companyName || name + "'s Business";
            const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 8);
            const orgResult = await sql`
              INSERT INTO organizations (id, name, slug, timezone)
              VALUES (gen_random_uuid(), ${companyName}, ${slug}, ${body.timezone || "America/New_York"})
              RETURNING id
            `;
            const orgId = orgResult[0]?.id;
            if (!orgId) throw new Error("Failed to create organization");

            // Create user
            const { SignJWT } = await import("jose");
            const secKey = process.env.JWT_SECRET!;
            const userResult = await sql`
              INSERT INTO users (id, organization_id, email, name, password_hash, role)
              VALUES (gen_random_uuid(), ${orgId}, ${email}, ${name}, ${passwordHash}, 'admin')
              RETURNING id, email, name, role
            `;
            const user = userResult[0];
            if (!user) throw new Error("Failed to create user");

            // Create default business hours
            for (let d = 0; d < 7; d++) {
              const isWeekend = d === 0 || d === 6;
              await sql`
                INSERT INTO business_hours (id, organization_id, day_of_week, open_time, close_time, is_closed)
                VALUES (gen_random_uuid(), ${orgId}, ${String(d)}, ${isWeekend ? "00:00" : "09:00"}, ${isWeekend ? "00:00" : "17:00"}, ${isWeekend})
              `;
            }

            // Generate JWT
            const token = await new SignJWT({ userId: user.id, email: user.email, organizationId: orgId, role: user.role })
              .setProtectedHeader({ alg: "HS256" })
              .setIssuedAt()
              .setExpirationTime("30d")
              .sign(new TextEncoder().encode(secKey));

            return new Response(JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: orgId } }),
              { status: 201, headers: { "Content-Type": "application/json" } });

          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("[Auth Register]", errMsg);
            return new Response(JSON.stringify({ error: "Registration failed", detail: errMsg }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        if (pathname === "/api/stripe/checkout" && req.method === "POST") {
          try {
            const body = await req.json() as {
              companyName?: string; email?: string; name?: string; plan?: string;
              useExistingNumber?: boolean; existingPhoneNumber?: string; password?: string;
            };
            const { companyName = "", email = "", name = "", plan = "",
                    useExistingNumber, existingPhoneNumber = "", password = "" } = body;

            if (!companyName || !email || !name || !plan) {
              return new Response(JSON.stringify({ error: "Missing required fields: companyName, email, name, plan" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const PRICE_IDS: Record<string, string> = {
              starter: "price_1TxrHbP7NtNpgQde64Zp1tgM",
              growth: "price_1TxrJCP7NtNpgQdeNBA9dxqn",
              scale: "price_1TxrKSP7NtNpgQdeh8Jh1P2Z",
            };
            const priceId = PRICE_IDS[plan];
            if (!priceId) {
              return new Response(JSON.stringify({ error: "Invalid plan. Choose starter, growth, or scale." }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const stripeKey = process.env.STRIPE_SECRET_KEY || "";
            if (!stripeKey) {
              return new Response(JSON.stringify({ error: "Stripe not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }

            const proto = req.headers.get("x-forwarded-proto") || "https";
            const host = req.headers.get("host") || "www.receptionai.store";
            const baseUrl = `${proto}://${host}`;

            const params = new URLSearchParams({
              "customer_email": email,
              "mode": "subscription",
              "success_url": `${baseUrl}/signup/success?plan=${plan}&email=${encodeURIComponent(email)}`,
              "cancel_url": `${baseUrl}/signup`,
              "line_items[0][price]": priceId,
              "line_items[0][quantity]": "1",
              "metadata[companyName]": companyName,
              "metadata[email]": email,
              "metadata[name]": name,
              "metadata[plan]": plan,
              "metadata[password]": password,
              "metadata[useExistingNumber]": String(!!useExistingNumber),
              "metadata[existingPhoneNumber]": existingPhoneNumber,
              "discounts[0][coupon]": "0JvBz6Xv",
              "subscription_data[metadata][companyName]": companyName,
            });

            const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${stripeKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: params.toString(),
            });

            const session = await stripeRes.json() as any;
            if (session.error) {
              return new Response(JSON.stringify({ error: session.error.message || "Stripe checkout failed" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify({ url: session.url }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Stripe Checkout]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Internal server error" }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── Auth: Forgot Password ───────────────────────────────────
        if (pathname === "/api/auth/forgot-password" && req.method === "POST") {
          try {
            const body = await req.json() as { email?: string };
            const { email = "" } = body;

            // Always return same response (don't leak user existence)
            const response = { message: "If that email exists, we've sent a reset link." };

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              return new Response(JSON.stringify(response),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              // Mock mode — always say success
              return new Response(JSON.stringify(response),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }

            const sql = neon(dbUrl);
            const users = await sql`
              SELECT id, email FROM users WHERE email = ${email} LIMIT 1
            `;

            if (users.length === 0) {
              return new Response(JSON.stringify(response),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }

            const user = users[0] as any;
            const { SignJWT } = await import("jose");
            const secret = process.env.JWT_SECRET!;
            const resetToken = await new SignJWT({
              userId: user.id, email: user.email, purpose: "password-reset",
            }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
              .sign(new TextEncoder().encode(secret));

            // Store reset token hash in DB for optional invalidation
            const bcrypt = await import("bcryptjs");
            const tokenHash = await bcrypt.hash(resetToken, 10);
            await sql`
              UPDATE users SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('reset_token_hash', ${tokenHash}, 'reset_token_expires', ${new Date(Date.now() + 3600000).toISOString()})
              WHERE id = ${user.id}
            `;

            // Send email
            const baseUrl = (req.headers.get("x-forwarded-proto") || "https") + "://" +
                            (req.headers.get("host") || "receptionai.store");
            const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

            console.log(`[Password Reset] Token generated for ${email}`);
            console.log(`[Password Reset] URL: ${resetUrl}`);

            // Send asynchronously — don't block response
            const { sendEmail } = await import("../../lib/email");
            sendEmail(email, "Reset your ReceptionAI password",
              `Click this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`);

            return new Response(JSON.stringify(response),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Forgot Password]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ message: "If that email exists, we've sent a reset link." }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── Auth: Reset Password ────────────────────────────────────
        if (pathname === "/api/auth/reset-password" && req.method === "POST") {
          try {
            const body = await req.json() as { token?: string; password?: string };
            const { token = "", password = "" } = body;

            if (!token || !password) {
              return new Response(JSON.stringify({ error: "Token and password are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            if (password.length < 6) {
              return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Verify JWT
            const { jwtVerify } = await import("jose");
            const secret = process.env.JWT_SECRET!;
            let payload: any;
            try {
              const result = await jwtVerify(token, new TextEncoder().encode(secret));
              payload = result.payload;
              if (payload.purpose !== "password-reset") throw new Error("Invalid purpose");
            } catch {
              return new Response(JSON.stringify({ error: "Invalid or expired reset link. Request a new one." }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const userId = payload.userId as string;
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
              return new Response(JSON.stringify({ message: "Password updated successfully. Go to login." }),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }

            // Hash new password and update
            const bcrypt = await import("bcryptjs");
            const passwordHash = await bcrypt.hash(password, 12);
            const sql = neon(dbUrl);
            await sql`
              UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${userId}
            `;

            return new Response(JSON.stringify({ message: "Password updated successfully. Go to login." }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Reset Password]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }


        // ── Stripe Customer Portal ───────────────────────────────────
        if (pathname === "/api/stripe/portal" && req.method === "POST") {
          try {
            const authHeader = req.headers.get("Authorization") || "";
            const t = authHeader.replace("Bearer ", "");
            if (!t) {
              return new Response(JSON.stringify({ error: "Authentication required" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }
            const { jwtVerify } = await import("jose");
            const secKey = process.env.JWT_SECRET!;
            let payload: any;
            try {
              const r = await jwtVerify(t, new TextEncoder().encode(secKey));
              payload = r.payload;
            } catch {
              return new Response(JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }
            const orgId = payload.organizationId as string;
            const stripeKey = process.env.STRIPE_SECRET_KEY || "";
            if (!stripeKey) {
              return new Response(JSON.stringify({ error: "Stripe not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }
            const dbUrl = process.env.DATABASE_URL;
            let custId = "";
            if (dbUrl) {
              const sql = neon(dbUrl);
              try { const rows = await sql`SELECT stripe_customer_id FROM organizations WHERE id = ${orgId} LIMIT 1`; custId = rows[0]?.stripe_customer_id || ""; } catch { /* column may not exist */ }
            }
            if (!custId) {
              return new Response(JSON.stringify({ error: "No Stripe customer found." }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }
            const proto = req.headers.get("x-forwarded-proto") || "https";
            const host = req.headers.get("host") || "receptionai.store";
            const returnUrl = proto + "://" + host + "/dashboard/billing";
            const stripeRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
              method: "POST",
              headers: { Authorization: "Bearer " + stripeKey, "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ customer: custId, return_url: returnUrl }),
            });
            const session = await stripeRes.json() as any;
            if (session.error) {
              return new Response(JSON.stringify({ error: session.error.message }),
                { status: 500, headers: { "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ url: session.url }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Stripe Portal]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Internal server error" }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }
        // Redirect /success to /signup/success
        if (pathname === "/success") {
          const qs = new URL(req.url).search || "";
          return new Response(null, {
            status: 302,
            headers: { "Location": "/signup/success" + qs },
          });
        }
        // Static + SSR
        if (pathname !== "/") {
          const file = Bun.file(CLIENT_DIR + pathname);
          if (await file.exists()) return new Response(file);
        }
        // IOS FIX: injected CSS for input visibility — DO NOT REMOVE. See WORKFLOW.md.
        const srrRes = await (handler as any).fetch(req);
        const ct = srrRes.headers.get("content-type") || "";
        if (ct.includes("text/html")) {
          const html = await srrRes.text();
          const fixCSS = "<style>html{color-scheme:light!important}input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]),textarea,select{color:#111827!important;-webkit-text-fill-color:#111827!important;background-color:#fff!important}input::placeholder,textarea::placeholder{color:#9ca3af!important;-webkit-text-fill-color:#9ca3af!important;opacity:1!important}</style>";
          const injected = html.replace("</head>", fixCSS + "</head>");
          const hdrs = new Headers(srrRes.headers);
          return new Response(injected, { status: srrRes.status, headers: hdrs });
        }
        return srrRes;
      },
    });
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

// ── Graceful shutdown & memory monitoring ─────────────────────────

const shutdown = () => {
  console.log(`\n[Shutdown] Cleaning up...`);
  console.log(`  Active calls: ${calls.size}`);
  console.log(`  Pending hangups: ${pendingHangups.size}`);
  console.log(`  Callback states: ${callbackStates.size}`);
  calls.clear();
  pendingHangups.clear();
  pendingCallbacks.clear();
  callbackStates.clear();
  console.log("[Shutdown] Done.");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Periodic memory logging (every 5 minutes)
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`[Memory] RSS: ${(mem.rss / 1024 / 1024).toFixed(1)}MB, Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB, Calls: ${calls.size}`);
}, 5 * 60 * 1000);

console.log(`team-site serving on http://${HOST}:${String(PORT)}`);
