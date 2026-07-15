// ─── Google Calendar Integration ──────────────────────────────────────────────
// OAuth2 flow, CRUD operations, and availability checking for Google Calendar.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  status?: "confirmed" | "cancelled";
}

export interface CalendarSlot {
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  endTime: string;    // HH:MM
  available: boolean;
}

export interface CalendarCredentials {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  calendarId: string; // Typically "primary"
}

// ─── OAuth2 Configuration ────────────────────────────────────────────────────

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

function getOAuth2Client(clientId?: string, clientSecret?: string) {
  const cid = clientId || process.env.GOOGLE_CLIENT_ID;
  const cs = clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  if (!cid || !cs) {
    throw new Error("Google Calendar OAuth2 credentials not configured");
  }
  return { clientId: cid, clientSecret: cs };
}

/**
 * Generate the Google OAuth2 authorization URL.
 */
export function getAuthUrl(
  orgId: string,
  redirectUri: string,
): string {
  const { clientId } = getOAuth2Client();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: orgId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<CalendarCredentials> {
  const { clientId, clientSecret } = getOAuth2Client();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OAuth token exchange failed: ${err}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    expiryDate: Date.now() + data.expires_in * 1000,
    calendarId: "primary",
  };
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(
  credentials: CalendarCredentials,
): Promise<CalendarCredentials> {
  const { clientId, clientSecret } = getOAuth2Client();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: credentials.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await response.json() as {
    access_token: string;
    expires_in: number;
  };

  return {
    ...credentials,
    accessToken: data.access_token,
    expiryDate: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Ensure the access token is valid, refreshing if needed.
 */
async function ensureValidToken(
  credentials: CalendarCredentials,
): Promise<CalendarCredentials> {
  if (Date.now() >= credentials.expiryDate - 60000) {
    // Expiring within 1 minute, refresh
    return refreshAccessToken(credentials);
  }
  return credentials;
}

// ─── Calendar API Calls ──────────────────────────────────────────────────────

/**
 * Fetch booked events from Google Calendar for a given time range.
 */
export async function fetchEvents(
  credentials: CalendarCredentials,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  const valid = await ensureValidToken(credentials);

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(valid.calendarId)}/events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${valid.accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch calendar events: ${err}`);
  }

  const data = await response.json() as { items?: GoogleCalendarEvent[] };
  return data.items || [];
}

/**
 * Create a calendar event in Google Calendar.
 */
export async function createEvent(
  credentials: CalendarCredentials,
  event: Omit<GoogleCalendarEvent, "id">,
): Promise<GoogleCalendarEvent> {
  const valid = await ensureValidToken(credentials);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(valid.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${valid.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create calendar event: ${err}`);
  }

  return response.json() as Promise<GoogleCalendarEvent>;
}

/**
 * Update an existing calendar event.
 */
export async function updateEvent(
  credentials: CalendarCredentials,
  eventId: string,
  event: Partial<GoogleCalendarEvent>,
): Promise<GoogleCalendarEvent> {
  const valid = await ensureValidToken(credentials);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(valid.calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${valid.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to update calendar event: ${err}`);
  }

  return response.json() as Promise<GoogleCalendarEvent>;
}

/**
 * Delete (cancel) a calendar event.
 */
export async function deleteEvent(
  credentials: CalendarCredentials,
  eventId: string,
): Promise<void> {
  const valid = await ensureValidToken(credentials);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(valid.calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${valid.accessToken}`,
      },
    },
  );

  if (!response.ok && response.status !== 404) {
    const err = await response.text();
    throw new Error(`Failed to delete calendar event: ${err}`);
  }
}

/**
 * Store calendar credentials for an organization (in production, save to DB).
 */
export async function storeCredentials(
  orgId: string,
  credentials: CalendarCredentials,
): Promise<void> {
  // In production, encrypt and store in PostgreSQL:
  // await db.insert(orgCalendarTokens).values({
  //   organizationId: orgId,
  //   provider: 'google',
  //   accessToken: encrypt(credentials.accessToken),
  //   refreshToken: encrypt(credentials.refreshToken),
  //   expiryDate: new Date(credentials.expiryDate),
  //   calendarId: credentials.calendarId,
  // });
  console.log(`[Calendar] Stored credentials for org ${orgId}`);
}

/**
 * Load calendar credentials for an organization (in production, fetch from DB).
 */
export async function loadCredentials(
  orgId: string,
): Promise<CalendarCredentials | null> {
  // In production, fetch from PostgreSQL:
  // const row = await db.query.orgCalendarTokens.findFirst({
  //   where: eq(orgCalendarTokens.organizationId, orgId),
  // });
  // if (!row) return null;
  // return {
  //   accessToken: decrypt(row.accessToken),
  //   refreshToken: decrypt(row.refreshToken),
  //   expiryDate: row.expiryDate.getTime(),
  //   calendarId: row.calendarId,
  // };

  // For now, try env vars
  const token = process.env.GOOGLE_CALENDAR_TEST_TOKEN;
  if (!token) return null;
  return {
    accessToken: token,
    refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || "",
    expiryDate: Date.now() + 3600000,
    calendarId: "primary",
  };
}