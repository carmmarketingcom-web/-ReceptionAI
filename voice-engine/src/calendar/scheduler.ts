// ─── Appointment Scheduler ───────────────────────────────────────────────────
// Business logic for finding available time slots, handling business hours,
// buffer times, and holiday overrides.

import type { OrganizationConfig, BusinessHours } from "../types/index.ts";
import type { CalendarSlot, CalendarCredentials } from "./calendar.ts";
import { fetchEvents, createEvent, deleteEvent } from "./calendar.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HolidayOverride {
  date: string;  // YYYY-MM-DD
  isClosed: boolean;
  open?: string; // HH:MM
  close?: string; // HH:MM
  name?: string;  // e.g., "Christmas Day"
}

export interface SchedulerConfig {
  orgConfig: OrganizationConfig;
  holidays?: HolidayOverride[];
  bufferMinutes?: number; // Minutes between appointments (default: 15)
  slotDurationMinutes?: number; // Default appointment duration
  googleCredentials?: CalendarCredentials | null;
}

// ─── Main Scheduler ──────────────────────────────────────────────────────────

/**
 * Find available time slots for a given service on a specific date.
 */
export async function findAvailableSlots(
  config: SchedulerConfig,
  serviceName: string,
  date: string,
): Promise<CalendarSlot[]> {
  const {
    orgConfig,
    holidays = [],
    bufferMinutes = 15,
    slotDurationMinutes = 60,
    googleCredentials = null,
  } = config;

  // 1. Check if the date is a holiday
  const holiday = checkHoliday(date, holidays);
  if (holiday?.isClosed) {
    return [];
  }

  // 2. Get business hours for this day of week
  const dayOfWeek = new Date(date).getDay();
  const businessHours = getBusinessHours(orgConfig.businessHours, dayOfWeek);
  if (!businessHours || businessHours.isClosed) {
    return [];
  }

  // 3. Get the service duration
  const service = orgConfig.services.find(
    (s) => s.name.toLowerCase() === serviceName.toLowerCase(),
  );
  const durationMinutes = service?.durationMinutes || slotDurationMinutes;

  // 4. Get the time range based on holiday override or business hours
  const openTime = holiday?.open || businessHours.open;
  const closeTime = holiday?.close || businessHours.close;

  // 5. Fetch existing events (booked slots) from Google Calendar
  const bookedSlots = await getBookedSlots(
    googleCredentials,
    date,
    openTime,
    closeTime,
  );

  // 6. Generate all possible slots and filter out conflicts
  const allSlots = generateTimeSlots(
    date,
    openTime,
    closeTime,
    durationMinutes,
    bufferMinutes,
  );

  const availableSlots = allSlots.filter((slot) =>
    !isSlotBooked(slot, bookedSlots, bufferMinutes),
  );

  return availableSlots;
}

/**
 * Book an appointment: create a calendar event and return the event ID.
 */
export async function bookAppointmentSlot(
  config: SchedulerConfig,
  slot: CalendarSlot,
  customerName: string,
  customerPhone: string,
  customerEmail: string,
  serviceName: string,
  notes?: string,
): Promise<{ eventId: string; calendarUrl?: string }> {
  const { googleCredentials, orgConfig } = config;

  if (!googleCredentials) {
    // No calendar connected — return mock ID
    const mockId = `mock-${crypto.randomUUID()}`;
    console.log(`[Scheduler] Mock booking: ${customerName} - ${serviceName} at ${slot.date} ${slot.time}`);
    return { eventId: mockId };
  }

  const event = {
    summary: `${serviceName} - ${customerName}`,
    description: `Customer: ${customerName}\nPhone: ${customerPhone}\nEmail: ${customerEmail}${notes ? `\nNotes: ${notes}` : ""}`,
    start: {
      dateTime: `${slot.date}T${slot.time}:00`,
      timeZone: orgConfig.timezone,
    },
    end: {
      dateTime: `${slot.date}T${slot.endTime}:00`,
      timeZone: orgConfig.timezone,
    },
    attendees: customerEmail ? [{ email: customerEmail, displayName: customerName }] : undefined,
  };

  const created = await createEvent(googleCredentials, event);

  return {
    eventId: created.id,
    calendarUrl: `https://www.google.com/calendar/event?eid=${encodeURIComponent(created.id)}`,
  };
}

/**
 * Cancel an appointment by deleting the calendar event.
 */
export async function cancelAppointmentSlot(
  googleCredentials: CalendarCredentials | null,
  eventId: string,
): Promise<void> {
  if (!googleCredentials) return;
  await deleteEvent(googleCredentials, eventId);
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Check if a date matches a holiday override.
 */
function checkHoliday(
  date: string,
  holidays: HolidayOverride[],
): HolidayOverride | undefined {
  return holidays.find((h) => h.date === date);
}

/**
 * Get business hours for a specific day of the week.
 */
function getBusinessHours(
  hours: BusinessHours[],
  dayOfWeek: number,
): BusinessHours | undefined {
  return hours.find((h) => h.dayOfWeek === dayOfWeek);
}

/**
 * Fetch already-booked slots from the calendar.
 */
async function getBookedSlots(
  credentials: CalendarCredentials | null,
  date: string,
  openTime: string,
  closeTime: string,
): Promise<Array<{ start: string; end: string }>> {
  if (!credentials) return [];

  const timeMin = `${date}T${openTime}:00`;
  const timeMax = `${date}T${closeTime}:00`;

  try {
    const events = await fetchEvents(credentials, timeMin, timeMax);
    return events
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        start: e.start.dateTime,
        end: e.end.dateTime,
      }));
  } catch (err) {
    console.warn("[Scheduler] Failed to fetch booked slots:", err);
    return [];
  }
}

/**
 * Generate all possible time slots for a given time range.
 */
function generateTimeSlots(
  date: string,
  openTime: string,
  closeTime: string,
  durationMinutes: number,
  bufferMinutes: number,
): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  const [openHour, openMin] = openTime.split(":").map(Number);
  const [closeHour, closeMin] = closeTime.split(":").map(Number);

  let currentMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;

  while (currentMinutes + durationMinutes <= closeMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    const endMinutes = currentMinutes + durationMinutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;

    slots.push({
      date,
      time: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
      endTime: `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`,
      available: true,
    });

    currentMinutes += 30; // Slots every 30 minutes
  }

  return slots;
}

/**
 * Check if a slot conflicts with any booked slot.
 */
function isSlotBooked(
  slot: CalendarSlot,
  bookedSlots: Array<{ start: string; end: string }>,
  bufferMinutes: number,
): boolean {
  const slotStart = new Date(`${slot.date}T${slot.time}:00`).getTime();
  const slotEnd = new Date(`${slot.date}T${slot.endTime}:00`).getTime();
  const bufferMs = bufferMinutes * 60 * 1000;

  return bookedSlots.some((booked) => {
    const bookedStart = new Date(booked.start).getTime() - bufferMs;
    const bookedEnd = new Date(booked.end).getTime() + bufferMs;
    return slotStart < bookedEnd && slotEnd > bookedStart;
  });
}

/**
 * Get a readable list of available time strings for conversation use.
 */
export function formatAvailableSlots(slots: CalendarSlot[]): string {
  if (slots.length === 0) return "No available slots.";
  return slots
    .slice(0, 5) // Show top 5
    .map((s) => `${s.time} - ${s.endTime}`)
    .join(", ") + (slots.length > 5 ? ` and ${slots.length - 5} more` : "");
}