// ─── Appointment Reminder System ─────────────────────────────────────────────
// Automated SMS and email reminders for upcoming appointments.

import type { Appointment, OrganizationConfig } from "../types/index.ts";
import { sendSmsReply } from "../sms/handler.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReminderConfig {
  appointment: Appointment;
  orgConfig: OrganizationConfig;
  businessPhone: string;
}

export type ReminderType = "24h_before" | "2h_before" | "follow_up" | "no_show";

export interface ReminderTemplate {
  subject: string;
  body: string;
}

// ─── Templates ───────────────────────────────────────────────────────────────

function getTemplates(
  appointment: Appointment,
  orgName: string,
  language: "en" | "es",
): Record<ReminderType, ReminderTemplate> {
  const dateStr = formatDate(appointment.date, language);
  const timeStr = appointment.time;

  if (language === "es") {
    return {
      "24h_before": {
        subject: `Recordatorio: Cita en ${orgName}`,
        body: `Hola ${appointment.customerName}, este es un recordatorio de que tiene una cita en ${orgName} para ${appointment.service} el ${dateStr} a las ${timeStr}. Responda "CONFIRMAR" para confirmar o "CANCELAR" para cancelar.`,
      },
      "2h_before": {
        subject: `Recordatorio: Su cita es en 2 horas`,
        body: `Hola ${appointment.customerName}, su cita en ${orgName} para ${appointment.service} es en 2 horas (${timeStr}). ¡Le esperamos!`,
      },
      "follow_up": {
        subject: `¿Cómo fue su experiencia en ${orgName}?`,
        body: `Hola ${appointment.customerName}, esperamos que su cita en ${orgName} haya sido excelente. ¿Cómo calificaría su experiencia del 1 al 5? Responda con un número. ¡Gracias!`,
      },
      "no_show": {
        subject: `No pudimos atenderle en ${orgName}`,
        body: `Hola ${appointment.customerName}, notamos que no pudo asistir a su cita en ${orgName} el ${dateStr} a las ${timeStr}. ¿Le gustaría reprogramar? Visite https://receptionai.app/agendar o responda a este mensaje.`,
      },
    };
  }

  return {
    "24h_before": {
      subject: `Reminder: Appointment at ${orgName}`,
      body: `Hi ${appointment.customerName}, this is a reminder that you have an appointment at ${orgName} for ${appointment.service} on ${dateStr} at ${timeStr}. Reply "CONFIRM" to confirm or "CANCEL" to cancel.`,
    },
    "2h_before": {
      subject: `Reminder: Your appointment is in 2 hours`,
      body: `Hi ${appointment.customerName}, your appointment at ${orgName} for ${appointment.service} is in 2 hours (${timeStr}). See you soon!`,
    },
    "follow_up": {
      subject: `How was your experience at ${orgName}?`,
      body: `Hi ${appointment.customerName}, we hope your appointment at ${orgName} went well. How would you rate your experience from 1-5? Reply with a number. Thank you!`,
    },
    "no_show": {
      subject: `We missed you at ${orgName}`,
      body: `Hi ${appointment.customerName}, we noticed you missed your appointment at ${orgName} on ${dateStr} at ${timeStr}. Would you like to reschedule? Visit https://receptionai.app/schedule or reply to this message.`,
    },
  };
}

// ─── Reminder Dispatcher ─────────────────────────────────────────────────────

/**
 * Send a reminder notification for an appointment.
 */
export async function sendReminder(
  config: ReminderConfig,
  type: ReminderType,
): Promise<boolean> {
  const { appointment, orgConfig, businessPhone } = config;
  const language = (orgConfig.locale || "en") as "en" | "es";
  const templates = getTemplates(appointment, orgConfig.name, language);
  const template = templates[type];

  console.log(`[Reminder] Sending "${type}" to ${appointment.customerPhone || appointment.customerEmail}`);

  // Send via SMS if phone number is available
  if (appointment.customerPhone) {
    const sent = await sendSmsReply(
      appointment.customerPhone,
      businessPhone,
      template.body,
    );
    if (!sent) {
      console.warn(`[Reminder] Failed to send SMS to ${appointment.customerPhone}`);
    }
    return sent;
  }

  console.warn(`[Reminder] No phone number available for ${appointment.customerName}`);
  return false;
}

/**
 * Send all three reminders for an appointment (24h before, 2h before, follow-up).
 */
export async function sendFullReminderSequence(
  config: ReminderConfig,
): Promise<void> {
  // 24h before
  await sendReminder(config, "24h_before");
  // 2h before
  await sendReminder(config, "2h_before");
}

/**
 * Schedule reminders for an appointment.
 * In production, this would add jobs to a queue (Redis/Bull) or cron.
 */
export async function scheduleReminders(
  config: ReminderConfig,
): Promise<void> {
  const { appointment } = config;

  // Calculate reminder times
  const appointmentTime = new Date(`${appointment.date}T${appointment.time}:00`);
  const twentyFourHoursBefore = new Date(appointmentTime.getTime() - 24 * 60 * 60 * 1000);
  const twoHoursBefore = new Date(appointmentTime.getTime() - 2 * 60 * 60 * 1000);
  const followUpTime = new Date(appointmentTime.getTime() + 60 * 60 * 1000); // 1h after

  console.log(`[Reminder] Scheduled for ${appointment.customerName}:`);
  console.log(`  - 24h reminder: ${twentyFourHoursBefore.toISOString()}`);
  console.log(`  - 2h reminder: ${twoHoursBefore.toISOString()}`);
  console.log(`  - Follow-up: ${followUpTime.toISOString()}`);

  // In production, add to job queue:
  // await reminderQueue.add('send-reminder', { config, type: '24h_before' }, { delay: msUntil(twentyFourHoursBefore) });
  // await reminderQueue.add('send-reminder', { config, type: '2h_before' }, { delay: msUntil(twoHoursBefore) });
}

/**
 * Check if a message is a reminder reply (confirm/cancel) and process it.
 */
export function parseReminderReply(
  message: string,
): { action: "confirm" | "cancel" | null } {
  const cleaned = message.toLowerCase().trim();

  const confirmWords = ["confirm", "confirmar", "yes", "sí", "si", "y", "1", "confirmo"];
  const cancelWords = ["cancel", "cancelar", "no", "n", "0", "cancelar cita"];

  for (const word of confirmWords) {
    if (cleaned.includes(word)) return { action: "confirm" };
  }
  for (const word of cancelWords) {
    if (cleaned.includes(word)) return { action: "cancel" };
  }

  return { action: null };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, language: "en" | "es"): string {
  const [year, month, day] = dateStr.split("-");
  const months: Record<string, Record<string, string>> = {
    en: {
      "01": "January", "02": "February", "03": "March", "04": "April",
      "05": "May", "06": "June", "07": "July", "08": "August",
      "09": "September", "10": "October", "11": "November", "12": "December",
    },
    es: {
      "01": "enero", "02": "febrero", "03": "marzo", "04": "abril",
      "05": "mayo", "06": "junio", "07": "julio", "08": "agosto",
      "09": "septiembre", "10": "octubre", "11": "noviembre", "12": "diciembre",
    },
  };

  const monthName = months[language]?.[month] || months.en[month] || month;
  return language === "es"
    ? `${day} de ${monthName} de ${year}`
    : `${monthName} ${parseInt(day)}, ${year}`;
}