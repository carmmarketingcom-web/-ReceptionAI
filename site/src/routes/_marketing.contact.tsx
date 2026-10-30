import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/contact")({
  component: ContactPage,
});

const beforeYouEmail = [
  "Your business name — this is what the AI says when it answers (\"Thanks for calling …\").",
  "The phone number you want answered, and whether it is a new number or one you already have.",
  "What you want the AI to do on a call: book appointments, answer common questions, take messages, or transfer to you.",
];

function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 h-[500px] w-[500px] translate-x-1/4 -translate-y-1/4 rounded-full bg-indigo-600/25 blur-[150px]" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] -translate-x-1/4 translate-y-1/4 rounded-full bg-purple-600/20 blur-[140px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300 backdrop-blur-sm">
            Contact
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Talk to a human
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
            Questions about plans, setup, or whether ReceptionAI fits your business — email us, or ask the chat widget
            on this page. Every message goes to a person.
          </p>
        </div>
      </section>

      {/* Three ways to reach us */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Web chat — fastest */}
            <div className="flex flex-col rounded-2xl border border-indigo-200 bg-indigo-50/50 p-7 ring-1 ring-indigo-100">
              <span className="w-fit rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                Fastest
              </span>
              <h2 className="mt-4 text-lg font-bold text-gray-900">Ask the chat widget</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
                The chat widget in the bottom-right corner of this page answers instantly, in English or Spanish, and
                can pass a message on to us if it can't help.
              </p>
              <p className="mt-4 text-sm font-medium text-indigo-700">Open it with the "Chat with us" button.</p>
            </div>

            {/* Email */}
            <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Email</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
                For anything that needs a longer answer — setup questions, billing, or a plan recommendation.
              </p>
              <a
                href="mailto:hello@receptionai.store"
                className="mt-4 break-all text-sm font-semibold text-indigo-600 underline underline-offset-4 transition hover:text-indigo-700"
              >
                hello@receptionai.store
              </a>
            </div>

            {/* Demo line */}
            <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Demo line</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
                <span className="font-semibold text-gray-900">(727) 966-7556</span> is a live demo of the AI — call it
                and you'll talk to the receptionist exactly as your callers would. It is not a support line, and
                nobody will pick up on the other end: it is the AI.
              </p>
              <a
                href="tel:+17279667556"
                className="mt-4 text-sm font-semibold text-indigo-600 underline underline-offset-4 transition hover:text-indigo-700"
              >
                Call the demo line
              </a>
            </div>
          </div>

          <p className="mt-8 text-center text-sm leading-relaxed text-gray-500">
            We don't promise a response time. Email is read by a person, and the chat widget answers immediately.
          </p>
        </div>
      </section>

      {/* Before you email */}
      <section className="border-t border-gray-100 bg-gray-50 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Before you email</h2>
          <p className="mt-3 text-base leading-relaxed text-gray-600">
            Including these three things means we can answer properly the first time instead of going back and forth:
          </p>
          <ul className="mt-6 space-y-4">
            {beforeYouEmail.map((item, i) => (
              <li key={item} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-gray-500">
            Also useful, if you have it: your current business hours, and the services you want the AI to be able to
            book.
          </p>
        </div>
      </section>

      {/* Links onward */}
      <section className="bg-indigo-600 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Not sure yet?</h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-indigo-100">
            Call the demo line and hear it answer, or read the plans and what each one includes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="tel:+17279667556"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-600 transition hover:bg-indigo-50"
            >
              Hear the live demo — (727) 966-7556
            </a>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-400 bg-transparent px-8 py-4 text-base font-semibold text-white transition hover:bg-indigo-500/20"
            >
              See pricing
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-indigo-200">
            <Link to="/about" className="underline underline-offset-4 transition hover:text-white">
              About ReceptionAI
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
