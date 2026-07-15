import { Link, createFileRoute } from "@tanstack/react-router";
import { t } from "~/lib/i18n";

export const Route = createFileRoute("/_marketing/")({
  component: HomePage,
});

function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Logo Cloud */}
      <LogoCloud />

      {/* Features Overview */}
      <FeaturesOverview />

      {/* How It Works */}
      <HowItWorks />

      {/* Stats Section */}
      <StatsSection />

      {/* Final CTA */}
      <FinalCta />
    </>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-indigo-50/30 to-white">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute -right-40 top-20 h-80 w-80 rounded-full bg-purple-100/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-32 lg:pt-24">
        <div className="text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
            <span className="flex h-2 w-2 rounded-full bg-green-500" />
            AI Receptionist — Now Available
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl lg:text-7xl">
            Never Miss a Lead Again.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Your AI Receptionist Works 24/7.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            ReceptionAI answers calls, texts, web chats, and messages — in English and
            Spanish — schedules appointments, sends reminders, and transfers to your
            team when needed. All for less than the cost of a human receptionist.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:shadow-indigo-300"
            >
              Start Free Trial
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Watch Demo
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Link>
          </div>

          {/* Social Proof */}
          <div className="mt-8 flex items-center justify-center gap-3 text-sm text-gray-500">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-xs font-medium text-indigo-600"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <span>Trusted by 500+ businesses</span>
          </div>
        </div>

        {/* Dashboard Preview Mockup */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/50">
            <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="ml-3 text-xs font-medium text-gray-400">ReceptionAI Dashboard</div>
            </div>
            <div className="grid grid-cols-4 gap-4 p-6">
              <div className="col-span-1 hidden flex-col gap-3 sm:flex">
                <div className="h-8 w-full rounded-lg bg-indigo-100" />
                <div className="h-8 w-full rounded-lg bg-gray-100" />
                <div className="h-8 w-full rounded-lg bg-gray-100" />
                <div className="h-8 w-full rounded-lg bg-gray-100" />
              </div>
              <div className="col-span-4 space-y-4 sm:col-span-3">
                <div className="flex gap-4">
                  <div className="h-20 flex-1 rounded-xl bg-indigo-50 p-3">
                    <div className="h-2 w-16 rounded bg-indigo-200" />
                    <div className="mt-2 h-6 w-12 rounded bg-indigo-300" />
                  </div>
                  <div className="h-20 flex-1 rounded-xl bg-green-50 p-3">
                    <div className="h-2 w-16 rounded bg-green-200" />
                    <div className="mt-2 h-6 w-12 rounded bg-green-300" />
                  </div>
                  <div className="h-20 flex-1 rounded-xl bg-amber-50 p-3">
                    <div className="h-2 w-16 rounded bg-amber-200" />
                    <div className="mt-2 h-6 w-12 rounded bg-amber-300" />
                  </div>
                </div>
                <div className="h-32 w-full rounded-xl bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-1">
                      <div className="h-2 w-32 rounded bg-gray-200" />
                      <div className="h-2 w-48 rounded bg-gray-100" />
                    </div>
                    <div className="h-5 w-14 rounded-full bg-green-100" />
                  </div>
                  <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-1">
                      <div className="h-2 w-28 rounded bg-gray-200" />
                      <div className="h-2 w-40 rounded bg-gray-100" />
                    </div>
                    <div className="h-5 w-14 rounded-full bg-blue-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Glow effect */}
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 opacity-30 blur-2xl" />
        </div>
      </div>
    </section>
  );
}

function LogoCloud() {
  const industries = [
    "HVAC",
    "Plumbing",
    "Electrical",
    "Dental",
    "Veterinary",
    "Law",
    "Med Spa",
    "Home Services",
  ];
  return (
    <section className="border-y border-gray-100 bg-white py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-6 text-center text-sm font-medium text-gray-500">
          Trusted by businesses in every service industry
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {industries.map((ind) => (
            <span
              key={ind}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700"
            >
              {ind}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesOverview() {
  const features = [
    {
      icon: "📞",
      title: "24/7 Call Answering",
      desc: "Never miss a business opportunity. AI answers every call instantly, day or night, weekends and holidays included.",
    },
    {
      icon: "🌐",
      title: "Bilingual (English & Spanish)",
      desc: "Serve your customers in the language they're most comfortable with. Seamless switching between English and Spanish.",
    },
    {
      icon: "📅",
      title: "Smart Appointment Scheduling",
      desc: "AI reads your calendar and books appointments automatically. Send confirmations, reminders, and follow-ups via SMS or email.",
    },
    {
      icon: "💬",
      title: "Omnichannel Inbox",
      desc: "Calls, texts, web chat, WhatsApp, Facebook — all conversations in one place. Never lose track of a lead.",
    },
    {
      icon: "🔄",
      title: "Human Handoff When Needed",
      desc: "Smart escalation to your team. When the AI detects a complex issue, it transfers the call or chat seamlessly.",
    },
    {
      icon: "📊",
      title: "Analytics & Insights",
      desc: "See how many calls you're missing, booking rates, peak hours, and customer satisfaction scores — all in one dashboard.",
    },
  ];

  return (
    <section className="bg-white py-20 sm:py-28" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            Features
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything your business needs to handle inbound communications
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            One platform that answers calls, messages, and schedules — so you can focus on
            doing what you do best.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-gray-100 bg-white p-6 transition hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/features"
            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
          >
            View all features
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Connect Your Number",
      desc: "Port your existing business number or get a new one. Connect your calendar and we're ready to go.",
    },
    {
      step: "02",
      title: "AI Takes the Calls",
      desc: "Your AI receptionist answers every call, asks the right questions, and books appointments — in English or Spanish.",
    },
    {
      step: "03",
      title: "You Focus on the Work",
      desc: "Get notifications, see all conversations in your dashboard, and only step in when the AI transfers a call to you.",
    },
  ];

  return (
    <section className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            Simple Setup
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Get up and running in minutes, not days.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.step} className="relative text-center">
              {i < steps.length - 1 && (
                <div className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-indigo-200 md:block" />
              )}
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-lg shadow-indigo-200">
                {s.step}
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { label: "Calls Answered", value: "1M+" },
    { label: "Appointments Booked", value: "250K+" },
    { label: "Businesses Trust Us", value: "500+" },
    { label: "Avg. Response Time", value: "< 2s" },
  ];

  return (
    <section className="bg-indigo-600 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold text-white sm:text-4xl">{s.value}</div>
              <div className="mt-1 text-sm font-medium text-indigo-200">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Ready to never miss a lead again?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
          Join 500+ businesses that trust ReceptionAI to handle their inbound calls and
          messages. Start your free trial today — no credit card required.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/demo"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
          >
            Start Free Trial
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            View Pricing
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">Free 14-day trial. No credit card needed.</p>
      </div>
    </section>
  );
}