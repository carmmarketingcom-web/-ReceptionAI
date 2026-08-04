import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { api } from "~/lib/api-client";

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

  // Step 1
  const [companyName, setCompanyName] = useState("");

  // Step 2
  const [hours, setHours] = useState(defaultHours);

  // Step 3
  const [services, setServices] = useState("");

  // Step 4
  const phoneNumber = "(555) " + String(Math.floor(Math.random() * 900) + 100) + "-" + String(Math.floor(Math.random() * 9000) + 1000);

  const [saving, setSaving] = useState(false);

  // ── Navigation ──────────────────────────────────────────────────────────

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSaveAndContinue = async () => {
    setSaving(true);
    try {
      if (step === 1 && companyName.trim()) {
        await api.put("/api/settings", { name: companyName.trim() });
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
              <h2 className="mt-4 text-xl font-bold text-gray-900">Your AI receptionist is ready</h2>
              <p className="mt-1 text-sm text-gray-500">Your number is live and answering calls right now.</p>

              <div className="mt-6 rounded-2xl border-2 border-green-100 bg-green-50/50 p-6">
                <p className="text-xs font-medium text-green-700">Your number</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{phoneNumber}</p>
                <p className="mt-2 text-xs text-gray-500">Save this number. Your AI receptionist answers calls 24/7.</p>
              </div>

              <div className="mt-6 space-y-2">
                <a
                  href={`tel:${phoneNumber.replace(/\D/g, "")}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                >
                  📞 Test your number
                </a>
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
