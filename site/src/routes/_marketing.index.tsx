import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ChatWidgetPreview from "~/components/ChatWidgetPreview";

export const Route = createFileRoute("/_marketing/")({
  component: HomePage,
});

/* ─── Scroll Reveal Hook ─── */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
      className={`transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, suffix = "", label }: { target: number; suffix?: string; label: string }) {
  const { ref, visible } = useScrollReveal(0.5);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const duration = 2000;
    const step = Math.ceil(target / 60);
    const interval = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(interval); }
      else setCount(start);
    }, duration / 60);
    return () => clearInterval(interval);
  }, [visible, target]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl font-bold text-white sm:text-4xl">
        {visible ? count.toLocaleString() : "0"}{suffix}
      </div>
      <div className="mt-1 text-sm font-medium text-indigo-200">{label}</div>
    </div>
  );
}

function HomePage() {
  return (
    <>
      <HeroSection />
      <LogoCloud />
      <TestimonialsSection />
      <FeaturesOverview />
      <HowItWorks />
      <LiveChatSection />
      <StatsSection />
      <FinalCta />
    </>
  );
}

/* ─── Hero Section ─── */
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-indigo-50/30 to-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute -right-40 top-20 h-80 w-80 rounded-full bg-purple-100/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-32 lg:pt-24">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center">
          {/* Left: Text Content */}
          <Reveal className="flex-1 text-center lg:text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
              AI Receptionist — Now Available
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl lg:text-7xl">
              Never Miss a Lead Again.
              <br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Your AI Receptionist Works 24/7.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl lg:mx-0">
              ReceptionAI answers calls, texts, web chats, and messages — in English and
              Spanish — schedules appointments, sends reminders, and transfers to your
              team when needed. All for less than the cost of a human receptionist.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:shadow-indigo-300"
              >
                Watch the Demo
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                to="/features"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                See How It Works
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-3 text-sm text-gray-500 lg:justify-start">
              <div className="flex -space-x-2">
                {[
                  { initial: "MJ", color: "bg-red-100 text-red-600" },
                  { initial: "SK", color: "bg-blue-100 text-blue-600" },
                  { initial: "AR", color: "bg-green-100 text-green-600" },
                  { initial: "JL", color: "bg-amber-100 text-amber-600" },
                ].map((p, i) => (
                  <div
                    key={i}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-medium ${p.color}`}
                  >
                    {p.initial}
                  </div>
                ))}
              </div>
              <span>Trusted by 500+ businesses</span>
            </div>
          </Reveal>

          {/* Right: Hero Image — AI Receptionist Phone Mockup */}
          <Reveal delay={200} className="flex-1">
            <div className="relative">
              <img
                src="/images/hero.png"
                alt="ReceptionAI — Your AI Receptionist answering calls and booking appointments 24/7"
                className="w-full rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/50"
                width={1536}
                height={1024}
                loading="eager"
              />
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 opacity-30 blur-2xl" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Logo Cloud ─── */
function LogoCloud() {
  return (
    <section className="border-y border-gray-100 bg-white py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-6 text-center text-sm font-medium text-gray-500 transition-all duration-700">
          Trusted by businesses in every service industry
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {["HVAC", "Plumbing", "Electrical", "Dental", "Veterinary", "Law", "Med Spa", "Home Services"].map((ind) => (
            <span
              key={ind}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              {ind}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Testimonials ─── */
function TestimonialsSection() {
  const testimonials = [
    {
      quote: "We went from missing 40% of our calls to answering every single one. Our bookings doubled in the first month.",
      name: "Marcus Johnson",
      title: "Owner, Johnson's HVAC Services",
      initials: "MJ",
    },
    {
      quote: "The bilingual support is a game-changer. Our Spanish-speaking customers finally feel heard, and we've seen a 30% increase in appointments.",
      name: "Sofia Kim",
      title: "Practice Manager, Kim Dental Group",
      initials: "SK",
    },
    {
      quote: "I was skeptical about AI handling my calls, but ReceptionAI sounds natural and books appointments accurately. It's like having a full-time receptionist for a fraction of the cost.",
      name: "Alex Rodriguez",
      title: "Owner, Rodriguez Plumbing Co.",
      initials: "AR",
    },
  ];

  const [active, setActive] = useState(0);

  return (
    <section className="bg-gray-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            Testimonials
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Loved by business owners
          </h2>
        </Reveal>

        <div className="relative mx-auto mt-12 max-w-3xl">
          <Reveal delay={100}>
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
              <svg className="mb-4 h-8 w-8 text-indigo-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C6.546 6.068 6.983 8.789 6.983 11H11v10H0z" />
              </svg>
              <p className="text-lg leading-relaxed text-gray-700 sm:text-xl">&ldquo;{testimonials[active].quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">
                  {testimonials[active].initials}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{testimonials[active].name}</p>
                  <p className="text-sm text-gray-500">{testimonials[active].title}</p>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="mt-6 flex items-center justify-center gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`h-2.5 w-2.5 rounded-full transition ${i === active ? "w-6 bg-indigo-600" : "bg-gray-300 hover:bg-gray-400"}`}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Features Overview ─── */
function FeaturesOverview() {
  const features = [
    { icon: "📞", title: "24/7 Call Answering", desc: "Never miss a business opportunity. AI answers every call instantly, day or night, weekends and holidays included." },
    { icon: "🌐", title: "Bilingual (English & Spanish)", desc: "Serve your customers in the language they're most comfortable with. Seamless switching between English and Spanish." },
    { icon: "📅", title: "Smart Appointment Scheduling", desc: "AI reads your calendar and books appointments automatically. Send confirmations, reminders, and follow-ups via SMS or email." },
    { icon: "💬", title: "Omnichannel Inbox", desc: "Calls, texts, web chat, WhatsApp, Facebook — all conversations in one place. Never lose track of a lead." },
    { icon: "🔄", title: "Human Handoff When Needed", desc: "Smart escalation to your team. When the AI detects a complex issue, it transfers the call or chat seamlessly." },
    { icon: "📊", title: "Analytics & Insights", desc: "See how many calls you're missing, booking rates, peak hours, and customer satisfaction scores — all in one dashboard." },
  ];

  return (
    <section className="bg-white py-20 sm:py-28" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">Features</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Everything your business needs to handle inbound communications</h2>
          <p className="mt-4 text-lg text-gray-600">One platform that answers calls, messages, and schedules — so you can focus on doing what you do best.</p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 100}>
              <div className="group rounded-2xl border border-gray-100 bg-white p-6 transition hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl">{f.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─── */
function HowItWorks() {
  const steps = [
    { step: "01", title: "Connect Your Number", desc: "Port your existing business number or get a new one. Connect your calendar and we're ready to go." },
    { step: "02", title: "AI Takes the Calls", desc: "Your AI receptionist answers every call, asks the right questions, and books appointments — in English or Spanish." },
    { step: "03", title: "You Focus on the Work", desc: "Get notifications, see all conversations in your dashboard, and only step in when the AI transfers a call to you." },
  ];

  return (
    <section className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">Simple Setup</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">How It Works</h2>
          <p className="mt-4 text-lg text-gray-600">Get up and running in minutes, not days.</p>
        </Reveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.step} delay={i * 150}>
              <div className="relative text-center">
                {i < steps.length - 1 && <div className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-indigo-200 md:block" />}
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-lg shadow-indigo-200">
                  {s.step}
                </div>
                <h3 className="mt-6 text-lg font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Live Chat Section ─── */
function LiveChatSection() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-12 lg:flex-row">
          <Reveal className="flex-1">
            <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">Live Demo</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Try the AI receptionist right now</h2>
            <p className="mt-4 text-lg text-gray-600">See how ReceptionAI handles conversations in real-time. Ask about hours, pricing, or book an appointment.</p>
            <ul className="mt-6 space-y-3">
              {["Natural conversation in English & Spanish", "Instant answers about your business", "Smart appointment booking", "Seamless handoff to your team"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="h-5 w-5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={150} className="flex-1">
            <ChatWidgetPreview />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Stats Section ─── */
function StatsSection() {
  return (
    <section className="bg-indigo-600 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <AnimatedCounter target={1000000} suffix="+" label="Calls Answered" />
          <AnimatedCounter target={250000} suffix="+" label="Appointments Booked" />
          <AnimatedCounter target={500} suffix="+" label="Businesses Trust Us" />
          <AnimatedCounter target={2} suffix="s" label="Avg. Response Time" />
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ─── */
function FinalCta() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Ready to never miss a lead again?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">Join 500+ businesses that trust ReceptionAI to handle their inbound calls and messages. Start your free trial today — no credit card required.</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">
              View Pricing
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition hover:bg-gray-50">
              View Pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">Free 14-day trial. No credit card needed.</p>
        </Reveal>
      </div>
    </section>
  );
}