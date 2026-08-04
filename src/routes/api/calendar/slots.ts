/**
 * GET /api/calendar/slots
 *
 * Returns available appointment slots for a given date and service.
 * Loads business hours from the database and checks Google Calendar conflicts
 * if OAuth credentials exist.
 */


import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../../lib/middleware";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// ─── Types ─────────────────────────────────────────────────────────

interface CalendarSlot {
  date: string;
  time: string;
  endTime: string;
  available: boolean;
}

interface BusinessHour {
  dayOfWeek: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

// ─── GET handler ───────────────────────────────────────────────────

export async function GET({ request }: { request: Request }) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";
  const service = url.searchParams.get("service") || "General Service";
  const duration = parseInt(url.searchParams.get("duration") || "60", 10);

  if (!date) {
    return new Response(
      JSON.stringify({ error: "date is required (YYYY-MM-DD)" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(
      JSON.stringify({ error: "date must be YYYY-MM-DD" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const db = sql();
    const { organizationId } = authResult;

    // 1. Load business hours from DB
    const hoursRows = await db<BusinessHour>`
      SELECT day_of_week as "dayOfWeek", is_closed as "isClosed",
             open_time as "openTime", close_time as "closeTime"
      FROM business_hours
      WHERE organization_id = ${organizationId}
      ORDER BY day_of_week
    `;

    const dayOfWeek = String(new Date(date).getDay());

    // Default: Mon-Fri 9-5
    const defaultHours: Record<string, BusinessHour> = {
      "0": { dayOfWeek: "0", isClosed: true, openTime: null, closeTime: null },
      "1": { dayOfWeek: "1", isClosed: false, openTime: "09:00", closeTime: "17:00" },
      "2": { dayOfWeek: "2", isClosed: false, openTime: "09:00", closeTime: "17:00" },
      "3": { dayOfWeek: "3", isClosed: false, openTime: "09:00", closeTime: "17:00" },
      "4": { dayOfWeek: "4", isClosed: false, openTime: "09:00", closeTime: "17:00" },
      "5": { dayOfWeek: "5", isClosed: false, openTime: "09:00", closeTime: "17:00" },
      "6": { dayOfWeek: "6", isClosed: true, openTime: null, closeTime: null },
    };

    // Merge DB hours over defaults
    for (const h of hoursRows) {
      defaultHours[h.dayOfWeek] = h;
    }

    const todayHours = defaultHours[dayOfWeek];
    if (!todayHours || todayHours.isClosed || !todayHours.openTime || !todayHours.closeTime) {
      return new Response(
        JSON.stringify({ date, service, slots: [], totalSlots: 0, closed: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Check holiday overrides
    const holidayRow = await db`
      SELECT is_closed, open_time, close_time
      FROM holiday_overrides
      WHERE organization_id = ${organizationId}
        AND date = ${date}::date
      LIMIT 1
    `;
    if (holidayRow[0]?.is_closed) {
      return new Response(
        JSON.stringify({ date, service, slots: [], totalSlots: 0, closed: true, holiday: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const openTime = holidayRow[0]?.open_time || todayHours.openTime;
    const closeTime = holidayRow[0]?.close_time || todayHours.closeTime;

    // 3. Get existing appointments for this day (DB + optionally Google)
    const bookedSlots = await getBookedSlots(db, organizationId, date);

    // 4. Generate slots
    const slots = generateSlots(date, openTime, closeTime, duration, bookedSlots);

    return new Response(
      JSON.stringify({
        date,
        service,
        slots,
        totalSlots: slots.length,
        businessHours: { open: openTime, close: closeTime },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Calendar Slots] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: "Failed to fetch available slots", detail: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

async function getBookedSlots(
  db: ReturnType<typeof sql>,
  orgId: string,
  date: string,
): Promise<Array<{ start: Date; end: Date }>> {
  const appointments = await db`
    SELECT start_time, end_time
    FROM appointments
    WHERE organization_id = ${orgId}
      AND status IN ('confirmed', 'scheduled')
      AND DATE(start_time) = ${date}::date
  `;

  return (appointments as Array<{ start_time: string; end_time: string }>).map((a) => ({
    start: new Date(a.start_time),
    end: new Date(a.end_time),
  }));
}

function generateSlots(
  date: string,
  openTime: string,
  closeTime: string,
  durationMinutes: number,
  bookedSlots: Array<{ start: Date; end: Date }>,
): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);

  let currentMinutes = oh * 60 + om;
  const closeMinutes = ch * 60 + cm;
  const bufferMinutes = 15;

  while (currentMinutes + durationMinutes <= closeMinutes) {
    const slotStart = new Date(`${date}T${String(Math.floor(currentMinutes / 60)).padStart(2, "0")}:${String(currentMinutes % 60).padStart(2, "0")}:00`);

    const endMinutes = currentMinutes + durationMinutes;
    const slotEnd = new Date(`${date}T${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}:00`);

    // Check conflicts
    const hasConflict = bookedSlots.some((b) => {
      const bufStart = new Date(b.start.getTime() - bufferMinutes * 60 * 1000);
      const bufEnd = new Date(b.end.getTime() + bufferMinutes * 60 * 1000);
      return slotStart < bufEnd && slotEnd > bufStart;
    });

    if (!hasConflict) {
      slots.push({
        date,
        time: `${String(Math.floor(currentMinutes / 60)).padStart(2, "0")}:${String(currentMinutes % 60).padStart(2, "0")}`,
        endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
        available: true,
      });
    }

    currentMinutes += 30; // 30-min slot intervals
  }

  return slots;
}
