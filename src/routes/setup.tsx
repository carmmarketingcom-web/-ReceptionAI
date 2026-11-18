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

const TOTAL_STEPS = 6;

// The consent wording is stored verbatim on the request row (texting_requests.consent_text)
// because it is the opt-in evidence we file with the carrier. The server keeps its own copy
// (TEXTING_CONSENT_TEXT in serve.ts / site/serve.ts) — the two must stay word-for-word equal.
const TEXTING_CONSENT_TEXT =
  "I agree to receive call and appointment alert texts from ReceptionAI at this number. " +
  "Message frequency varies. Message & data rates may apply. Reply STOP to opt out, HELP for help. " +
  "Consent is not a condition of purchase.";

// The real menu rows for each phone, in order. These are what the owner taps — no invented
// paths, no fake logos, no screenshots of a real phone.
type PhoneRow = { label: string; toggle?: boolean; chevron?: boolean };

const IPHONE_ROWS: PhoneRow[] = [
  { label: "Settings" },
  { label: "Notifications" },
  { label: "Mail" },
  { label: "Allow Notifications", toggle: true, chevron: false },
  { label: "Lock Screen · Banners · Sounds", chevron: false },
];

const ANDROID_ROWS: PhoneRow[] = [
  { label: "Settings" },
  { label: "Apps → Gmail" },
  { label: "Notifications" },
  { label: "All notifications", toggle: true, chevron: false },
  { label: "Mail and Messages", chevron: false },
];

