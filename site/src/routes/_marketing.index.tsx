import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ChatWidgetPreview from "~/components/ChatWidgetPreview";

export const Route = createFileRoute("/_marketing/")({
  component: HomePage,
});

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
  return (
    <div className="bg-white">
      <HeroSection />
      <LogoMarquee />
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
              AI Receptionist — Now Available
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl leading-[1.05]">
              Never miss
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                another lead
              </span>
              {" "}again.
            </h1>

            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-gray-400 sm:text-xl lg:mx-0">
              ReceptionAI answers calls, texts, web chats, and messages — in English and
              Spanish. Books appointments, sends reminders, and transfers to your
              team when needed. All for less than the cost of a human receptionist.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <Link
                to="/signup"
                className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all hover:from-indigo-400 hover:to-indigo-500 hover:shadow-[0_0_50px_rgba(99,102,241,0.4)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Start Free Trial
                <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link to="/features" className="group inline-flex items-center gap-2 rounded-xl px-6 py-4 text-sm font-medium text-gray-400 transition hover:text-white hover:bg-white/5">
                See how it works
                <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            {/* Trust */}
            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-gray-500 lg:justify-start justify-center">
              {["Free 14-day trial", "No credit card needed", "Cancel anytime"].map((label) => (
                <div key={label} className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <div className="relative lg:w-[110%]">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500/30 via-purple-500/20 to-pink-500/30 blur-xl" />
              <img
                src="/images/hero.png"
                alt="ReceptionAI — Your AI Receptionist answering calls and booking appointments 24/7"
                className="relative w-full rounded-2xl border border-white/10 shadow-2xl shadow-indigo-500/10"
                width={1536}
                height={1024}
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Logo Marquee ─── */
function LogoMarquee() {
  const industries = ["HVAC", "Plumbing", "Electrical", "Dental", "Veterinary", "Law", "Med Spa", "Home Services"];

  return (
    <section className="border-b border-gray-100 bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-gray-400">
          Built for every service industry
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {industries.map((ind) => (
            <span
              key={ind}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 hover:shadow-md"
            >
              {ind}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─── */
function HowItWorksSection() {
  const steps = [
    { icon: "phone", title: "We answer your calls 24/7", desc: "In English or Spanish. Every call, every time — no missed leads." },
    { icon: "calendar", title: "We book appointments automatically", desc: "On your built-in calendar. No Google account needed. Just set your hours." },
    { icon: "sms", title: "You get an SMS summary after every call", desc: "Caller info, duration, and outcome — straight to your phone. No dashboard required." },
  ];

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">How it works</span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">Your AI receptionist<br /><span className="text-indigo-600">in 3 simple steps</span></h2>
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
  const industries = ["HVAC", "Plumbing", "Electrical", "Dental", "Veterinary", "Legal", "Med Spa", "Home Services"];

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
                Built for trades — no integrations needed
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-gray-400 sm:text-xl">
              Your calendar is built right in. No ServiceTitan. No Housecall Pro.
              Nothing to connect. Nothing to sync. Just set your hours and go.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-500">
              <span className="font-semibold text-gray-300">Works great for:</span>
              {industries.map((ind, i) => (
                <span key={ind}>
                  {ind}{i < industries.length - 1 ? " •" : ""}
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
  const features = [
    { icon: "phone", title: "24/7 Call Answering", desc: "Never miss a business opportunity. AI answers every call instantly, day or night, weekends and holidays included." },
    { icon: "globe", title: "Bilingual (English & Spanish)", desc: "Serve your customers in the language they're most comfortable with. Seamless switching between English and Spanish." },
    { icon: "calendar", title: "Smart Appointment Scheduling", desc: "AI reads your calendar and books appointments automatically. Sends confirmations, reminders, and follow-ups." },
    { icon: "chat", title: "Omnichannel Inbox", desc: "Calls, texts, web chat, WhatsApp, Facebook — all conversations in one place. Never lose track of a lead." },
    { icon: "refresh", title: "Human Handoff When Needed", desc: "Smart escalation to your team. When the AI detects a complex issue, it transfers the call or chat seamlessly." },
    { icon: "chart", title: "Analytics & Insights", desc: "See how many calls you're missing, booking rates, peak hours, and customer satisfaction — all in one dashboard." },
  ];

  return (
    <section className="bg-white py-24 sm:py-32" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">Features</span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">Everything your business needs</h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-500 sm:text-xl">One platform. Calls, messages, scheduling — so you can focus on the work.</p>
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
      </div>
    </section>
  );
}

/* ─── How It Works (numbered) ─── */
function HowItWorks() {
  const steps = [
    { step: "01", title: "Connect Your Number", desc: "Port your existing business number or get a new one. Set your business hours and you're live." },
    { step: "02", title: "AI Takes the Calls", desc: "Your AI receptionist answers every call, asks the right questions, and books appointments — in English or Spanish." },
    { step: "03", title: "You Focus on Work", desc: "Get SMS summaries after every call. See everything in your dashboard. Only step in when you want to." },
  ];

  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">Simple Setup</span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">Up and running in minutes</h2>
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

/* ─── Social Proof ─── */
function SocialProof() {
  const quotes = [
    { text: "ReceptionAI handles all our after-hours calls. We've booked 40+ emergency jobs we would've missed.", author: "Mike R.", role: "HVAC Owner, Phoenix", icon: "phone" },
    { text: "My front desk was drowning. Now the AI handles routine booking and my staff focuses on patients in the office.", author: "Dr. Sarah L.", role: "Dental Practice, Austin", icon: "calendar" },
    { text: "The SMS summaries are genius. I know what happened on every call without logging into anything.", author: "James K.", role: "Plumbing Co., Denver", icon: "sms" },
  ];

  return (
    <section className="relative bg-gray-950 py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-4 py-1.5 text-sm font-semibold text-indigo-300 backdrop-blur-sm">
            Trusted by service businesses
          </span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Real results from
            <br />
            <span className="text-indigo-400">real business owners</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {quotes.map((q, i) => (
            <Reveal key={i} delay={i * 150}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm transition-all hover:bg-white/[0.06] hover:border-white/20">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Icon name={q.icon} className="h-5 w-5" />
                </div>
                <p className="text-sm leading-relaxed text-gray-300">"{q.text}"</p>
                <div className="mt-4 border-t border-white/5 pt-4">
                  <p className="text-sm font-semibold text-white">{q.author}</p>
                  <p className="text-xs text-gray-500">{q.role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Stats Bar ─── */
function StatsSection() {
  const features = [
    { icon: "phone", title: "24/7 Call Answering" },
    { icon: "globe", title: "English & Spanish" },
    { icon: "calendar", title: "Built-in Calendar" },
    { icon: "sparkle", title: "14-Day Free Trial" },
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
    {
      q: "Will my customers know it's AI?",
      a: "They'll hear a professional, friendly voice that greets them by name. Most callers don't realize it's AI — they just know someone answered and helped them. If they ever ask, we're transparent: they're speaking with an automated receptionist that can connect them to a real person anytime.",
    },
    {
      q: "What about emergencies? Burst pipe. No heat.",
      a: 'Press 3 at any time to transfer to you or your team. We suggest customizing your greeting: "If this is an emergency, press 3 now." Your customers always have a path to a human.',
    },
    {
      q: "What if it gets something wrong?",
      a: "You get an SMS after every call with the caller's number, what they asked, and what happened. If something needs your attention, you'll know within seconds. And we're always improving the AI — your feedback makes it smarter.",
    },
  ];

  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700">
            You've got questions. Fair ones.
          </span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Honest answers from a team
            <br />
            <span className="text-indigo-600">that builds for trades</span>
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
            Ready to never miss a lead again?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-400 sm:text-xl">
            Start your 14-day free trial today and see how ReceptionAI handles your inbound calls and messages.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all hover:from-indigo-400 hover:to-indigo-500 hover:shadow-[0_0_50px_rgba(99,102,241,0.4)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Free Trial
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white hover:border-white/20">
              View Pricing
            </Link>
          </div>
          <p className="mt-5 text-sm text-gray-500">Free 14-day trial. No credit card required. Cancel anytime.</p>
        </Reveal>
      </div>
    </section>
  );
}
