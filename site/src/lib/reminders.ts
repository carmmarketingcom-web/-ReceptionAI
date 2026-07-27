/**
 * Appointment Reminder System
 *
 * Schedules and sends automated SMS reminders for upcoming appointments.
 * Uses Telnyx SMS API for delivery and neon for DB persistence.
 *
 * Lifecycle:
 *   1. scheduleReminders() called when appointment is booked
 *      → inserts rows into appointment_reminders table
 *   2. Cron hits GET /api/reminders/process every 5 minutes
 *      → sends due reminders via Telnyx, updates status
 *   3. cancelReminders() cancels pending reminders if appointment is cancelled
 */

import { neon } from "@neondatabase/serverless";

// ─── Types ────────────────────────────────────────────────────────

export type ReminderType = "24h_before" | "2h_before" | "follow_up" | "no_show";

export interface ReminderPayload {
  appointmentId: string;
  organizationId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  service: string;
  date: string;    // YYYY-MM-DD
  time: string;    // HH:MM
  orgName: string;
  orgPhone: string; // From-number for SMS
}

// ─── Templates (bilingual) ────────────────────────────────────────

function formatDate(dateStr: string, lang: "en" | "es"): string {
  const [year, month, day] = dateStr.split("-");
  const months: Record<string, Record<string, string>> = {
    en: { "01":"January","02":"February","03":"March","04":"April","05":"May","06":"June",
          "07":"July","08":"August","09":"September","10":"October","11":"November","12":"December" },
    es: { "01":"enero","02":"febrero","03":"marzo","04":"abril","05":"mayo","06":"junio",
          "07":"julio","08":"agosto","09":"septiembre","10":"octubre","11":"noviembre","12":"diciembre" },
  };
  const m = months[lang]?.[month] || month;
  return lang === "es" ? `${parseInt(day)} de ${m} de ${year}` : `${m} ${parseInt(day)}, ${year}`;
}

function buildMessage(
  payload: ReminderPayload,
  type: ReminderType,
  lang: "en" | "es" = "en",
): string {
  const { customerName, service, date, time, orgName } = payload;
  const dateStr = formatDate(date, lang);

  const templates: Record<ReminderType, Record<"en" | "es", string>> = {
    "24h_before": {
      en: `Hi ${customerName}, reminder: you have an appointment at ${orgName} for ${service} tomorrow (${dateStr}) at ${time}. Reply CONFIRM to confirm or CANCEL to cancel.`,
      es: `Hola ${customerName}, recordatorio: tiene una cita en ${orgName} para ${service} mañana (${dateStr}) a las ${time}. Responda CONFIRMAR para confirmar o CANCELAR para cancelar.`,
    },
    "2h_before": {
      en: `Hi ${customerName}, your appointment at ${orgName} for ${service} is in 2 hours (${time}). See you soon!`,
      es: `Hola ${customerName}, su cita en ${orgName} para ${service} es en 2 horas (${time}). ¡Le esperamos!`,
    },
    "follow_up": {
      en: `Hi ${customerName}, we hope your ${service} appointment at ${orgName} went well! Rate your experience 1-5. Thank you!`,
      es: `Hola ${customerName}, esperamos que su cita de ${service} en ${orgName} haya sido excelente. Califique del 1-5. ¡Gracias!`,
    },
    "no_show": {
      en: `Hi ${customerName}, we missed you at ${orgName} for your ${service} on ${dateStr} at ${time}. Would you like to reschedule? Visit our site or reply to this message.`,
      es: `Hola ${customerName}, notamos que no pudo asistir a su cita en ${orgName} el ${dateStr}. ¿Le gustaría reprogramar? Visite nuestro sitio o responda.`,
    },
  };

  return templates[type][lang];
}

// ─── DB helper ────────────────────────────────────────────────────

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// ─── Schedule / Cancel ────────────────────────────────────────────

/**
 * Schedule all reminders for a newly booked appointment.
 * Called from the booking API endpoint.
 */
export async function scheduleReminders(payload: ReminderPayload): Promise<void> {
  const db = sql();
  const appointmentTime = new Date(`${payload.date}T${payload.time}:00`);

  const reminders: { type: ReminderType; scheduledAt: Date }[] = [
    { type: "24h_before", scheduledAt: new Date(appointmentTime.getTime() - 24 * 60 * 60 * 1000) },
    { type: "2h_before", scheduledAt: new Date(appointmentTime.getTime() - 2 * 60 * 60 * 1000) },
    { type: "follow_up", scheduledAt: new Date(appointmentTime.getTime() + 1 * 60 * 60 * 1000) },
  ];

  const now = new Date();
  const lang = "en"; // In production, load from org settings

  for (const r of reminders) {
    // Don't schedule past reminders
    if (r.scheduledAt <= now) continue;

    const messageBody = buildMessage(payload, r.type, lang);

    await db`
      INSERT INTO appointment_reminders
        (id, appointment_id, organization_id, reminder_type,
         scheduled_at, status, channel, recipient_phone,
         recipient_email, message_body)
      VALUES
        (gen_random_uuid(), ${payload.appointmentId}, ${payload.organizationId},
         ${r.type}, ${r.scheduledAt.toISOString()}, 'pending', 'sms',
         ${payload.customerPhone}, ${payload.customerEmail || null},
         ${messageBody})
    `;
  }

  // Update next_reminder_at on the appointment
  const nextReminder = await db`
    SELECT MIN(scheduled_at) as next_at
    FROM appointment_reminders
    WHERE appointment_id = ${payload.appointmentId}
      AND status = 'pending'
  `;

  if (nextReminder[0]?.next_at) {
    await db`
      UPDATE appointments
      SET next_reminder_at = ${nextReminder[0].next_at},
          updated_at = NOW()
      WHERE id = ${payload.appointmentId}
    `;
  }

  console.log(`[Reminders] Scheduled ${reminders.filter(r => r.scheduledAt > now).length} reminders for appointment ${payload.appointmentId}`);
}

/**
 * Cancel all pending reminders for an appointment.
 */
export async function cancelReminders(appointmentId: string): Promise<void> {
  const db = sql();
  await db`
    UPDATE appointment_reminders
    SET status = 'cancelled', updated_at = NOW()
    WHERE appointment_id = ${appointmentId}
      AND status = 'pending'
  `;

  await db`
    UPDATE appointments
    SET next_reminder_at = NULL, updated_at = NOW()
    WHERE id = ${appointmentId}
  `;

  console.log(`[Reminders] Cancelled all pending reminders for appointment ${appointmentId}`);
}
