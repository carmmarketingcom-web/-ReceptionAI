import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/about")({
  component: AboutPage,
});

/* ─── What is shipped today (all of it live in the product) ─── */
const shipped = [
  "Answers calls 24/7, including nights, weekends and holidays — in English and Spanish.",
  "Books appointments during the call, against your real availability: your hours, your holidays, appointments already booked, and a 15-minute buffer.",
  "Texts the caller a confirmation, then reminders 24 hours and 2 hours before the appointment.",
  "Texts you a summary after every call: who called, how long it ran, and what happened.",
  "Transfers to you or your team when the caller asks for a person.",
  "Answers website chat in English and Spanish, with the same information as the phone line.",
  "Includes a built-in calendar, so there is nothing to connect before your first booking.",
  "Records voicemail and lets you play it back from the dashboard.",
];

/* ─── The only things that are genuinely not shipped. Same three items,
       same wording, as the block on /pricing. No dates, no promises. ─── */
const comingSoon = [
  {
    name: "WhatsApp messaging",
    body: "The AI answers WhatsApp messages the same way it answers calls and texts.",
  },
  {
    name: "Facebook Messenger",
    body: "Messenger conversations answered by the same AI, in the same dashboard.",
  },
  {
    name: "Google / Outlook calendar sync",
    body: "Two-way sync with the calendar you already use. Today ReceptionAI books into its own built-in calendar.",
  },
];

function Check() {
  return (
    <svg
      className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 h-[600px] w-[600px] translate-x-1/4 -translate-y-1/4 rounded-full bg-indigo-600/25 blur-[150px]" />
          <div className="absolute bottom-0 left-0 h-[500px] w-[500px] -translate-x-1/4 translate-y-1/4 rounded-full bg-purple-600/20 blur-[140px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300 backdrop-blur-sm">
            About ReceptionAI
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            A receptionist that never
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              misses the call
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
            ReceptionAI is an AI receptionist for small service businesses. It answers your calls 24/7 in English and
            Spanish, books appointments against live availability, texts the caller a confirmation and reminders, and
            texts you a summary after every call.
          </p>
        </div>
      </section>

      {/* Why it exists */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Why it exists</h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-gray-600">
            <p>
              A small service business runs on the phone. The problem is that the phone rings at the worst possible
              moment — while you are under a sink, on a roof, in an exam room, or driving between jobs.
            </p>
            <p>
              When nobody picks up, the caller does not wait and does not leave a message. They call the next business
              on the list. A missed call is usually a job that went to a competitor, and you never find out it
              happened.
            </p>
            <p>
              ReceptionAI exists so that call gets answered: the caller's name and number are taken, the appointment is
              booked into your calendar while they are still on the line, and you get a text telling you what happened.
            </p>
          </div>
        </div>
      </section>

      {/* What's live today */}
      <section className="border-y border-gray-100 bg-gray-50 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-3">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Live today
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">What it does now</h2>
            <p className="max-w-2xl text-base leading-relaxed text-gray-600">
              Everything below is built and running in the product. Call the demo line and you can hear it.
            </p>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {shipped.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4">
                <Check />
                <span className="text-sm leading-relaxed text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Coming soon */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Coming soon
              </span>
              <h2 className="text-2xl font-bold text-gray-900">Not shipped yet</h2>
              <p className="max-w-xl text-sm text-gray-500">
                These three are being built. They are not part of any plan yet, and we are not promising a date.
              </p>
            </div>
            <ul className="mt-6 space-y-4">
              {comingSoon.map((item) => (
                <li key={item.name} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Who runs it + how to reach a human */}
      <section className="bg-indigo-600 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Who runs it</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-indigo-100">
            ReceptionAI is operated by Carm Marketing LLC.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-indigo-200">
            You can reach a human by email or through the chat widget on this site — the details are on the contact
            page.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-600 transition hover:bg-indigo-50"
            >
              Contact us
            </Link>
            <a
              href="tel:+17279667556"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-400 bg-transparent px-8 py-4 text-base font-semibold text-white transition hover:bg-indigo-500/20"
            >
              Hear the live demo — (727) 966-7556
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-indigo-200">
            <Link to="/pricing" className="underline underline-offset-4 transition hover:text-white">
              See pricing
            </Link>
            <Link to="/demo" className="underline underline-offset-4 transition hover:text-white">
              Try the demo
            </Link>
            <Link to="/features" className="underline underline-offset-4 transition hover:text-white">
              See the features
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
