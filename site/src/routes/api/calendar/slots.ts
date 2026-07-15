// ─── Calendar Slots API Route ─────────────────────────────────────────────────
// GET /api/calendar/slots
// Returns available appointment slots for a given date and service.

import { findAvailableSlots } from "../../../../voice-engine/src/calendar/scheduler.ts";
import { loadCredentials } from "../../../../voice-engine/src/calendar/calendar.ts";
import type { OrganizationConfig } from "../../../../voice-engine/src/types/index.ts";

export async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id") || "";
    const date = url.searchParams.get("date") || "";
    const service = url.searchParams.get("service") || "General Service";

    if (!orgId || !date) {
      return new Response(
        JSON.stringify({ error: "org_id and date are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: "date must be in YYYY-MM-DD format" }),
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
      services: [
        { name: "General Service", description: "Standard service appointment", durationMinutes: 60 },
        { name: service, description: service, durationMinutes: 60 },
      ],
      faqEntries: [],
      escalationPhone: "",
      calendarConfig: { provider: "internal" },
    };

    // Load Google Calendar credentials if connected
    const googleCredentials = await loadCredentials(orgId);

    // Find available slots
    const slots = await findAvailableSlots(
      { orgConfig, googleCredentials },
      service,
      date,
    );

    return new Response(
      JSON.stringify({
        date,
        service,
        slots,
        totalSlots: slots.length,
        timezone: orgConfig.timezone,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Calendar Slots] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch available slots" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}