import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ChatWidgetPreview from "~/components/ChatWidgetPreview";
import PhoneShowcase from "~/components/PhoneShowcase";
import { t, useLocale } from "~/lib/i18n";

export const Route = createFileRoute("/_marketing/")({
  component: HomePage,
});

/* ─── What the AI actually does on a call — shipped behaviour only.
       No "replaces your staff", no percentages, nothing unbuilt. ─── */
const VALUE_POINTS = [
  "home.value.1",
  "home.value.2",
  "home.value.3",
  "home.value.4",
  "home.value.5",
  "home.value.6",
  "home.value.7",
];

/* Industry labels, in the order each band shows them. */
const MARQUEE_INDUSTRIES = [
  "ind.hvac",
  "ind.plumbing",
  "ind.electrical",
  "ind.dental",
  "ind.veterinary",
  "ind.law",
  "ind.medspa",
  "ind.homeservices",
];

const TRADES_INDUSTRIES = [
  "ind.hvac",
  "ind.plumbing",
  "ind.electrical",
  "ind.dental",
  "ind.veterinary",
  "ind.legal",
  "ind.medspa",
  "ind.homeservices",
];

/* ─── Scroll Reveal Hook (starts visible for SSR, hides below-fold for animation) ─── */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true); // Start visible — above-fold is never hidden

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Check if element is already in viewport
    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (!alreadyVisible) {
      setVisible(false);
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── SVG Icon helper ─── */
function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {name === "phone" && <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />}
      {name === "calendar" && <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>}
      {name === "globe" && <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>}
      {name === "chat" && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
      {name === "refresh" && <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>}
      {name === "chart" && <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>}
      {name === "wrench" && <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />}
      {name === "sms" && <><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>}
      {name === "sparkle" && <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />}
      {name === "check" && <polyline points="20 6 9 17 4 12" />}
      {name === "clock" && <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>}
    </svg>
  );
}

function HomePage() {
  /* Subscribe to the locale: `t()` reads module-level state, so a page that
     never calls this hook would keep rendering the old language after a toggle. */
  useLocale();
  return (
    <div className="bg-white">
      <HeroSection />
      <LogoMarquee />
      <MissedCallCalculator />
      <SeeItWorking />
      <HowItWorksSection />
      <BuiltForTrades />
      <FeaturesOverview />
      <HowItWorks />
      <SocialProof />
      <StatsSection />
      <HonestFaq />
      <FinalCta />
    </div>
  );
}

