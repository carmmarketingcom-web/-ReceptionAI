import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { api } from "~/lib/api-client";
import { useSettings, primaryPhoneNumber, formatPhoneNumber, NO_PHONE_YET_MESSAGE } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

// ─── Constants ──────────────────────────────────────────────────────────────

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Weekday = (typeof WEEKDAYS)[number];

const DAY_LABELS: Record<Weekday, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const defaultHours: Record<Weekday, { open: string; close: string; enabled: boolean }> = {
  monday:    { open: "09:00", close: "17:00", enabled: true },
  tuesday:   { open: "09:00", close: "17:00", enabled: true },
  wednesday: { open: "09:00", close: "17:00", enabled: true },
  thursday:  { open: "09:00", close: "17:00", enabled: true },
  friday:    { open: "09:00", close: "17:00", enabled: true },
  saturday:  { open: "10:00", close: "14:00", enabled: false },
  sunday:    { open: "09:00", close: "17:00", enabled: false },
};

const TOTAL_STEPS = 4;

// ─── Component ──────────────────────────────────────────────────────────────

function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — what the AI says to callers, and the mobile number we transfer to.
  const [companyName, setCompanyName] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState("");
  // Skipping is allowed — a paying customer must never be blocked from their dashboard — but it
  // leaves a banner in the dashboard until the number is set.
  const [skipMobile, setSkipMobile] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Step 2
  const [hours, setHours] = useState(defaultHours);

  // Step 3
  const [services, setServices] = useState("");

  // Step 4 — the number we actually bought for this business, from `phone_numbers` (org-scoped).
  // Never a generated placeholder: if there is no number yet the page says so honestly.
  const { data: settingsData, loading: loadingSettings } = useSettings();
  const rawPhoneNumber = primaryPhoneNumber(settingsData?.phoneNumbers);
  const phoneNumber = formatPhoneNumber(rawPhoneNumber);

  const [saving, setSaving] = useState(false);

  // Pre-fill from the org we already have: the business name came from signup, and the mobile is
  // the number Stripe Checkout collected — so most customers just confirm and press Continue.
  useEffect(() => {
    if (prefilled || !settingsData?.organization) return;
    const org = settingsData.organization as { name?: string; phone?: string | null };
    if (org.name) setCompanyName((current) => current || org.name || "");
    if (typeof org.phone === "string" && org.phone.trim()) setMobile(org.phone.trim());
    setPrefilled(true);
  }, [settingsData, prefilled]);

  // ── Navigation ──────────────────────────────────────────────────────────

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSaveAndContinue = async () => {
    // Step 1 is the one thing that makes press-3 transfer and every owner alert work, so we ask
    // for it here — but "Skip for now" is always available and the dashboard keeps asking.
    if (step === 1) {
      const phone = mobile.trim();
      if (!phone && !skipMobile) {
        setMobileError("Add the mobile number for call alerts, or choose \"Skip for now\".");
        return;
      }
    }
    setSaving(true);
    try {
      if (step === 1) {
        const payload: Record<string, unknown> = {};
        if (companyName.trim()) payload.name = companyName.trim();
        if (mobile.trim()) payload.phone = mobile.trim();
        if (Object.keys(payload).length) await api.put("/api/settings", payload);
      }
      if (step === 2) {
        const hoursPayload = WEEKDAYS.map((day) => ({
          dayOfWeek: String(WEEKDAYS.indexOf(day)),
          openTime: hours[day].enabled ? hours[day].open : null,
          closeTime: hours[day].enabled ? hours[day].close : null,
          isClosed: !hours[day].enabled,
        }));
        await api.put("/api/settings", { businessHours: hoursPayload });
      }
      if (step === 3 && services.trim()) {
        // Save services as a comma-separated list setting
        await api.put("/api/settings", { services: services.trim() });
      }
      next();
    } catch {
      // Continue anyway — don't block the user
      next();
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    router.navigate({ to: "/dashboard" });
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const toggleDay = (day: Weekday) =>
    setHours((p) => ({ ...p, [day]: { ...p[day], enabled: !p[day].enabled } }));

  const updateTime = (day: Weekday, field: "open" | "close", val: string) =>
    setHours((p) => ({ ...p, [day]: { ...p[day], [field]: val } }));

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-50 px-4 py-12">
      <div className="w-full max-w-[600px]">
        {/* ── Logo ────────────────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">R</div>
        </div>

        {/* ── Card ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-100/50">
          {/* Step indicator */}
          <div className="mb-2 flex items-center justify-center gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className="flex items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                    i + 1 === step
                      ? "bg-indigo-600 text-white"
                      : i + 1 < step
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i + 1 < step ? "✓" : i + 1}
                </div>
                {i < TOTAL_STEPS - 1 && (
                  <div className={`mx-0.5 h-0.5 w-6 rounded-full ${i + 1 < step ? "bg-indigo-300" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
          <p className="mb-8 text-center text-xs font-medium text-gray-400">
            Step {step} of {TOTAL_STEPS}
          </p>

          {/* ── Step 1: Welcome ────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900">Let's set up your AI receptionist</h2>
              <p className="mt-1 text-sm text-gray-500">Your phone number is live and taking calls. Just a couple things to personalize it.</p>
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700">Company name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your business name"
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveAndContinue()}
                  autoFocus
                />
              </div>

              <div className="mt-5">
                <label htmlFor="setupMobile" className="block text-sm font-medium text-gray-700">
                  Your mobile number
                </label>
                <input
                  id="setupMobile"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={mobile}
                  onChange={(e) => { setMobile(e.target.value); setMobileError(""); }}
                  placeholder="(727) 555-0123"
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveAndContinue()}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  For call alerts and "press 3" transfers — never shown to callers.
                </p>
                {mobileError && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {mobileError}
                    <button
                      onClick={() => { setSkipMobile(true); setMobileError(""); handleSaveAndContinue(); }}
                      className="ml-2 font-semibold underline underline-offset-2"
                    >
                      Skip for now
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Business Hours ──────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900">When should the AI answer calls?</h2>
              <p className="mt-1 text-sm text-gray-500">Outside these hours, callers will hear a voicemail message.</p>
              <div className="mt-5 space-y-1">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-50">
                    <button
                      onClick={() => toggleDay(day)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition ${
                        hours[day].enabled
                          ? "bg-indigo-50 text-indigo-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
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
              <p className="mt-3 text-xs text-gray-400">
                M-F 9-5 is pre-filled. Saturday and Sunday are off by default.
              </p>
            </div>
          )}

          {/* ── Step 3: Services ────────────────────────────────────── */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900">What services do you offer?</h2>
              <p className="mt-1 text-sm text-gray-500">This helps the AI understand customer needs. You can skip this for now.</p>
              <div className="mt-5">
                <textarea
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  placeholder="e.g. HVAC repair, plumbing, dental cleaning, legal consultation..."
                  rows={5}
                  className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-2 text-xs text-gray-400">Separate each service with a comma or line break.</p>
              </div>
            </div>
          )}

          {/* ── Step 4: Phone Number ────────────────────────────────── */}
          {step === 4 && (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">📞</div>
              <h2 className="mt-4 text-xl font-bold text-gray-900">
                {rawPhoneNumber ? "Your AI receptionist is ready" : "Almost there"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {rawPhoneNumber
                  ? "Your number is live and answering calls right now."
                  : loadingSettings
                    ? "Checking your number…"
                    : NO_PHONE_YET_MESSAGE}
              </p>

              {rawPhoneNumber ? (
                <div className="mt-6 rounded-2xl border-2 border-green-100 bg-green-50/50 p-6">
                  <p className="text-xs font-medium text-green-700">Your number</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{phoneNumber}</p>
                  <p className="mt-2 text-xs text-gray-500">Save this number. Your AI receptionist answers calls 24/7.</p>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border-2 border-gray-100 bg-gray-50/50 p-6">
                  <p className="text-xs font-medium text-gray-500">Your number</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {loadingSettings ? "Checking your number…" : NO_PHONE_YET_MESSAGE}
                  </p>
                </div>
              )}

              <div className="mt-6 space-y-2">
                {rawPhoneNumber ? (
                  <a
                    href={`tel:${rawPhoneNumber.replace(/[^\d+]/g, "")}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                  >
                    📞 Test your number
                  </a>
                ) : (
                  <p className="text-xs text-gray-400">
                    You can test the line from your dashboard as soon as it is live.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Navigation ──────────────────────────────────────────── */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={prev}
              disabled={step === 1}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 transition hover:text-gray-600 disabled:opacity-0"
            >
              ← Back
            </button>

            <div className="flex items-center gap-2">
              {step === 3 && (
                <button
                  onClick={next}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 transition hover:text-gray-600"
                >
                  Skip for now
                </button>
              )}
              {step === 1 && !mobile.trim() && (
                <button
                  onClick={() => { setSkipMobile(true); setMobileError(""); handleSaveAndContinue(); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 transition hover:text-gray-600"
                >
                  Skip for now
                </button>
              )}
              {step < TOTAL_STEPS ? (
                <button
                  onClick={handleSaveAndContinue}
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Continue"}
                </button>
              ) : (
                <button
                  onClick={finish}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Go to Dashboard →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
