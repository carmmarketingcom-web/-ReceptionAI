
// ─── Reminders Send API Route ─────────────────────────────────────────────────
// POST /api/reminders/send
// Triggers a reminder for an appointment (used by cron job or manual trigger).

import { sendReminder, parseReminderReply } from "../../../../voice-engine/src/calendar/reminders.ts";
import type { OrganizationConfig } from "../../../../voice-engine/src/types/index.ts";

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json() as {
      orgId?: string;
      appointmentId?: string;
      reminderType?: "24h_before" | "2h_before" | "follow_up" | "no_show";
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      service?: string;
      date?: string;
      time?: string;
    };

    const {
      orgId = "",
      appointmentId = "",
      reminderType = "24h_before",
      customerName = "",
      customerPhone = "",
      customerEmail = "",
      service = "General Service",
      date = "",
      time = "",
    } = body;

    if (!orgId || !customerPhone || !date) {
      return new Response(
        JSON.stringify({ error: "orgId, customerPhone, and date are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const orgConfig: OrganizationConfig = {
      id: orgId,
      name: "Your Business",
      industry: "Service",
      businessHours: [],
      timezone: "America/Chicago",
      locale: "en",
      services: [],
      faqEntries: [],
      escalationPhone: "",
      calendarConfig: { provider: "internal" },
    };

    const sent = await sendReminder(
      {
        appointment: {
          id: appointmentId || crypto.randomUUID(),
          organizationId: orgId,
          customerName,
          customerPhone,
          customerEmail,
          service,
          date,
          time,
          durationMinutes: 60,
          status: "confirmed",
          source: "voice",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        orgConfig,
        businessPhone: process.env.TWILIO_PHONE_NUMBER || "",
      },
      reminderType,
    );

    return new Response(
      JSON.stringify({
        success: sent,
        reminderType,
        customerPhone,
        message: sent ? "Reminder sent successfully" : "Failed to send reminder",
      }),
      { status: sent ? 200 : 500, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Reminders Send] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send reminder" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// GET /api/reminders/send?text=... (for handling SMS replies like "CONFIRM" / "CANCEL")
export async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const text = url.searchParams.get("text") || "";

    if (!text) {
      return new Response(
        JSON.stringify({ error: "text parameter is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = parseReminderReply(text);

    if (result.action === "confirm") {
      return new Response(
        JSON.stringify({ action: "confirm", message: "Appointment confirmed. Thank you!" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (result.action === "cancel") {
      return new Response(
        JSON.stringify({ action: "cancel", message: "Appointment cancelled. We'll contact you to reschedule." }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ action: null, message: "No action detected. Reply CONFIRM or CANCEL." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Reminders Parse] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to parse reminder reply" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}