/* ─── Hero Section (always visible, no scroll reveal) ─── */
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gray-950">
      {/* Radial glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 h-[900px] w-[900px] translate-x-1/4 -translate-y-1/4 rounded-full bg-indigo-600/25 blur-[150px]" />
        <div className="absolute bottom-0 left-0 h-[700px] w-[700px] -translate-x-1/4 translate-y-1/4 rounded-full bg-purple-600/20 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/10 blur-[120px]" />
      </div>
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 sm:pb-32 sm:pt-32 lg:px-8 lg:pb-40 lg:pt-36">
        <div className="flex flex-col items-center gap-16 lg:flex-row lg:items-start">
          {/* Left: Text */}
          <div className="flex-1 text-center lg:text-left lg:pt-8">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-5 py-2 text-sm font-medium text-indigo-300 backdrop-blur-sm">
              <span className="flex h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse" />
              {t("home.badge")}
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl leading-[1.05]">
              {t("home.hero.line1")}
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t("home.hero.highlight")}
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-gray-400 sm:text-xl lg:mx-0">
              {t("home.hero.subtitle")}{" "}
              <span className="whitespace-nowrap font-semibold text-white">{t("home.hero.price")}</span>
            </p>

            {/* Two CTAs only: hear it, or see what it costs. */}
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <a
                href="tel:+17279667556"
                className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all hover:from-indigo-400 hover:to-indigo-500 hover:shadow-[0_0_50px_rgba(99,102,241,0.4)] hover:scale-[1.02] active:scale-[0.98]"
              >
                {t("home.hero.cta")}
                <Icon name="phone" className="h-5 w-5" />
              </a>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-gray-200 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                {t("home.hero.secondary")}
              </Link>
            </div>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-500 lg:mx-0">
              {t("home.hero.demoPrefix")}{" "}
              <a href="tel:+17279667556" className="font-semibold text-gray-300 transition hover:text-white">
                (727) 966-7556
              </a>{" "}
              {t("home.hero.demoSuffix")}
            </p>

            {/* What happens on a call — shipped behaviour only */}
            <ul className="mx-auto mt-8 grid max-w-xl gap-x-6 gap-y-3 text-left sm:grid-cols-2 lg:mx-0">
              {VALUE_POINTS.map((key) => (
                <li key={key} className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-400">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {t(key)}
                </li>
              ))}
            </ul>

            {/* Cost comparison — the only figure on this page that is not ours, and it is sourced. */}
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-gray-500 lg:mx-0">
              {t("home.bls.pre")}{" "}
              <span className="font-semibold text-gray-400">{t("home.bls.amount")}</span>{" "}
              {t("home.bls.mid")}{" "}
              <span className="text-gray-600">
                {t("home.bls.source")}
              </span>
            </p>
          </div>

          {/* Right: Living phone showcase — 16s self-playing product loop (CSS-first).
              Replaces the old hero raster PNG; strings come from APP_DEMO / VOICE_STEPS /
              SMS_THREAD / OWNER_SUMMARY above, so nothing on screen is invented. */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <PhoneShowcase
              app={APP_DEMO}
              bookedLine={VOICE_STEPS[3].text}
              confirmationSms={SMS_THREAD[0].body}
              ownerSummary={OWNER_SUMMARY}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Logo Marquee ─── */
function LogoMarquee() {
  return (
    <section className="border-b border-gray-100 bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-gray-400">
          {t("home.marquee.title")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {MARQUEE_INDUSTRIES.map((key) => (
            <span
              key={key}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 hover:shadow-md"
            >
              {t(key)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ─── Missed-call calculator ─── */
function MissedCallCalculator() {
  const [missedCalls, setMissedCalls] = useState(10);
  const [averageJobValue, setAverageJobValue] = useState(300);
  const annualRevenueLost = missedCalls * averageJobValue * 52 / 3;
  const monthlyRevenueLost = annualRevenueLost / 12;
  const formatMoney = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
  const copy = {
    headline: t("home.calc.headline"),
    callsLabel: t("home.calc.callsLabel"),
    jobLabel: t("home.calc.jobLabel"),
    assumption: t("home.calc.assumption"),
    outputLabel: t("home.calc.outputLabel"),
    cta: t("home.calc.cta"),
  };

  return (
    <section id="missed-call-calculator" className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-indigo-950 to-purple-950 py-20 text-white sm:py-28">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(#b8b8ff_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="pointer-events-none absolute -right-40 top-0 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-indigo-200">{t("home.calc.badge")}</span>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{copy.headline}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-indigo-100/75">{t("home.calc.subtitle")}</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl lg:grid-cols-[1fr_.95fr]">
          <div className="space-y-8 p-7 sm:p-10 lg:p-12">
            <div>
              <div className="flex items-center justify-between text-sm font-semibold text-white"><span>{copy.callsLabel}</span><output>{missedCalls}</output></div>
              <div className="mt-4 flex items-center gap-4">
                <button type="button" aria-label={t("home.calc.decrease")} disabled={missedCalls === 1} onClick={() => setMissedCalls((value) => Math.max(1, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-2xl leading-none transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35">−</button>
                <output className="min-w-12 text-center text-2xl font-black">{missedCalls}</output>
                <button type="button" aria-label={t("home.calc.increase")} disabled={missedCalls === 50} onClick={() => setMissedCalls((value) => Math.min(50, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-2xl leading-none transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35">+</button>
              </div>
              <div className="mt-2 flex justify-between text-xs text-indigo-200/60"><span>1</span><span>50</span></div>
            </div>

            <div>
              <div className="text-sm font-semibold text-white">{copy.jobLabel}</div>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={copy.jobLabel}>
                {[150, 300, 500, 1000].map((value) => {
                  const active = averageJobValue === value;
                  return <button key={value} type="button" aria-pressed={active} onClick={() => setAverageJobValue(value)} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${active ? "border-indigo-200 bg-indigo-400/60 text-white" : "border-white/20 bg-white/5 text-indigo-100 hover:bg-white/15"}`}>{formatMoney(value)}</button>;
                })}
              </div>
            </div>

            <p className="text-xs leading-relaxed text-indigo-100/70">{copy.assumption}</p>
          </div>

          <div className="flex flex-col justify-between bg-gray-950/55 p-7 sm:p-10 lg:p-12">
            <div>
              <div className="text-xs font-extrabold tracking-[.16em] text-indigo-200">{copy.outputLabel}</div>
              <div className="mt-3 text-5xl font-black tracking-[-.08em] text-white sm:text-6xl">{formatMoney(annualRevenueLost)}</div>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-indigo-100/75">{t("home.calc.monthlyPre")} {formatMoney(monthlyRevenueLost)} {t("home.calc.monthlyPost")}</p>
            </div>
            <div>
              <Link to="/signup" className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-extrabold text-indigo-700 shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-50">{copy.cta}<span aria-hidden>→</span></Link>
              <p className="mt-3 text-center text-xs text-indigo-100/55">{t("home.calc.disclaimer")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── See it working — every product line below is verbatim product template ───
   Sources (root serve.ts, the live Telnyx call path):
     buildGreeting / buildShortPrompt ............ serve.ts:64-81 / 229-235
     language-choice greeting .................... serve.ts:1620
     slot offer (startVoiceBooking) .............. serve.ts:1040-1050
     booked confirmation (voice) ................. serve.ts:1085-1086
     slot speech format (formatSlotSpeech) ....... serve.ts:883-893
     booking SMS confirmation .................... serve.ts:1013 (EN) / 1012 (ES)
     reminder SMS (24h / 2h) ..................... serve.ts:905-912
     abandoned-booking follow-up SMS ............. serve.ts:1944-1945
     owner post-call summary (buildCallSummary) .. serve.ts:1257-1276
   Values in {{braces}} are runtime interpolations — the sample caller, org,
   service and times are illustrative; the wording around them is verbatim. */

const APP_DEMO = {
  org: "Sunset Air & Heat",
  caller: "Maria",
  service: "AC tune-up",
  day: "Tuesday, November 4",
  time: "10:00 AM",
  phone: "(555) 010-2288",
};

/* `key` is a dictionary key for the step label. `text` is verbatim product
   output and is deliberately not translated: it is what the phone literally
   says, and the Spanish SMS sample sits beside it in the same card. */
const VOICE_STEPS = [
  { key: "home.see.step.answered", text: `Welcome! For English, press 1. Para español, presione 2.` },
  { key: "home.see.step.menu", text: `Hello, you've reached ${APP_DEMO.org}. Press 1 for appointments, 2 for services, 3 for a team member, 4 to reschedule, 5 for availability, or 9 to leave a message.` },
  { key: "home.see.step.availability", text: `Here are the next available times. Option 1: ${APP_DEMO.day} at ${APP_DEMO.time}. Option 2: ${APP_DEMO.day} at 2:00 PM. Press 1, 2, 3, or 4 to book, or 9 to speak with the team.` },
  { key: "home.see.step.booked", text: `Your appointment is booked for ${APP_DEMO.day} at ${APP_DEMO.time}. We'll text you a confirmation and a reminder. Thank you! Goodbye!` },
];

const SMS_THREAD = [
  {
    label: "home.see.sms.booking",
    body: `Hi ${APP_DEMO.caller}, your appointment for ${APP_DEMO.service} on Tue, Nov 4 at ${APP_DEMO.time} is confirmed. We'll send a reminder before your visit. Questions? Call ${APP_DEMO.phone}.`,
  },
  {
    label: "home.see.sms.reminder",
    body: `Hi ${APP_DEMO.caller}, reminder: you have an appointment at ${APP_DEMO.org} for ${APP_DEMO.service} tomorrow (Tue, Nov 4) at ${APP_DEMO.time}.`,
  },
  {
    label: "home.see.sms.abandoned",
    body: `Hi, this is ${APP_DEMO.org}. We noticed you called earlier and were interested in booking an appointment but we weren't able to complete it. Would you like us to reach out to schedule? Reply YES and we'll contact you shortly.`,
  },
];

const SEE_PILLS = [
  "home.see.pill1",
  "home.see.pill2",
  "home.see.pill3",
  "home.see.pill4",
  "home.see.pill5",
];

const OWNER_CHIPS = [
  "home.see.chip.caller",
  "home.see.chip.duration",
  "home.see.chip.outcome",
  "home.see.chip.dtmf",
];

const SMS_THREAD_ES = `Hola ${APP_DEMO.caller}, su cita para ${APP_DEMO.service} el Tue, Nov 4 a las ${APP_DEMO.time} está confirmada. Le enviaremos un recordatorio antes de su visita. ¿Preguntas? Llame al ${APP_DEMO.phone}.`;

const OWNER_SUMMARY = [
  "📞 ReceptionAI Call Summary",
  `From: ${APP_DEMO.caller} (${APP_DEMO.phone})`,
  "Duration: 1m 42s",
  "Outcome: Appointment booked",
  "DTMF: 1 → 1 → 2",
  "Time: 11/1/2026, 7:02:14 PM CT",
  "—",
  "Check your dashboard: receptionai.store/dashboard",
];

function SeeItWorking() {
  return (
    <section id="see-it-working" aria-labelledby="see-it-working-heading" className="relative overflow-hidden bg-gray-950 py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-indigo-600/10 blur-[100px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-purple-600/10 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-semibold text-indigo-300 backdrop-blur-sm">
            {t("home.see.badge")}
          </span>
          <h2 id="see-it-working-heading" className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t("home.see.title1")}
            <br className="hidden sm:block" />
            <span className="text-indigo-400"> {t("home.see.title2")}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-400">
            {t("home.see.subtitle")}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {/* ── Card 1: the call ── */}
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                  <Icon name="phone" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-indigo-300/80">{t("home.see.call.label")}</p>
                  <h3 className="text-sm font-bold text-white sm:text-base">{t("home.see.call.title")}</h3>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                {SEE_PILLS.map((pill) => (
                  <span key={pill} className="whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-gray-300">{t(pill)}</span>
                ))}
              </div>

              <ol className="mt-5 space-y-3">
                {VOICE_STEPS.map((step) => (
                  <li key={step.key} className="border-l-2 border-indigo-500/40 pl-3">
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-indigo-300/70">{t(step.key)}</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-300">&ldquo;{step.text}&rdquo;</p>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>

          {/* ── Card 2: the texts the customer gets ── */}
          <Reveal delay={120}>
            <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                  <Icon name="sms" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-indigo-300/80">{t("home.see.sms.label")}</p>
                  <h3 className="text-sm font-bold text-white sm:text-base">{t("home.see.sms.title")}</h3>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {SMS_THREAD.map((sms) => (
                  <div key={sms.label}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[.14em] text-indigo-300/70">{t(sms.label)}</p>
                    <p className="rounded-2xl rounded-tl-md bg-indigo-600/90 px-3.5 py-2.5 text-xs leading-relaxed text-white shadow-lg shadow-indigo-950/30">
                      {sms.body}
                    </p>
                  </div>
                ))}
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[.14em] text-indigo-300/70">{t("home.see.sms.spanish")}</p>
                  <p className="rounded-2xl rounded-tl-md bg-indigo-600/60 px-3.5 py-2.5 text-xs leading-relaxed text-white/90 shadow-lg shadow-indigo-950/30">
                    {SMS_THREAD_ES}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ── Card 3: the text the owner gets ── */}
          <Reveal delay={240}>
            <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-indigo-300/80">{t("home.see.owner.label")}</p>
                  <h3 className="text-sm font-bold text-white sm:text-base">{t("home.see.owner.title")}</h3>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-gray-200">
                {OWNER_CHIPS.map((chip, i) => (
                  <span key={chip} className="flex items-center gap-1.5">
                    <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-1 text-indigo-200">{t(chip)}</span>
                    {i < 3 && <span aria-hidden className="text-gray-600">·</span>}
                  </span>
                ))}
              </div>

              <div className="mt-4 rounded-2xl rounded-tl-md border border-white/10 bg-gray-900/80 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-line">
                {OWNER_SUMMARY.join("\n")}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-gray-500">
                {t("home.see.owner.note")}
              </p>

              <div className="mt-auto" />
              <Link to="/pricing" className="mt-5 inline-flex items-center gap-1.5 self-start text-xs font-semibold text-indigo-300 transition hover:text-indigo-200">
                {t("home.see.owner.link")}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─── */
function HowItWorksSection() {
  const steps = [
    { icon: "phone", title: t("home.how.step1.title"), desc: t("home.how.step1.desc") },
    { icon: "calendar", title: t("home.how.step2.title"), desc: t("home.how.step2.desc") },
    { icon: "sms", title: t("home.how.step3.title"), desc: t("home.how.step3.desc") },
  ];

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">{t("home.how.badge")}</span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">{t("home.how.title1")}<br /><span className="text-indigo-600">{t("home.how.title2")}</span></h2>
        </Reveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={i} delay={i * 150}>
              <div className="group relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-indigo-100/50 hover:border-indigo-200 hover:-translate-y-1">
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-200">
                  <Icon name={s.icon} className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Built for Trades ─── */
function BuiltForTrades() {
  return (
    <section className="relative bg-gray-950 py-20 sm:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-indigo-600/10 blur-[100px]" />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 sm:p-12 backdrop-blur-sm">
            <div className="flex items-center gap-4 mb-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-white">
                <Icon name="wrench" className="h-6 w-6" />
              </span>
              <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
                {t("home.trades.title")}
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-gray-400 sm:text-xl">
              {t("home.trades.desc")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-500">
              <span className="font-semibold text-gray-300">{t("home.trades.worksFor")}</span>
              {TRADES_INDUSTRIES.map((key, i) => (
                <span key={key}>
                  {t(key)}{i < TRADES_INDUSTRIES.length - 1 ? " •" : ""}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Features ─── */
function FeaturesOverview() {
  /* The "in development" / "is coming" / "in progress" half of each description
     is load-bearing: it must survive translation exactly. */
  const features = [
    { icon: "phone", title: t("feature.247.title"), desc: t("feature.247.desc") },
    { icon: "globe", title: t("feature.multilingual.title"), desc: t("feature.multilingual.desc") },
    { icon: "calendar", title: t("feature.scheduling.title"), desc: t("feature.scheduling.desc") },
    { icon: "chat", title: t("feature.multichannel.title"), desc: t("feature.multichannel.desc") },
    { icon: "refresh", title: t("feature.human.title"), desc: t("feature.human.desc") },
    { icon: "chart", title: t("feature.analytics.title"), desc: t("feature.analytics.desc") },
  ];

  return (
    <section className="bg-white py-24 sm:py-32" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">{t("home.features.badge")}</span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">{t("home.features.title")}</h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-500 sm:text-xl">{t("home.features.subtitle")}</p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 75}>
              <div className="group relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-indigo-100/50 hover:border-indigo-200 hover:-translate-y-1">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                  <Icon name={f.icon} className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/features"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
          >
            {t("home.features.statusLink")}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works (numbered) ─── */
function HowItWorks() {
  const steps = [
    { step: "01", title: t("home.setup.step1.title"), desc: t("home.setup.step1.desc") },
    { step: "02", title: t("home.setup.step2.title"), desc: t("home.setup.step2.desc") },
    { step: "03", title: t("home.setup.step3.title"), desc: t("home.setup.step3.desc") },
  ];

  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">{t("home.setup.badge")}</span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">{t("home.setup.title")}</h2>
        </Reveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.step} delay={i * 150}>
              <div className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="absolute left-[calc(50%+48px)] top-12 hidden h-0.5 w-[calc(100%-96px)] bg-gradient-to-r from-indigo-300 to-indigo-200 md:block" />
                )}
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-2xl font-extrabold text-white shadow-xl shadow-indigo-200">
                  {s.step}
                </div>
                <h3 className="mt-6 text-lg font-bold text-gray-900">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── What you actually get (honest band — we have no customers to quote yet) ─── */
function SocialProof() {
  const cards = [
    {
      icon: "phone",
      title: t("home.social.card1.title"),
      body: t("home.social.card1.body"),
    },
    {
      icon: "calendar",
      title: t("home.social.card2.title"),
      body: t("home.social.card2.body"),
    },
    {
      icon: "sms",
      title: t("home.social.card3.title"),
      body: t("home.social.card3.body"),
    },
  ];
  const exampleSummary = [
    "📞 ReceptionAI Call Summary",
    "From: (555) 010-0199",
    "Duration: 2m 14s",
    "Outcome: Appointment booked",
    "DTMF: 1 → 3 → 1",
    "AI Summary: Furnace making a loud noise — booked Tuesday at 10:15 AM.",
    "Time: Tue, Oct 28, 9:41 AM CT",
    "—",
    "Check your dashboard: receptionai.store/dashboard",
  ].join("\n");

  return (
    <section className="relative bg-gray-950 py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-4 py-1.5 text-sm font-semibold text-indigo-300 backdrop-blur-sm">
            {t("home.social.badge")}
          </span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {t("home.social.title1")}
            <br />
            <span className="text-indigo-400">{t("home.social.title2")}</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-gray-400">
            {t("home.social.body")}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 150}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm transition-all hover:bg-white/[0.06] hover:border-white/20">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Icon name={c.icon} className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-white">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8">
          <div className="grid gap-8 rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm lg:grid-cols-[1fr_minmax(0,400px)] lg:items-center lg:p-9">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                {t("home.social.example")}
              </span>
              <h3 className="mt-4 text-2xl font-bold text-white">{t("home.social.exampleTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                {t("home.social.exampleBody")}
              </p>
            </div>
            <div className="rounded-2xl bg-[#141416] p-5 ring-1 ring-white/10">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {t("home.social.smsToOwner")}
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-gray-200">
                {exampleSummary}
              </pre>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Stats Bar ─── */
function StatsSection() {
  const features = [
    { icon: "phone", title: t("home.stats.1") },
    { icon: "globe", title: t("home.stats.2") },
    { icon: "calendar", title: t("home.stats.3") },
    { icon: "sparkle", title: t("home.stats.4") },
  ];

  return (
    <section className="relative bg-indigo-600 py-16 sm:py-20 overflow-hidden">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-[80px]" />
      <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/20 blur-[80px]" />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm">
                <Icon name={f.icon} className="h-6 w-6" />
              </span>
              <span className="text-sm font-semibold text-indigo-100">{f.title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function HonestFaq() {
  const faqs = [
    { q: t("home.faq.q1"), a: t("home.faq.a1") },
    { q: t("home.faq.q2"), a: t("home.faq.a2") },
    { q: t("home.faq.q3"), a: t("home.faq.a3") },
  ];

  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">
            {t("home.faq.badge")}
          </span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            {t("home.faq.title1")}
            <br />
            <span className="text-indigo-600">{t("home.faq.title2")}</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i * 100}>
              <div className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all hover:shadow-lg hover:border-indigo-100">
                <h3 className="text-lg font-bold text-gray-900">{faq.q}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{faq.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ─── */
function FinalCta() {
  return (
    <section className="relative bg-gray-950 py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[100px]" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {t("home.final.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-400 sm:text-xl">
            {t("home.final.subtitle")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="tel:+17279667556"
              className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all hover:from-indigo-400 hover:to-indigo-500 hover:shadow-[0_0_50px_rgba(99,102,241,0.4)] hover:scale-[1.02] active:scale-[0.98]"
            >
              {t("home.final.cta")}
              <Icon name="phone" className="h-5 w-5" />
            </a>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-gray-200 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              {t("home.final.pricing")}
            </Link>
          </div>
          <p className="mt-5 text-sm text-gray-500">
            {t("home.final.note")} {t("home.final.ready")}{" "}
            <Link to="/signup" className="font-medium text-indigo-300 underline underline-offset-4 transition hover:text-white">
              {t("home.final.createAccount")}
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
