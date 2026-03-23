/**
 * Google Calendar Sync Integration
 *
 * Provides helpers to create, update, and delete Google Calendar events
 * for clinic appointments. Uses the Google Calendar API v3.
 *
 * Requires:
 *   GOOGLE_CALENDAR_CLIENT_ID
 *   GOOGLE_CALENDAR_CLIENT_SECRET
 *   GOOGLE_CALENDAR_REDIRECT_URI
 */

// ---- Types ----

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { email: string; displayName?: string }[];
  reminders?: {
    useDefault: boolean;
    overrides?: { method: "email" | "popup"; minutes: number }[];
  };
}

export interface CalendarTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ---- OAuth Flow ----

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Generate the Google OAuth2 authorization URL for calendar access.
 */
export function getAuthUrl(state?: string): string {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Google Calendar OAuth not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    ...(state ? { state } : {}),
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<CalendarTokens> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Calendar OAuth not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "Failed to exchange code");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<CalendarTokens> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar OAuth not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "Failed to refresh token");
  }

  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Ensure we have a valid access token, refreshing if needed.
 */
async function getValidToken(tokens: CalendarTokens): Promise<CalendarTokens> {
  if (Date.now() < tokens.expiresAt - 60000) {
    return tokens;
  }
  return refreshAccessToken(tokens.refreshToken);
}

// ---- Calendar Operations ----

/**
 * Create a Google Calendar event from an appointment.
 */
export async function createCalendarEvent(
  tokens: CalendarTokens,
  event: CalendarEvent,
  calendarId = "primary",
): Promise<CalendarEvent & { id: string }> {
  const validTokens = await getValidToken(tokens);

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validTokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to create calendar event");
  }

  return data;
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateCalendarEvent(
  tokens: CalendarTokens,
  eventId: string,
  event: Partial<CalendarEvent>,
  calendarId = "primary",
): Promise<CalendarEvent> {
  const validTokens = await getValidToken(tokens);

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${validTokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to update calendar event");
  }

  return data;
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteCalendarEvent(
  tokens: CalendarTokens,
  eventId: string,
  calendarId = "primary",
): Promise<void> {
  const validTokens = await getValidToken(tokens);

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${validTokens.accessToken}`,
      },
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error("Failed to delete calendar event");
  }
}

/**
 * Convert an appointment to a Google Calendar event.
 */
export function appointmentToCalendarEvent(appointment: {
  id: string;
  patientName: string;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  notes?: string;
  clinicName?: string;
  clinicAddress?: string;
  timeZone?: string;
}): CalendarEvent {
  const timeZone = appointment.timeZone ?? "Africa/Casablanca";

  return {
    summary: `${appointment.type} - ${appointment.patientName}`,
    description: [
      `Patient: ${appointment.patientName}`,
      `Doctor: ${appointment.doctorName}`,
      `Type: ${appointment.type}`,
      appointment.notes ? `Notes: ${appointment.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    location: appointment.clinicAddress,
    start: {
      dateTime: `${appointment.date}T${appointment.startTime}:00`,
      timeZone,
    },
    end: {
      dateTime: `${appointment.date}T${appointment.endTime}:00`,
      timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "email", minutes: 120 },
      ],
    },
  };
}
