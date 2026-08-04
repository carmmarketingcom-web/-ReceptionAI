import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { api } from "~/lib/api-client";
import { useSettings } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Weekday = (typeof WEEKDAYS)[number];

const DAY_LABELS: Record<Weekday, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
] as const;

const BUSINESS_TYPES = [
  "HVAC", "Plumbing", "Electrical", "Dental", "Veterinary",
  "Law Firm", "Med Spa", "Home Services", "Auto Repair", "Other",
] as const;

type Hours = Record<Weekday, { open: string; close: string; enabled: boolean }>;

const DEFAULT_HOURS: Hours = {
  monday:    { open: "09:00", close: "17:00", enabled: true },
  tuesday:   { open: "09:00", close: "17:00", enabled: true },
  wednesday: { open: "09:00", close: "17:00", enabled: true },
  thursday:  { open: "09:00", close: "17:00", enabled: true },
  friday:    { open: "09:00", close: "17:00", enabled: true },
  saturday:  { open: "10:00", close: "14:00", enabled: false },
  sunday:    { open: "09:00", close: "17:00", enabled: false },
};

// ─── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-medium shadow-lg transition ${
      type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
    }`}>
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

function SettingsPage() {
  const { data, loading } = useSettings();

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS);
  const [smsSummaries, setSmsSummaries] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Phone numbers — mock for now
  const [phoneNumbers] = useState([
    "(555) " + String(Math.floor(Math.random() * 900) + 100) + "-" + String(Math.floor(Math.random() * 9000) + 1000),
  ]);

  // Populate from API
  useEffect(() => {
    if (data) {
      if (data.organization?.name) setCompanyName(data.organization.name);
      if (data.organization?.industry) setBusinessType(data.organization.industry);
      if (data.organization?.timezone) setTimezone(data.organization.timezone);
      if (data.businessHours?.length) {
        const mapped: Hours = { ...DEFAULT_HOURS };
        for (const h of data.businessHours) {
          const idx = parseInt(h.dayOfWeek, 10);
          const day = WEEKDAYS[idx];
          if (day) {
            mapped[day] = {
              open: h.openTime || "09:00",
              close: h.closeTime || "17:00",
              enabled: !h.isClosed,
            };
          }
        }
        setHours(mapped);
      }
      if (data.settings?.smsSummaries !== undefined) {
        setSmsSummaries(!!data.settings.smsSummaries);
      }
    }
  }, [data]);

  const toggleDay = (day: Weekday) => setHours((p) => ({ ...p, [day]: { ...p[day], enabled: !p[day].enabled } }));
  const updateTime = (day: Weekday, field: "open" | "close", val: string) => setHours((p) => ({ ...p, [day]: { ...p[day], [field]: val } }));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const hoursPayload = WEEKDAYS.map((day) => ({
        dayOfWeek: String(WEEKDAYS.indexOf(day)),
        openTime: hours[day].enabled ? hours[day].open : null,
        closeTime: hours[day].enabled ? hours[day].close : null,
        isClosed: !hours[day].enabled,
      }));
      await api.put("/api/settings", {
        name: companyName,
        industry: businessType || undefined,
        timezone,
        businessHours: hoursPayload,
        smsSummaries,
      });
      setToast({ message: "Settings saved successfully", type: "success" });
    } catch {
      setToast({ message: "Failed to save settings. Please try again.", type: "error" });
    } finally {
      setSaving(false);
    }
  }, [companyName, businessType, timezone, hours, smsSummaries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your business configuration.</p>
      </div>

      {/* ── Business Info ─────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Business Info</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your business name"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Business Type</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select type...</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>

      {/* ── Phone ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Phone Numbers</h2>
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            + Add number
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {phoneNumbers.map((num, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <span className="text-lg">📞</span>
              <span className="flex-1 text-sm font-medium text-gray-900">{num}</span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">To add more numbers or port an existing one, contact support.</p>
      </div>

      {/* ── Hours ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Business Hours</h2>
        <p className="mt-0.5 text-xs text-gray-500">When should the AI answer calls? Outside these hours, callers leave a voicemail.</p>
        <div className="mt-4 space-y-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className="flex items-center gap-3 rounded-lg px-1 py-2">
              <input
                type="checkbox"
                checked={hours[day].enabled}
                onChange={() => toggleDay(day)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="w-24 text-sm font-medium text-gray-700">{DAY_LABELS[day]}</span>
              {hours[day].enabled ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={hours[day].open}
                    onChange={(e) => updateTime(day, "open", e.target.value)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="time"
                    value={hours[day].close}
                    onChange={(e) => updateTime(day, "close", e.target.value)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400">Closed</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Schedule ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg">📅</div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Your Schedule</h2>
              <p className="mt-0.5 text-xs text-gray-500">View and manage your appointments in a simple calendar.</p>
            </div>
          </div>
          <a
            href="/dashboard/schedule"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Open Schedule
          </a>
        </div>
      </div>

      {/* ── Notifications ─────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Post-Call SMS Summaries</h2>
            <p className="mt-0.5 text-xs text-gray-500">Get a text after every call with caller info, duration, and outcome.</p>
          </div>
          <button
            onClick={() => setSmsSummaries(!smsSummaries)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              smsSummaries ? "bg-indigo-600" : "bg-gray-200"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${
              smsSummaries ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>
      </div>

      {/* ── Save ──────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save settings"}
      </button>

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