// A small dark phone frame with a stylised Settings list. Built in HTML/CSS on purpose:
// the menu paths have to be exact and legible, which a generated image cannot guarantee.
function PhoneMockup({ platform, rows }: { platform: string; rows: PhoneRow[] }) {
  return (
    <div className="mx-auto w-full max-w-[232px]">
      <div className="rounded-[1.75rem] border border-gray-700 bg-gray-900 p-1.5 shadow-lg shadow-gray-300/40">
        <div className="flex items-center justify-between px-2.5 pb-1 pt-1 text-[9px] text-gray-400">
          <span>9:41</span>
          <span className="h-1 w-9 rounded-full bg-gray-700" />
          <span>100%</span>
        </div>
        <div className="rounded-[1.4rem] bg-[#0b0f19] px-2 pb-3 pt-2">
          <p className="mb-2 px-1 text-[11px] font-semibold text-white">{platform} Settings</p>
          <div className="space-y-1">
            {rows.map((row, i) => (
              <div key={row.label} className="flex items-center gap-2 rounded-md bg-white/[0.07] px-2 py-1.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="flex-1 text-[10px] font-medium leading-tight text-gray-100">{row.label}</span>
                {row.toggle ? (
                  <span className="relative h-3 w-5 shrink-0 rounded-full bg-indigo-500">
                    <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-white" />
                  </span>
                ) : row.chevron === false ? null : (
                  <span className="shrink-0 text-[10px] text-gray-500">›</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-gray-700">{platform}</p>
    </div>
  );
}

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

  // Steps 5 and 6 — notifications, and the $10/month texting add-on. Choosing the add-on only
  // records a request: texting stays off until the carriers verify the number, so the UI never
  // shows an enabled state and nothing is charged here.
  const [textingChoice, setTextingChoice] = useState<"idle" | "form" | "sent">("idle");
  const [textingPhone, setTextingPhone] = useState("");
  const [textingConsent, setTextingConsent] = useState(false);
  const [textingSaving, setTextingSaving] = useState(false);
  const [textingError, setTextingError] = useState("");

  // Pre-fill from the org we already have: the business name came from signup, and the mobile is
  // the number Stripe Checkout collected — so most customers just confirm and press Continue.
  useEffect(() => {
    if (prefilled || !settingsData?.organization) return;
    const org = settingsData.organization as { name?: string; phone?: string | null };
    if (org.name) setCompanyName((current) => current || org.name || "");
    if (typeof org.phone === "string" && org.phone.trim()) setMobile(org.phone.trim());
    setPrefilled(true);
  }, [settingsData, prefilled]);

  // Step 6 starts with the mobile we already have (step 1, or the org record) so the owner
  // normally just ticks the consent box.
  useEffect(() => {
    if (step !== 6) return;
    const org = settingsData?.organization as { phone?: string | null } | undefined;
    setTextingPhone((current) => current || mobile.trim() || (org?.phone || "").trim());
  }, [step, mobile, settingsData]);

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

  // Step 6: record the request. This writes one row (texting_requests) and emails the team to
  // file the carrier verification. It does not turn texting on and it does not charge anything.
  const handleTextingRequest = async () => {
    const phone = textingPhone.trim();
    if (phone.replace(/\D/g, "").length < 10) {
      setTextingError("Enter a mobile number we can text.");
      return;
    }
    if (!textingConsent) {
      setTextingError("Tick the consent box so we can file the verification.");
      return;
    }
    setTextingSaving(true);
    setTextingError("");
    try {
      await api.post("/api/texting-request", {
        phone,
        consent: true,
        consentText: TEXTING_CONSENT_TEXT,
      });
      setTextingChoice("sent");
    } catch {
      setTextingError("We couldn't send your request just now. Nothing was charged — try again in a moment.");
    } finally {
      setTextingSaving(false);
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
              <p className="mt-1 text-sm text-gray-500">A couple of quick things to personalize your receptionist.</p>
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

          {/* ── Step 5: Email notifications ─────────────────────────── */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900">Email notifications — already on</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Every call summary, missed call, voicemail and new booking is emailed to you automatically — it's included in your plan and costs you nothing extra.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                One thing to do now:{" "}
                <strong className="font-semibold text-gray-900">allow notifications for your email app on your phone.</strong>{" "}
                Otherwise the emails still arrive, but your phone stays quiet until you open your inbox — and a booking you don't see for six hours is a customer who called someone else.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <PhoneMockup platform="iPhone" rows={IPHONE_ROWS} />
                <PhoneMockup platform="Android" rows={ANDROID_ROWS} />
              </div>

              <p className="mt-4 text-center text-xs text-gray-500">Prefer a text? That's the add-on below.</p>
            </div>
          )}

          {/* ── Step 6: Texting add-on ($10/month) ──────────────────── */}
          {step === 6 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Text alerts — $10/month</h2>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                  Requires carrier approval
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                $10/month is the price we will bill once the carriers approve your number — not before.
              </p>

              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Texting is the one channel we can't switch on ourselves. In the US, a business can only send text messages to phones after its number is verified by the mobile carriers — that rule comes from the carriers and the FCC, not from us. We file it for you and pay the filing fee. We just can't skip it, and neither can any other provider.
              </p>

              <p className="mt-3 text-sm font-semibold text-gray-900">What happens after you turn this on:</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-gray-600">
                <li>We file the verification for your number — the same day you request it.</li>
                <li>
                  Approval usually lands in <strong className="font-semibold text-gray-900">2 weeks or less</strong>.
                </li>
                <li>Once the carriers approve, we send you a test text so you know it works.</li>
                <li>From then on, your alerts arrive by text as well as email.</li>
              </ol>

              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Until it's approved, <strong className="font-semibold text-gray-900">nothing changes</strong> — email keeps delivering everything. We won't charge you for texting while it's pending.
              </p>

              <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs leading-relaxed text-gray-600">
                  <strong className="font-semibold text-gray-900">Why we do it this way.</strong> Every legitimate business texting US phones goes through this. The businesses that skip it get their messages filtered or their number blocked — and then their customers stop hearing from them at all. We'd rather take two weeks and do it properly, so your alerts keep arriving for as long as you're a customer.
                </p>
              </div>

              {textingChoice === "idle" && (
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => setTextingChoice("form")}
                    className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    Request texting — $10/month
                  </button>
                  <button
                    onClick={finish}
                    className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    No thanks, email is fine
                  </button>
                </div>
              )}

              {textingChoice === "form" && (
                <div className="mt-5">
                  <label htmlFor="textingPhone" className="block text-sm font-medium text-gray-700">
                    Mobile number for text alerts
                  </label>
                  <input
                    id="textingPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={textingPhone}
                    onChange={(e) => { setTextingPhone(e.target.value); setTextingError(""); }}
                    placeholder="(555) 123-4567"
                    className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-gray-600">
                    <input
                      type="checkbox"
                      checked={textingConsent}
                      onChange={(e) => { setTextingConsent(e.target.checked); setTextingError(""); }}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
                    />
                    <span>{TEXTING_CONSENT_TEXT}</span>
                  </label>
                  {textingError && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {textingError}
                    </p>
                  )}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={handleTextingRequest}
                      disabled={textingSaving}
                      className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                    >
                      {textingSaving ? "Sending your request…" : "Request texting — $10/month"}
                    </button>
                    <button
                      onClick={finish}
                      className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      No thanks, email is fine
                    </button>
                  </div>
                </div>
              )}

              {textingChoice === "sent" && (
                <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">Request received</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">
                    We'll file the verification for {textingPhone.trim()} and email you when the carriers respond.{" "}
                    <strong className="font-semibold text-gray-900">Texting is not active yet</strong> — email keeps delivering every call summary, missed call, voicemail and new booking in the meantime.
                  </p>
                  <button
                    onClick={finish}
                    className="mt-4 w-full rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black sm:w-auto"
                  >
                    Go to Dashboard →
                  </button>
                </div>
              )}

              <p className="mt-3 text-xs text-gray-500">We'll confirm by email before billing starts.</p>
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
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
