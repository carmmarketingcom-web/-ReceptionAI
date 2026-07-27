import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/getting-started")({
  component: GettingStartedPage,
});

const steps = [
  {
    num: 1,
    title: "Set your business hours",
    desc: "Tell the AI when to answer calls. Outside these hours, callers will hear a voicemail message instead. Monday–Friday 9–5 is already set as the default.",
    link: "/dashboard/settings",
    linkText: "Go to Settings →",
  },
  {
    num: 2,
    title: "Add your services",
    desc: "List the services your business offers. This helps the AI understand what customers are calling about and book the right type of appointment.",
    link: "/dashboard/settings",
    linkText: "Add services →",
  },
  {
    num: 3,
    title: "Share your phone number",
    desc: "Once your number is active, give it to customers, put it on your website, and list it on Google. Every call is answered instantly by your AI receptionist.",
    link: "/dashboard",
    linkText: "Find your number on the dashboard →",
  },
  {
    num: 4,
    title: "Test your AI receptionist",
    desc: "Call your number and talk to the AI. Test different scenarios: book an appointment, ask about pricing, check your hours. You can review every conversation in the dashboard.",
    link: "/dashboard/conversations",
    linkText: "View conversations →",
  },
  {
    num: 5,
    title: "Embed the web chat widget on your site",
    desc: "Add the AI chat widget to your website so visitors can ask questions and book appointments without picking up the phone. Copy the embed code from your dashboard widget page.",
    link: "/dashboard/widget",
    linkText: "Get embed code →",
  },
];

export default function GettingStartedPage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/dashboard" className="flex items-center gap-2">
            <img src="/images/logo.png" alt="ReceptionAI" className="h-7 w-auto" width={800} height={450} />
          </a>
          <Link to="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-700">
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Getting Started</h1>
          <p className="mt-2 text-gray-500">
            Follow these 5 steps to get your AI receptionist up and running. Each step takes about a minute.
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.num} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {s.num}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{s.desc}</p>
                  <Link
                    to={s.link}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    {s.linkText}
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 text-center">
          <p className="text-sm font-medium text-indigo-900">Need help?</p>
          <p className="mt-1 text-sm text-indigo-700">
            Call your AI receptionist at your business number and ask for help, or email us at{" "}
            <a href="mailto:hello@receptionai.store" className="underline">hello@receptionai.store</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
