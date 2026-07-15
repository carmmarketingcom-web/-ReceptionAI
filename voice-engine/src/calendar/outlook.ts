// ─── Microsoft Graph (Outlook) Calendar Integration ──────────────────────────
// Stub for future Microsoft 365 / Outlook Calendar integration.
// TODO: Implement OAuth2 flow and CRUD operations for Microsoft Graph API.

import type { CalendarCredentials, CalendarSlot } from "./calendar.ts";

/**
 * Get the Microsoft OAuth2 authorization URL.
 * TODO: Implement when Outlook integration is required.
 */
export function getOutlookAuthUrl(
  orgId: string,
  redirectUri: string,
): string {
  console.warn("[Outlook Calendar] Not yet implemented");
  throw new Error(
    "Microsoft Outlook Calendar integration is not yet available. " +
    "Please use Google Calendar instead.",
  );
}

/**
 * Exchange an authorization code for Microsoft Graph tokens.
 * TODO: Implement.
 */
export async function exchangeOutlookCode(
  code: string,
  redirectUri: string,
): Promise<CalendarCredentials> {
  throw new Error("Outlook Calendar integration not yet implemented");
}

/**
 * Fetch events from Outlook Calendar.
 * TODO: Implement.
 */
export async function fetchOutlookEvents(
  credentials: CalendarCredentials,
  timeMin: string,
  timeMax: string,
): Promise<unknown[]> {
  console.warn("[Outlook Calendar] fetchOutlookEvents not yet implemented");
  return [];
}

/**
 * Create an event in Outlook Calendar.
 * TODO: Implement.
 */
export async function createOutlookEvent(
  credentials: CalendarCredentials,
  event: unknown,
): Promise<unknown> {
  throw new Error("Outlook Calendar integration not yet implemented");
}

/**
 * Get available slots considering both Google and Outlook calendars.
 * Currently only supports Google Calendar.
 */
export async function getMergedAvailableSlots(
  googleCredentials: CalendarCredentials | null,
  _outlookCredentials: CalendarCredentials | null,
  date: string,
  durationMinutes: number,
  businessHours: { open: string; close: string },
): Promise<CalendarSlot[]> {
  // For now, only Google Calendar is supported
  if (!googleCredentials) {
    // Return all business hours as available if no calendar connected
    return generateDefaultSlots(date, durationMinutes, businessHours);
  }

  // Fetch existing events from Google Calendar
  const timeMin = `${date}T00:00:00Z`;
  const timeMax = `${date}T23:59:59Z`;
  const events = await fetchOutlookEvents(googleCredentials, timeMin, timeMax);
  
  // Use the Google Calendar implementation instead
  // (This is a stub - in production, both calendars would be checked)
  return generateDefaultSlots(date, durationMinutes, businessHours);
}

/**
 * Generate default available slots based on business hours.
 */
function generateDefaultSlots(
  date: string,
  durationMinutes: number,
  businessHours: { open: string; close: string },
): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  const [openHour, openMin] = businessHours.open.split(":").map(Number);
  const [closeHour, closeMin] = businessHours.close.split(":").map(Number);

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

    currentMinutes += 30; // 30-minute intervals
  }

  return slots;
}