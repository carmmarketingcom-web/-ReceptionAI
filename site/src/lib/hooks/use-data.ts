/**
 * React hooks for fetching dashboard data from the ReceptionAI API.
 * Each hook handles loading, error, and empty states.
 * Falls back to mock data when the API returns empty (demo mode).
 */

import { useState, useEffect, useCallback } from "react";
import { api } from "../api-client";

// ─── Generic hook factory ─────────────────────────────────────────────────

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useApiData<T>(
  path: string | (() => string | null),
  mockFallback?: T
): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  // Compute the URL outside the effect so the dependency array below can
  // reference it — declaring it inside the effect body left `[url, trigger]`
  // referring to an out-of-scope variable, throwing `ReferenceError: url is
  // not defined` on every hook render (strict-mode ES module).
  const url = typeof path === "function" ? path() : path;

  useEffect(() => {
    let cancelled = false;

    if (!url) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    api
      .get<T>(url)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          // If API fails, use mock fallback if available
          if (mockFallback) {
            setData(mockFallback);
            setError(null); // Don't show error on fallback
          } else {
            setError(err instanceof Error ? err.message : "Failed to load data");
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, trigger]);

  return { data, loading, error, refetch };
}

// ─── Conversations ────────────────────────────────────────────────────────

export interface ConversationItem {
  id: string;
  organizationId?: string;
  channel?: string;
  language?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  messageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  summary?: string;
  // Legacy mock fields
  customerInitials?: string;
  status?: string;
  duration?: string;
  timestamp?: string;
  date?: string;
}

interface ConversationsResponse {
  conversations: ConversationItem[];
  total: number;
  limit: number;
  offset: number;
}

export function useConversations(limit = 20, offset = 0) {
  return useApiData<ConversationsResponse>(
    `/api/conversations?limit=${limit}&offset=${offset}`
  );
}

// ─── Missed Calls ─────────────────────────────────────────────────────────
// Real rows only: /api/missed-calls reads the missed_calls table for the signed-in
// organization. There is deliberately NO mock/demo fallback here — an empty list is the
// honest answer when nothing has been recorded. Voicemail audio/transcription is not
// captured yet, so those fields render as "Not available" instead of invented text.

export interface MissedCallItem {
  id: string;
  callerNumber: string | null;
  callerName: string | null;
  ringDurationSeconds: number | null;
  callbackRequested: boolean;
  callbackStatus: string;
  voicemailUrl: string | null;
  voicemailTranscription: string | null;
  createdAt: string | null;
}

interface MissedCallsResponse {
  missedCalls: MissedCallItem[];
  total: number;
  limit: number;
}

export function useMissedCalls(limit = 100) {
  return useApiData<MissedCallsResponse>(`/api/missed-calls?limit=${limit}`);
}

export function updateMissedCallCallback(id: string, callbackStatus: string) {
  return api.patch<{ id: string; callbackStatus: string }>("/api/missed-calls", {
    id,
    callbackStatus,
  });
}

// ─── Team ─────────────────────────────────────────────────────────────────
// Real accounts only: /api/users reads the users table for the signed-in
// organization. There is deliberately NO mock/demo fallback here — an empty
// list is the honest answer, never an invented teammate. The schema has no
// presence/online field, so the page shows is_active plus last sign-in.
export interface TeamMemberItem {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}
interface TeamResponse {
  users: TeamMemberItem[];
  total: number;
}
export function useTeamMembers() {
  return useApiData<TeamResponse>("/api/users");
}
// ─── Recordings ───────────────────────────────────────────────────────────
// Real rows only: /api/recordings reads the recordings table for the signed-in
// organization. Nothing writes that table yet (voicemail audio capture is a
// Phase-2 gap), so this is normally empty and the page says so — no invented
// audio, caller names, or AI summaries.
export interface RecordingItem {
  id: string;
  conversationId: string | null;
  callerName: string | null;
  callerNumber: string | null;
  recordingUrl: string | null;
  audioAvailable?: boolean;
  durationSeconds: number | null;
  transcriptionText: string | null;
  transcriptionStatus: string | null;
  createdAt: string | null;
}
interface RecordingsResponse {
  recordings: RecordingItem[];
  total: number;
  limit: number;
}
export function useRecordings(limit = 100) {
  return useApiData<RecordingsResponse>(`/api/recordings?limit=${limit}`);
}
// ─── Follow-up campaigns ──────────────────────────────────────────────────
// Real rows only: /api/follow-up-campaigns reads the follow_up_campaigns table.
// The follow-up engine is not built yet, so the table has no writers and the
// list is empty. No mock fallback: fake campaign stats (sent/opened/replied)
// exist nowhere and must never be rendered.
export interface FollowUpCampaignItem {
  id: string;
  name: string | null;
  description: string | null;
  triggerEvent: string | null;
  delayMinutes: number | null;
  maxAttempts: number | null;
  intervalMinutes: number | null;
  channels: string[];
  language: string | null;
  isActive: boolean;
  createdAt: string | null;
}
interface FollowUpCampaignsResponse {
  campaigns: FollowUpCampaignItem[];
  total: number;
}
export function useFollowUpCampaigns() {
  return useApiData<FollowUpCampaignsResponse>("/api/follow-up-campaigns");
}
// ─── Appointments ─────────────────────────────────────────────────────────

