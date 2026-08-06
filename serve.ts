// Production server — AI Receptionist
// Auto-load .env file (Bun v1.3 does not support process.loadEnvFile)
try { const envContent = await (await import("fs")).promises.readFile(".env", "utf-8"); for (const line of envContent.split("\n")) { const idx = line.indexOf("="); if (idx > 0 && !line.startsWith("#")) { const key = line.slice(0, idx).trim(); const val = line.slice(idx + 1).trim(); if (key && !process.env[key]) process.env[key] = val; } } } catch {}
import handler from "./dist/server/server.js";
import { neon } from "@neondatabase/serverless";

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
          generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
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

function buildGreeting(orgName: string, lang: string, callerContext?: CallerContext): string {
  const es = lang === "es";
  if (callerContext) {
    if (callerContext.previousVisits > 0 && callerContext.firstName) {
      if (callerContext.lastService) {
        return es
          ? `¡Bienvenido de nuevo, ${callerContext.firstName}! Su última visita: ${callerContext.lastService}. Presione 1 para agendar, 2 para servicios, o 3 para hablar con alguien.`
          : `Welcome back, ${callerContext.firstName}! Last visit: ${callerContext.lastService}. Press 1 to book, 2 for services, or 3 for a team member.`;
      }
      return es
        ? `¡Bienvenido de nuevo, ${callerContext.firstName}! Presione 1 para citas, 2 para servicios, o 3 para hablar con alguien.`
        : `Welcome back, ${callerContext.firstName}! Press 1 for appointments, 2 for services, or 3 for a team member.`;
    }
  }
  return es
    ? `Hola, se ha comunicado con ${orgName}. Presione 1 para citas, 2 para servicios, 3 para hablar con alguien, 4 para reprogramar, 5 para disponibilidad, o 9 para dejar un mensaje.`
    : `Hello, you've reached ${orgName}. Press 1 for appointments, 2 for services, 3 for a team member, 4 to reschedule, 5 for availability, or 9 to leave a message.`;
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

    // Create a conversation record for this call
    const conversationId = crypto.randomUUID();
    await sql`
      INSERT INTO conversations (id, organization_id, contact_id, type, status, direction, started_at)
      VALUES (${conversationId}, ${cs.orgId}, ${contactId}, 'call', 'ended', 'inbound', ${cs.startTime.toISOString()})
    `;

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

async function cmd(cid: string, action: string, body: any = {}) {
  const res = await fetch(`${TELNYX}/calls/${cid}/actions/${action}`, { method: "POST", headers: th(), body: JSON.stringify(body) });
  const d = await res.json();
  const ok = !d.errors;
  if (!ok) console.log(`${action} ERR:`, JSON.stringify(d.errors).slice(0, 150));
  return ok;
}

async function promptAndWait(cid: string, text: string) {
  return cmd(cid, "gather", {
    type: "dtmf",
    payload: text,
    voice: "female",
    language: "en-US",
    minimum_digits: 1,
    maximum_digits: 1,
    timeout_millis: 8000,
  });
}

async function speakOnly(cid: string, text: string, lang: string = "en") {
  return cmd(cid, "speak", { payload: text, voice: "female", language: lang === "es" ? "es-US" : "en-US" });
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

// ── Voicemail helpers ────────────────────────────────────────────────────────
async function startVoicemailRecording(cid: string, lang: string): Promise<void> {
  const es = lang === "es";
  // Use Telnyx record_start for real audio recording
  await speakOnly(cid, es
    ? "Por favor deje su mensaje después del tono."
    : "Please leave your message after the tone.", lang);
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

async function saveVoicemailRecording(callSid: string, recordingUrl: string, duration: number, orgId: string, callerNumber: string): Promise<void> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return;
    const sql = neon(dbUrl);
    // Find or create conversation for this call
    const conv = await sql`SELECT id FROM conversations WHERE organization_id = ${orgId} AND twilio_call_sid = ${callSid} ORDER BY created_at DESC LIMIT 1`;
    const convId = conv[0]?.id || crypto.randomUUID();
    await sql`
      INSERT INTO recordings (id, organization_id, conversation_id, recording_url, duration_seconds, storage_provider, created_at)
      VALUES (gen_random_uuid(), ${orgId}, ${convId}, ${recordingUrl}, ${duration}, 'telnyx', NOW())
    `;
    console.log(`[Voicemail] Saved recording: ${recordingUrl.slice(0, 60)} (${duration}s)`);
  } catch (err) {
    console.error("[Voicemail] save recording failed:", String(err).slice(0, 100));
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
  phase: 'language' | 'menu' | 'reschedule_lookup' | 'reschedule_confirm' | 'reschedule_date' | 'reschedule_time' | 'reschedule_final' | 'survey' | 'waitlist';
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
}
const calls = new Map<string, CallState>(); // cid → CallState
const pendingHangups = new Set<string>();
const pendingCallbacks = new Map<string, { orgName: string; language: string; callerNumber: string; businessNumber: string }>(); // outbound cid → callback info
const callbackStates = new Map<string, { orgName: string; language: string; callerNumber: string; businessNumber: string; answered: boolean }>(); // outbound cid → active callback state

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
        await speakOnly(cid, "I can't look up appointments in demo mode. " + buildShortPrompt("en"), "en");
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
        // Store rating (in DB via saveCallerHistory or a separate update)
        if (cs.orgId) {
          try {
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl) {
              const sql = neon(dbUrl);
              // Find the latest conversation and add the rating
              await sql`UPDATE conversations SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('rating', ${rating}) WHERE organization_id = ${cs.orgId} ORDER BY created_at DESC LIMIT 1`;
            }
          } catch {}
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

// ── Get owner phone from DB ─────────────────────────────────────────────
async function getOwnerPhone(orgId: string): Promise<string | null> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return null;
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT phone FROM users
      WHERE organization_id = ${orgId} AND role = 'owner'
      LIMIT 1
    `;
    return rows[0]?.phone || null;
  } catch { return null; }
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

// ── Build SMS summary from call state ───────────────────────────────────
function buildCallSummary(cs: CallState, transcript?: string): string {
  const duration = Math.round((Date.now() - cs.startTime.getTime()) / 1000);
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  const dtmfStr = cs.dtmfHistory.length > 0 ? cs.dtmfHistory.join(" → ") : "none";
  const callerLabel = cs.callerFirstName ? `${cs.callerFirstName} (${cs.callerNumber})` : cs.callerNumber;
  const outcome = cs.appointmentBooked ? "Appointment booked" : cs.appointmentIntent ? "Appointment interest" : "General inquiry";

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
        }

        if (pathname === "/api/telnyx/voice" && req.method === "POST") {
          try {
            const p = await req.json();
            const ev = p.data?.event_type || "";
            const cid = p.data?.payload?.call_control_id || "";

            // ── New call: answer → language choice → speak → gather ───────
            if (ev === "call.initiated" || ev === "call_initiated") {
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
              calls.set(cid, {
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
              });

              await cmd(cid, "answer");
              setTimeout(async () => {
                await speakOnly(cid, `Welcome! For English, press 1. Para español, presione 2.`);
              }, 600);
            }

            // ── Recording saved (voicemail completed) ──────────────
            else if (ev === "call.recording.saved" || ev === "call.recording.saved") {
              const callSid = p.data?.payload?.call_session_id || p.data?.payload?.call_control_id || "";
              const recordingUrl = p.data?.payload?.recording_url || p.data?.payload?.public_recording_url || "";
              const duration = parseInt(p.data?.payload?.duration || "0", 10);
              const cs = calls.get(cid);
              if (cs && recordingUrl && cs.orgId) {
                await saveVoicemailRecording(callSid || cid, recordingUrl, duration, cs.orgId, cs.callerNumber);
                await notifyOwnerOfVoicemail(cs.orgId, cs.callerNumber, cs.toNumber, cs.language || "en");
                const es = (cs.language || "en") === "es";
                await speakOnly(cid, es
                  ? "Gracias. Recibimos su mensaje. Le contactaremos pronto. Adiós."
                  : "Thank you. We received your message. We'll get back to you shortly. Goodbye.", cs.language || "en");
                pendingHangups.add(cid);
              }
              return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
            }

            // ── Speak ended → gather or hangup ─────────────────────────
            else if (ev === "call.speak.ended") {
              if (pendingHangups.has(cid)) {
                pendingHangups.delete(cid);
                setTimeout(() => cmd(cid, "hangup"), 1500);
              } else {
                setTimeout(() => cmd(cid, "gather", {
                  type: "dtmf",
                  minimum_digits: 1,
                  maximum_digits: 1,
                  timeout_millis: 8000,
                }), 300);
              }
            }

            // ── DTMF pressed ───────────────────────────────────────
            else if (ev === "call.dtmf.received" || ev === "dtmf.received") {
              const digit = p.data?.payload?.digit || "";
              const toNumber = p.data?.payload?.to || "";
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
                  const greeting = isDemo
                    ? `Hello, this is a demo of ReceptionAI — an AI receptionist with a 14-day free trial. Press 1 for appointments, 2 for pricing, or 3 for call transfers.`
                    : buildGreeting(cs.orgName || "ReceptionAI", "en", cs.callerFirstName ? { firstName: cs.callerFirstName, previousVisits: 1 } as CallerContext : undefined);
                  await speakOnly(cid, greeting, "en");
                } else if (digit === "2") {
                  cs.language = "es";
                  cs.phase = "menu";
                  cs.answered = true; // caller interacted — mark as answered
                  const isDemo = !cs.orgId;
                  const greeting = isDemo
                    ? `Hola, esto es una demostración de ReceptionAI — con 14 días de prueba gratis. Presione 1 para citas, 2 para precios, o 3 para transferencias.`
                    : buildGreeting(cs.orgName || "ReceptionAI", "es", cs.callerFirstName ? { firstName: cs.callerFirstName, previousVisits: 1 } as CallerContext : undefined);
                  await speakOnly(cid, greeting, "es");
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

              // ── Menu phase ──────────────────────────────────────
              const lang = cs?.language || "en";
              const es = lang === "es";

              if (digit === "1") {
                if (cs) cs.appointmentIntent = true;
                const isDemo = !cs?.orgId;
                if (isDemo) {
                  await speakOnly(cid, es
                    ? "Esto es una demostración. En una cuenta real, revisaría el calendario y agendaría su cita. Visite nuestro sitio web para obtener su propio recepcionista IA."
                    : "This is a demo. In a live account, I would check the calendar and book your appointment. Visit our website to get your own AI receptionist.", lang);
                } else {
                  // Offer waitlist for real businesses
                  if (cs) { cs.phase = "waitlist"; }
                  await speakOnly(cid, es
                    ? "No hay citas disponibles en este momento. ¿Le gustaría unirse a la lista de espera? Le avisaremos cuando se abra un espacio. Presione 1 para sí, 2 para volver al menú."
                    : "No appointments available right now. Would you like to join the waitlist? We'll text you when a slot opens. Press 1 for yes, 2 to return to the menu.", lang);
                }
              }

              else if (digit === "2") {
                await speakOnly(cid, es
                  ? "Planes de ReceptionAI: Starter a $99 por mes, Growth a $199, y Scale a $399. Visite nuestro sitio web para registrarse."
                  : "ReceptionAI plans: Starter at $99 a month, Growth at $199, and Scale at $399. Visit our website to sign up.", lang);
              }

              else if (digit === "3") {
                const org = await getOrgByPhoneNumber(toNumber);
                const isDemo = !org;
                if (isDemo) {
                  await speakOnly(cid, es
                    ? "En una cuenta real, esto lo transferiría. Gracias por probar la demostración. Adiós."
                    : "In a live account, this would transfer you. Thanks for trying the demo. Goodbye.", lang);
                } else {
                  await speakOnly(cid, es
                    ? "Transfiriendo ahora. Por favor espere."
                    : "Transferring now. Please hold.", lang);
                }
                pendingHangups.add(cid);
              }

              else if (digit === "4") {
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
                await speakOnly(cid, es
                  ? "Déjeme verificar la disponibilidad. Tenemos citas disponibles de lunes a viernes de 9 AM a 5 PM. Visite nuestro sitio web para ver horarios específicos o presione 1 para agendar."
                  : "Let me check availability. We have appointments Monday through Friday 9 AM to 5 PM. Visit our website for specific times or press 1 to schedule.", lang);
              }

              else if (digit === "9") {
                // Voicemail recording
                if (cs) {
                  cs.answered = true;
                  cs.phase = "menu";
                }
                await startVoicemailRecording(cid, lang);
                if (cs?.orgId && cs?.callerNumber && cs?.toNumber) {
                  notifyOwnerOfVoicemail(cs.orgId, cs.callerNumber, cs.toNumber, lang);
                }
              }

              else {
                await speakOnly(cid, es
                  ? "Lo siento, no entendí. " + buildShortPrompt("es")
                  : "Sorry, I didn't get that. " + buildShortPrompt("en"), lang);
              }
            }

            // ── Gather ended (timeout, no DTMF) ─────────────────────
            else if (ev === "call.gather.ended") {
              const cs = calls.get(cid);
              // Handle reschedule/waitlist timeouts — return to menu
              if (cs?.phase?.startsWith("reschedule_") || cs?.phase === "waitlist") {
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
                  ? "Parece que tiene dificultades con el menú. Presione 1 para dejar un mensaje de voz, o espere para intentar de nuevo."
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

                // Generate AI transcript and send notifications
                const transcript = await generateCallTranscript(cs);
                const summary = buildCallSummary(cs, transcript);
                const outcome = cs.appointmentBooked ? "Appointment booked" : cs.appointmentIntent ? "Appointment interest" : "General inquiry";

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
    <Say voice="Polly.Joanna">Hello! Welcome to ${companyName}. Press 1 to book an appointment, press 2 for business hours, or press 0 to leave a message.</Say>
  </Gather>
  <Say voice="Polly.Joanna">Sorry, we did not receive your selection. Goodbye!</Say>
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
            const secKey = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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
                c.name as customer_name, c.phone as customer_phone, c.email as customer_email
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
            const secKey = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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

            // Get owner phone to call
            const ownerRow = await sql`
              SELECT phone FROM users WHERE organization_id = ${organizationId} AND role = 'owner'
              ORDER BY created_at ASC LIMIT 1
            `;
            const toNumber = ownerRow[0]?.phone || orgPhone;

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
            const authHeader = req.headers.get("Authorization") || "";
            const t = authHeader.replace("Bearer ", "");
            if (!t) {
              return new Response(JSON.stringify({ error: "Authentication required" }),
                { status: 401, headers: { "Content-Type": "application/json" } });
            }
            const { jwtVerify } = await import("jose");
            const secKey = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
            let payload: any;
            try { const r = await jwtVerify(t, new TextEncoder().encode(secKey)); payload = r.payload; }
            catch { return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { "Content-Type": "application/json" } }); }
            const organizationId = payload.organizationId as string;

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return new Response(JSON.stringify({ error: "DB not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
            const sql = neon(dbUrl);
            const url = new URL(req.url);
            const limit = parseInt(url.searchParams.get("limit") || "20", 10);
            const offset = parseInt(url.searchParams.get("offset") || "0", 10);

            const rows = await sql`
              SELECT c.id, c.organization_id, c.contact_id, c.type, c.status, c.direction,
                     c.started_at, c.ended_at, c.duration_seconds, c.ai_handled, c.escalated_to_human,
                     co.name as contact_name, co.phone as contact_phone, co.email as contact_email
              FROM conversations c
              LEFT JOIN contacts co ON c.contact_id = co.id
              WHERE c.organization_id = ${organizationId}
              ORDER BY c.started_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `;
            const totalRows = await sql`SELECT COUNT(*) as count FROM conversations WHERE organization_id = ${organizationId}`;

            return new Response(JSON.stringify({
              conversations: rows,
              total: Number(totalRows[0]?.count || 0),
              limit, offset,
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            console.error("[Conversations API]", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Failed to fetch conversations" }), { status: 500, headers: { "Content-Type": "application/json" } });
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
            const secKey = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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
            const secKey = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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
            const fallback = () => {
              if (msg.includes("price") || msg.includes("pricing") || msg.includes("cost") || msg.includes("precio") || msg.includes("costo")) {
                return isEs ? "Starter: $99/mes (1 linea, 500 min IA), Growth: $199/mes (2 lineas), Scale: $399/mes (ilimitado). Prueba gratis 14 dias." : "Starter: $99/mo (1 line, 500 AI-min), Growth: $199/mo (2 lines), Scale: $399/mo (unlimited). 14-day free trial.";
              }
              if (msg.includes("demo") || msg.includes("try") || msg.includes("probar")) {
                return isEs ? "Prueba nuestro recepcionista IA! Llama al (727) 966-7556 o registrate en receptionai.store/signup." : "Try our AI receptionist! Call (727) 966-7556 or sign up at receptionai.store/signup.";
              }
              if (msg.includes("feature") || msg.includes("what") || msg.includes("do") || msg.includes("funcion") || msg.includes("que hace")) {
                return isEs ? "Respondo llamadas 24/7, programo citas, envio recordatorios. Calendario incorporado (sin Google OAuth). Resumenes SMS al dueno." : "I answer calls 24/7, book appointments, send reminders. Built-in calendar (no Google OAuth). SMS summaries to the owner.";
              }
              if (msg.includes("signup") || msg.includes("register") || msg.includes("start") || msg.includes("registr")) {
                return isEs ? "Registrate en receptionai.store/signup — prueba gratis 14 dias, sin tarjeta." : "Sign up at receptionai.store/signup — 14-day free trial, no card needed.";
              }
              if (msg.includes("hi") || msg.includes("hello") || msg.includes("hey") || msg.includes("hola")) {
                return isEs ? "Hola! Soy ReceptionAI, atiendo llamadas y programo citas 24/7. En que puedo ayudarte?" : "Hi! I'm ReceptionAI — I answer calls and book appointments 24/7. How can I help?";
              }
              if (msg.includes("calendar") || msg.includes("schedule") || msg.includes("booking") || msg.includes("cita") || msg.includes("calendario")) {
                return isEs ? "Calendario incorporado sin Google OAuth. Tus clientes reservan por telefono, chat o SMS. Confirmaciones automaticas." : "Built-in calendar with no Google OAuth. Clients book via phone, chat, or SMS. Auto confirmations included.";
              }
              return isEs ? "Soy ReceptionAI — atiendo llamadas 24/7, programo citas, gestiono mensajes. Planes desde $99/mes con prueba gratis. Como puedo ayudarte?" : "I'm ReceptionAI — I handle calls 24/7, book appointments, manage messages. Plans from $99/mo with free trial. How can I help?";
            };
            if (apiKey) {
              try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 8000);
                const gRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
                  { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      system_instruction: { parts: [{ text: isEs ? "Recepcionista IA. Respuestas breves." : "AI receptionist. Brief responses." }] },
                      contents: [{ role: "user", parts: [{ text: message }] }],
                      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
                    }), signal: ctrl.signal },
                );
                clearTimeout(t);
                if (gRes.ok) {
                  const data = await gRes.json() as any;
                  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                  if (reply.trim()) {
                    return new Response(JSON.stringify({ reply: reply.trim() }),
                      { status: 200, headers: { "Content-Type": "application/json" } });
                  }
                }
              } catch { /* fall through */ }
            }
            return new Response(JSON.stringify({ reply: fallback() }),
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

            const sql = neon(dbUrl);
            const dayOfWeek = String(new Date(date).getDay());

            // Business hours
            const hoursRows = await sql`
              SELECT day_of_week, is_closed, open_time, close_time
              FROM business_hours WHERE organization_id = ${orgId} AND day_of_week = ${dayOfWeek}
              LIMIT 1
            `;
            const bh = hoursRows[0];
            if (!bh || bh.is_closed || !bh.open_time || !bh.close_time) {
              return new Response(JSON.stringify({ date, slots: [], closed: true }),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }

            // Holiday check
            const holiday = await sql`
              SELECT is_closed, open_time, close_time FROM holiday_overrides
              WHERE organization_id = ${orgId} AND date = ${date}::date LIMIT 1
            `;
            if (holiday[0]?.is_closed) {
              return new Response(JSON.stringify({ date, slots: [], closed: true, holiday: true }),
                { status: 200, headers: { "Content-Type": "application/json" } });
            }

            const openT = holiday[0]?.open_time || bh.open_time;
            const closeT = holiday[0]?.close_time || bh.close_time;

            // Existing appointments for this date
            const booked = await sql`
              SELECT start_time, end_time FROM appointments
              WHERE organization_id = ${orgId}
                AND status IN ('confirmed', 'scheduled')
                AND DATE(start_time) = ${date}::date
            `;

            // Generate slots
            const slots: any[] = [];
            const [oh, om] = openT.split(":").map(Number);
            const [ch, cm] = closeT.split(":").map(Number);
            let cur = oh * 60 + om;
            const endM = ch * 60 + cm;
            const buf = 15;

            while (cur + duration <= endM) {
              const st = `${String(Math.floor(cur/60)).padStart(2,"0")}:${String(cur%60).padStart(2,"0")}`;
              const et = `${String(Math.floor((cur+duration)/60)).padStart(2,"0")}:${String((cur+duration)%60).padStart(2,"0")}`;
              const slotStart = new Date(`${date}T${st}:00`);
              const slotEnd = new Date(`${date}T${et}:00`);

              const conflict = booked.some((b: any) => {
                const bs = new Date(new Date(b.start_time).getTime() - buf*60000);
                const be = new Date(new Date(b.end_time).getTime() + buf*60000);
                return slotStart < be && slotEnd > bs;
              });

              if (!conflict) slots.push({ date, time: st, endTime: et, available: true });
              cur += 30;
            }

            return new Response(JSON.stringify({ date, slots, total: slots.length }),
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
                const secret = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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
            const secret = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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
            const secKey = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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
              "subscription_data[trial_period_days]": "14",
              "discounts[0][coupon]": "FOUNDER50",
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
            const secret = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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
            const secret = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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
            const secKey = process.env.JWT_SECRET || "receptionai-dev-secret-change-in-production-min-32";
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
