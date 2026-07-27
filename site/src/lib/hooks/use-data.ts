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

  useEffect(() => {
    let cancelled = false;
    const url = typeof path === "function" ? path() : path;

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
  businessHours: BusinessHoursDay[];
  settings: Record<string, unknown>;
}

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
