import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/features")({
  component: FeaturesPage,
});

const features = [
  {
    category: "Call Handling",
    items: [
      {
        icon: "📞",
        title: "24/7 Call Answering",
        desc: "Your AI receptionist never sleeps. It answers every inbound call instantly, 24 hours a day, 365 days a year — including weekends and holidays.",
        details: [
          "No more missed calls after hours",
          "Instant answer — never a busy signal",
          "Handles multiple calls simultaneously",
          "Works during lunch breaks, holidays, weekends",
        ],
      },
      {
        icon: "🔄",
        title: "Smart Human Handoff",
        desc: "When the AI detects a complex issue, a frustrated customer, or a specific request, it seamlessly transfers the call to your team — with full context of the conversation.",
        details: [
          "Sentiment-based escalation detection",
          "Context-preserving transfer",
          "Customer never has to repeat themselves",
          "Optional whisper mode for team prep",
        ],
      },
      {
        icon: "🎯",
        title: "Custom Call Scripts",
        desc: "Train your AI receptionist with custom scripts tailored to your business. Define exactly what questions to ask and how to handle different scenarios.",
        details: [
          "Industry-specific conversation flows",
          "Custom FAQs and objection handling",
          "Perfect for HVAC, plumbing, dental, legal, etc.",
          "Update scripts anytime via dashboard",
        ],
      },
    ],
  },
  {
    category: "Messaging & Chat",
    items: [
      {
        icon: "💬",
        title: "Omnichannel Inbox",
        desc: "All conversations from every channel in one unified inbox. SMS, web chat, WhatsApp, Facebook Messenger — never lose track of a lead.",
        details: [
          "Unified inbox across all channels",
          "Threaded conversations with customer history",
          "Team collaboration (internal notes, assignments)",
          "Real-time sync across devices",
        ],
      },
      {
        icon: "🌐",
        title: "Bilingual Support",
        desc: "Serve your customers in English and Spanish seamlessly. The AI detects the language and responds accordingly — no configuration needed.",
        details: [
          "Automatic language detection",
          "Native-level fluency in both languages",
          "Mixed-language conversations handled gracefully",
          "Spanish-first businesses fully supported",
        ],
      },
      {
        icon: "🤖",
        title: "Web Chat Widget",
        desc: "A customizable chat widget for your website. Embed it with a single line of code. The AI handles visitor questions, books appointments, and captures leads.",
        details: [
          "Customizable colors and positioning",
          "Proactive engagement triggers",
          "Mobile-optimized",
          "GDPR and CCPA compliant",
        ],
      },
    ],
  },
  {
    category: "Scheduling & Calendar",
    items: [
      {
        icon: "📅",
        title: "Smart Appointment Booking",
        desc: "The AI reads your calendar and books appointments automatically. It checks availability, finds the best time slot, and confirms the booking — all in the conversation.",
        details: [
          "Google Calendar & Outlook integration",
          "Real-time availability checking",
          "Automatic conflict prevention",
          "Buffer time between appointments",
        ],
      },
      {
        icon: "🔔",
        title: "Automated Reminders",
        desc: "Reduce no-shows with automated reminders via SMS and email. Follow-up messages confirm appointments and ask for rescheduling if needed.",
        details: [
          "Customizable reminder timing (24h, 2h, 30min)",
          "Two-way SMS confirmation",
          "Reschedule/cancel handling",
          "Follow-up after appointment",
        ],
      },
      {
        icon: "📋",
        title: "Intake & Forms",
        desc: "Collect customer information, intake forms, and consent documents before appointments. The AI asks questions and fills forms automatically.",
        details: [
          "Custom intake questionnaires",
          "Digital signature collection",
          "Pre-appointment checklist",
          "HIPAA-compliant options for medical",
        ],
      },
    ],
  },
  {
    category: "Analytics & Management",
    items: [
      {
        icon: "📊",
        title: "Advanced Analytics",
        desc: "Track every metric that matters: call volume, answer rate, booking rate, peak hours, customer satisfaction, and more. All in one real-time dashboard.",
        details: [
          "Real-time call and chat metrics",
          "Booking funnel analysis",
          "Peak hour identification",
          "Customer satisfaction scores",
          "Exportable reports (CSV, PDF)",
        ],
      },
      {
        icon: "👥",
        title: "Team Management",
        desc: "Add your team members, set availability, define escalation rules, and manage who handles what. Perfect for growing businesses with multiple staff.",
        details: [
          "Role-based access control",
          "Individual team member schedules",
          "Skill-based routing",
          "Performance tracking per team member",
        ],
      },
      {
        icon: "🎙️",
        title: "Call Recordings",
        desc: "Every AI-handled call is recorded and transcribed. Review conversations, train your team, and ensure quality — all from your dashboard.",
        details: [
          "Full audio recordings",
          "AI-generated transcripts with timestamps",
          "Search by keyword, date, or customer",
          "Share recordings with team members",
        ],
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white via-indigo-50/30 to-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            Features
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Everything you need to handle your inbound communications
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            ReceptionAI combines call answering, messaging, scheduling, and analytics into one
            seamless platform. Here's everything we offer.
          </p>
        </div>
      </section>

      {/* Feature Categories */}
      {features.map((category) => (
        <section key={category.category} className="border-b border-gray-100 bg-white py-16 last:border-0">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900">{category.category}</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {category.items.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-gray-100 bg-white p-6 transition hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{feature.desc}</p>
                  <ul className="mt-4 space-y-2">
                    {feature.details.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm text-gray-500">
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="bg-indigo-600 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">
            Ready to transform your business communications?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
            Join 500+ businesses that never miss a lead. Start your free trial today.
          </p>
          <div className="mt-8">
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-600 transition hover:bg-indigo-50"
            >
              Start Free Trial
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}