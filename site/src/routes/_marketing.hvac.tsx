import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/hvac")({
  component: HvacPage,
});

function HvacPage() {
  return (
    <>
      <HeroSection />
      <PainPointsSection />
      <HowItWorksSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}

/* ─── Hero ─── */
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-orange-50/20 to-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-orange-100/40 blur-3xl" />
        <div className="absolute -right-40 top-20 h-80 w-80 rounded-full bg-indigo-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-medium text-orange-700">
          <span className="flex h-2 w-2 rounded-full bg-orange-500" />
          For HVAC Contractors
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          Never miss an HVAC call again
          <br />
          <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            — even at 2 AM
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
          Your AI receptionist answers calls 24/7, books service appointments, and handles
          emergencies. Built-in calendar. No integrations needed.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 hover:shadow-orange-300"
          >
            Start Free Trial
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-gray-500">
            Try our demo:{" "}
            <a href="tel:+17279667556" className="text-indigo-600 hover:text-indigo-700">
              (727) 966-7556
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── Pain Points ─── */
function PainPointsSection() {
  const points = [
    {
      icon: "🚨",
      title: "Missed calls = lost revenue",
      desc: "Every missed HVAC call is a $200–500 service visit. In winter? Double that. Your AI answers every call — 24/7, holidays included.",
    },
    {
      icon: "📅",
      title: "Stop playing phone tag",
      desc: "Your AI books appointments directly on your calendar. No back-and-forth. No voicemail tag. Customer picks a time, it's on your schedule.",
    },
    {
      icon: "🇺🇸",
      title: "Bilingual, just like your customers",
      desc: "English and Spanish. Seamless. No configuration needed. Your AI greets callers in the language they're comfortable with.",
    },
  ];

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {points.map((p, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4 text-3xl">{p.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works for HVAC ─── */
function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "Customer calls — AI answers",
      desc: '"Hello, you\'ve reached [Your Business]. Press 1 to schedule service, press 2 for emergency."',
    },
    {
      step: "02",
      title: "AI books the job",
      desc: "Appointment goes on your calendar. You get an SMS summary with caller info, what they need, and when they're booked.",
    },
    {
      step: "03",
      title: "You show up and do the work",
      desc: "That's it. No phone tag. No missed leads. No 2 AM voicemails you check in the morning.",
    },
  ];

  return (
    <section className="bg-gray-50 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="rounded-full bg-orange-100 px-4 py-1.5 text-sm font-medium text-orange-700">
            How it works for HVAC
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Three steps. That's it.
          </h2>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.step} className="relative text-center">
              {i < steps.length - 1 && (
                <div className="absolute left-1/2 top-10 hidden h-0.5 w-full bg-orange-200 md:block" />
              )}
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-600 text-xl font-bold text-white shadow-lg shadow-orange-200">
                {s.step}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function FaqSection() {
  const faqs = [
    {
      q: "What about emergency calls at 2 AM?",
      a: "Press 2 routes emergency callers. They can also press 3 at any time to reach you directly. Your customers always have a path to a human when it's urgent.",
    },
    {
      q: "Will my customers know it's a robot?",
      a: "They'll hear a professional voice that greets them by name. Most never realize — they just know someone answered and helped them. If they ask, we're transparent.",
    },
    {
      q: "Does it work with ServiceTitan?",
      a: "You don't need it. Our calendar is built right in. No ServiceTitan. No Housecall Pro. Nothing to connect. Just set your hours and go.",
    },
  ];

  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            Honest answers
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Questions HVAC contractors actually ask
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-gray-900">{faq.q}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ─── */
function FinalCtaSection() {
  return (
    <section className="bg-orange-600 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to never miss an HVAC call again?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-orange-100">
          Start your 14-day free trial. No credit card required. Your AI receptionist goes live
          in minutes — not days.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-orange-600 shadow-lg transition hover:bg-orange-50"
          >
            Start Free Trial
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
        <p className="mt-4 text-sm text-orange-200">Free 14-day trial. Cancel anytime.</p>
      </div>
    </section>
  );
}
