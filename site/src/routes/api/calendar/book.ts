// ─── Calendar Book API Route ──────────────────────────────────────────────────
// POST /api/calendar/book
// Books an appointment: creates a calendar event and schedules reminders.

import { bookAppointmentSlot } from "../../../../voice-engine/src/calendar/scheduler.ts";
import { loadCredentials } from "../../../../voice-engine/src/calendar/calendar.ts";
import { scheduleReminders } from "../../../../voice-engine/src/calendar/reminders.ts";
import type { OrganizationConfig } from "../../../../voice-engine/src/types/index.ts";

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json() as {
      orgId?: string;
      date?: string;
      time?: string;
      endTime?: string;
      service?: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      notes?: string;
    };

    const {
      orgId = "",
      date = "",
      time = "",
      service = "General Service",
      customerName = "",
      customerPhone = "",
      customerEmail = "",
      notes = "",
    } = body;

    // Validate required fields
    if (!orgId || !date || !time || !customerName || !customerPhone) {
      return new Response(
        JSON.stringify({
          error: "orgId, date, time, customerName, and customerPhone are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // In production, load org config from DB
    const orgConfig: OrganizationConfig = {
      id: orgId,
      name: "Your Business",
      industry: "Service",
      businessHours: [
        { dayOfWeek: 1, open: "09:00", close: "17:00", isClosed: false },
        { dayOfWeek: 2, open: "09:00", close: "17:00", isClosed: false },
        { dayOfWeek: 3, open: "09:00", close: "17:00", isClosed: false },
        { dayOfWeek: 4, open: "09:00", close: "17:00", isClosed: false },
        { dayOfWeek: 5, open: "09:00", close: "17:00", isClosed: false },
        { dayOfWeek: 6, open: "09:00", close: "17:00", isClosed: false },
        { dayOfWeek: 0, open: "00:00", close: "00:00", isClosed: true },
      ],
      timezone: "America/Chicago",
      locale: "en",
      services: [{ name: service, description: service, durationMinutes: 60 }],
      faqEntries: [],
      escalationPhone: process.env.BUSINESS_PHONE || "",
      calendarConfig: { provider: "internal" },
    };

    // Calculate end time (default 60 min duration)
    const durationMinutes = 60;
    const [hour, min] = time.split(":").map(Number);
    const endMinutes = hour * 60 + min + durationMinutes;
    const endTime = body.endTime || `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    // Load Google Calendar credentials
    const googleCredentials = await loadCredentials(orgId);

    // Book the appointment
    const result = await bookAppointmentSlot(
      { orgConfig, googleCredentials },
      { date, time, endTime, available: true },
      customerName,
      customerPhone,
      customerEmail,
      service,
      notes,
    );

    // Schedule reminders
    await scheduleReminders({
      appointment: {
        id: result.eventId,
        organizationId: orgId,
        customerName,
        customerPhone,
        customerEmail,
        service,
        date,
        time,
        durationMinutes: 60,
        status: "confirmed",
        source: "chat",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      orgConfig,
      businessPhone: process.env.TWILIO_PHONE_NUMBER || "",
    });

    return new Response(
      JSON.stringify({
        success: true,
        appointment: {
          id: result.eventId,
          customerName,
          service,
          date,
          time,
          endTime,
          calendarUrl: result.calendarUrl,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Calendar Book] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to book appointment" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}