export interface AppointmentItem {
  id: string;
  contactId?: string;
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string;
  status?: string;
  serviceType?: string | null;
  staffAssignedId?: string | null;
  location?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AppointmentsResponse {
  appointments: AppointmentItem[];
  total: number;
  limit: number;
}

export function useAppointments(params?: { status?: string; start?: string; end?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.start) searchParams.set("start", params.start);
  if (params?.end) searchParams.set("end", params.end);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return useApiData<AppointmentsResponse>(
    `/api/appointments${qs ? `?${qs}` : ""}`
  );
}

// ─── Contacts ─────────────────────────────────────────────────────────────

export interface ContactItem {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  totalInteractions?: number;
  lastContactedAt?: string | null;
  status?: string;
  organizationId?: string;
  createdAt?: string;
  // Legacy mock fields
  name?: string;
  initials?: string;
  lastContact?: string;
}

interface ContactsResponse {
  contacts: ContactItem[];
  total: number;
  limit: number;
  offset: number;
}

export function useContacts(params?: { q?: string; limit?: number; offset?: number; tag?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.tag) searchParams.set("tag", params.tag);
  const qs = searchParams.toString();
  return useApiData<ContactsResponse>(
    `/api/contacts${qs ? `?${qs}` : ""}`
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────

interface BusinessHoursDay {
  dayOfWeek: string;
  openTime?: string;
  closeTime?: string;
  isClosed?: boolean;
}

interface OrgSettings {
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    locale: string;
    industry?: string;
  };
  /**
   * The business's own line(s), straight from `phone_numbers` (org-scoped). Empty means the
   * number is still being provisioned — show the honest "we'll text you" state, never a made-up
   * number. This is NOT organizations.phone (the owner's personal mobile, internal-only).
   */
  phoneNumbers?: PhoneNumberEntry[];
  businessHours: BusinessHoursDay[];
  transferNumber?: string | null;
  settings: Record<string, unknown>;
}

export interface PhoneNumberEntry {
  phoneNumber: string;
  isActive?: boolean;
}

/** The active line if there is one, else the first provisioned one, else "" (none yet). */
export function primaryPhoneNumber(numbers?: PhoneNumberEntry[] | null): string {
  if (!numbers?.length) return "";
  return (numbers.find((n) => n.isActive) || numbers[0])?.phoneNumber || "";
}

/** +17279667556 → (727) 966-7556. Anything not a 10/11-digit US number passes through as stored. */
export function formatPhoneNumber(raw?: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return raw;
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

/** Shown wherever a business has no number yet — no fake digits, no endless "Loading...". */
export const NO_PHONE_YET_MESSAGE = "Your number is being set up — we'll text you when it's live.";

export function useSettings() {
  const { data, loading, error, refetch } = useApiData<OrgSettings>("/api/settings");

  const updateSettings = useCallback(async (body: Record<string, unknown>) => {
    await api.put<{ success: boolean }>("/api/settings", body);
  }, []);

  return { data, loading, error, refetch, updateSettings };
}

// ─── Dashboard Overview ───────────────────────────────────────────────────

export interface DashboardStats {
  callsToday: number;
  answeredToday: number;
  bookingsToday: number;
  missedToday: number;
  answerRate: number;
  bookingRate: number;
}

export function useDashboardStats() {
  const { data: conversationsData } = useConversations(200, 0);
  const { data: appointmentsData } = useAppointments({ limit: 200 });

  const stats: DashboardStats = {
    callsToday: 0,
    answeredToday: 0,
    bookingsToday: 0,
    missedToday: 0,
    answerRate: 0,
    bookingRate: 0,
  };

  // Compute from conversations
  if (conversationsData?.conversations) {
    const today = new Date().toISOString().slice(0, 10);
    const todaysConversations = conversationsData.conversations.filter((c) =>
      c.createdAt?.startsWith(today)
    );
    stats.callsToday = todaysConversations.length;
    stats.answeredToday = todaysConversations.filter(
      (c) => c.status !== "missed"
    ).length;
    stats.missedToday = todaysConversations.filter(
      (c) => c.status === "missed"
    ).length;
    stats.answerRate = stats.callsToday > 0
      ? Math.round((stats.answeredToday / stats.callsToday) * 100)
      : 0;
  }

  // Compute from appointments
  if (appointmentsData?.appointments) {
    const today = new Date().toISOString().slice(0, 10);
    stats.bookingsToday = appointmentsData.appointments.filter(
      (a) => a.createdAt?.startsWith(today) && a.status === "scheduled"
    ).length;
    stats.bookingRate = stats.answeredToday > 0
      ? Math.round((stats.bookingsToday / stats.answeredToday) * 100)
      : 0;
  }

  return { stats, loading: false, conversations: conversationsData, appointments: appointmentsData };
}

// ─── Analytics ────────────────────────────────────────────────────────────
// Real counts only: /api/analytics aggregates the rows the signed-in organization
// actually has (calls, missed calls, appointments). There is deliberately NO
// mock/demo fallback here — a zero is a real zero, and any metric the schema
// cannot answer (satisfaction, per-staff performance, revenue attribution) is
// simply absent from the response instead of being estimated.
export interface AnalyticsResponse {
  range: { days: number; from: string; to: string; timezone: string };
  calls: { total: number; answered: number; missed: number; answerRate: number | null };
  statuses: { status: string; count: number }[];
  outcomes: { outcome: string; count: number }[];
  callsByDay: { date: string; calls: number; answered: number; missed: number }[];
  callsByHour: { hour: number; count: number }[];
  channels: { channel: string; count: number }[];
  languages: { language: string; count: number }[];
  missedCalls: { total: number; callbackRequested: number; calledBack: number };
  appointments: {
    total: number;
    byStatus: { status: string; count: number }[];
    fromCalls: number;
    upcoming: number;
  };
  hasData: boolean;
}

export function useAnalytics(days: 7 | 30 | 90 = 7) {
  return useApiData<AnalyticsResponse>(`/api/analytics?days=${days}`);
}
