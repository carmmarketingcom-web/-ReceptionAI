import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/features")({
  component: FeaturesPage,
});

/* ─── Local SVG icon set (same vocabulary as the homepage) ─── */
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

/* ─── Honest status vocabulary ───
   live    = running in the account today
   partial = part of it is live, the rest is still being built (the card note says which)
   coming  = designed, not available yet */
type Status = "live" | "partial" | "coming";

const statusChip: Record<Status, { label: string; className: string; dot: string }> = {
  live: {
    label: "Live",
    className: "border-green-500/30 bg-green-500/10 text-green-300",
    dot: "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]",
  },
  partial: {
    label: "Partial",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  coming: {
    label: "Coming Soon",
    className: "border-white/15 bg-white/5 text-gray-300",
    dot: "bg-gray-400",
  },
};

type Plan = "growth" | "scale";

const planTag: Record<Plan, { label: string; className: string }> = {
  growth: {
    label: "Part of Growth",
    className: "border-indigo-400/30 bg-indigo-500/15 text-indigo-200",
  },
  scale: {
    label: "Part of Scale",
    className: "border-purple-400/30 bg-purple-500/15 text-purple-200",
  },
};

function StatusChip({ status }: { status: Status }) {
  const s = statusChip[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function PlanTag({ plan }: { plan: Plan }) {
  const p = planTag[plan];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${p.className}`}>
      {p.label}
    </span>
  );
}

/* ─── What is running in every account today (verified live) ─── */
const liveFeatures = [
  {
    icon: "phone",
    title: "24/7 Call Answering",
    desc: "Your AI receptionist answers inbound calls day or night — weekends and holidays included — and handles more than one call at a time.",
  },
  {
    icon: "globe",
    title: "English & Spanish",
    desc: "Callers choose their language at the start of the call and the AI continues in it. Booking confirmations and reminders go out in the caller's language too.",
  },
  {
    icon: "calendar",
    title: "Real Bookings, Live Availability",
    desc: "The AI checks your business hours, holidays, existing appointments and a 15-minute buffer, offers actual open times, and books the appointment during the call.",
  },
  {
    icon: "clock",
    title: "Confirmations & Reminders",
    desc: "A completed booking sends an SMS confirmation, then reminders 24 hours and 2 hours before the appointment.",
  },
  {
    icon: "sms",
    title: "Post-Call Summary to Your Phone",
    desc: "After a call, the owner gets an SMS with the caller's number, what they needed, and what happened on the call.",
  },
  {
    icon: "chart",
    title: "Call Outcomes & Missed Calls",
    desc: "Every call is stored with a real outcome — booked, message taken, transferred, or missed — and a missed call gets its own row on the dashboard.",
  },
];

/* ─── The six features the roadmap conversation is about ─── */
const roadmapFeatures: {
  icon: string;
  title: string;
  desc: string;
  status: Status;
  plan?: Plan;
  note?: string;
}[] = [
  {
    icon: "refresh",
    title: "Smart Human Handoff",
    status: "partial",
    desc: "A caller who wants a person can reach one. What is not built yet is the AI deciding on its own — from tone or sentiment — that a call needs a human.",
    note: "Live: call transfer to the owner + web-chat human requests. Sentiment-based smart handoff: coming.",
  },
  {
    icon: "wrench",
    title: "Custom Call Scripts",
    status: "coming",
    plan: "scale",
    desc: "Writing your own call scripts, question by question, and having the AI follow them for your business.",
    note: "Custom script authoring is still being built. Scale includes the customization work already on the roadmap — it is not something you can configure today.",
  },
  {
    icon: "chat",
    title: "Omnichannel Inbox",
    status: "partial",
    plan: "growth",
    desc: "One inbox where every conversation — call, text, chat, message — lands in the same thread with the same customer.",
    note: "Live: calls, SMS, and web chat. Unified multi-channel inbox: coming.",
  },
  {
    icon: "chart",
    title: "Advanced Analytics",
    status: "partial",
    plan: "growth",
    desc: "Deeper reporting on call volume, booking rates, peak hours and outcomes, instead of a summary of what happened.",
    note: "Live: call activity, missed calls, and outcomes. Advanced analytics dashboard: in progress.",
  },
  {
    icon: "globe",
    title: "Team Management",
    status: "partial",
    plan: "growth",
    desc: "Add your team, then send work to the right person by schedule, role and skill.",
    note: "Live: team members appear in the dashboard with your organization's real data. Per-member schedules and routing: coming.",
  },
  {
    icon: "phone",
    title: "Call Recordings",
    status: "partial",
    plan: "scale",
    desc: "Listen back to a call from the dashboard; the recording and the missed-call alert are already captured.",
    note: "Live: call and voicemail capture + missed-call alerts. Audio playback: coming.",
  },
];

const legend: { status: Status; meaning: string }[] = [
  { status: "live", meaning: "Running in your account today, on every plan that includes it." },
  { status: "partial", meaning: "Part of it works now — the note on the card says exactly which part." },
  { status: "coming", meaning: "Designed and on the roadmap, not available yet. Nothing to configure today." },
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-0 h-[640px] w-[640px] translate-x-1/4 rounded-full bg-indigo-600/25 blur-[150px]" />
          <div className="absolute bottom-0 left-0 h-[520px] w-[520px] -translate-x-1/4 translate-y-1/4 rounded-full bg-purple-600/20 blur-[140px]" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-5 py-2 text-sm font-medium text-indigo-300 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400" />
            Features
          </span>
          <h1 className="mt-7 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            What works today,
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              and what is still being built
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
            Every feature below carries its real status — Live, Partial, or Coming Soon — and the
            note on each card says exactly what runs today. If we cannot do it yet, the page says so.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all hover:from-indigo-400 hover:to-indigo-500"
            >
              Get Started
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-base font-semibold text-gray-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Legend */}
      <section className="border-t border-white/5 bg-gray-950 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {legend.map((l) => (
              <div key={l.status} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <StatusChip status={l.status} />
                <p className="mt-3 text-sm leading-relaxed text-gray-400">{l.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live today */}
      <section className="border-t border-white/10 bg-gray-950 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Live in your account today
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-400">
              These are running now — not roadmap items. The demo line uses the same call flow you
              get after you sign up.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {liveFeatures.map((f) => (
              <div
                key={f.title}
                className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-all hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-white/[0.06]"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
                  <Icon name={f.icon} className="h-5 w-5" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-white">{f.title}</h3>
                  <StatusChip status="live" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Real product screenshot */}
          <div className="mt-14">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-2">
              <img
                src="/images/calendar-dashboard.png"
                alt="ReceptionAI dashboard calendar showing booked appointments"
                className="mx-auto w-full max-w-[960px] rounded-xl"
                loading="lazy"
              />
            </div>
            <p className="mt-3 text-center text-sm text-gray-500">
              The built-in calendar in the dashboard — nothing to connect, nothing to sync.
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap features — the honest middle */}
      <section className="border-t border-white/10 bg-gray-950 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Where the bigger features stand
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-400">
              Four of these are partly live and two are still being built. Read the note on each
              card — that is the part that tells you what you would actually get today.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {roadmapFeatures.map((f) => (
              <div
                key={f.title}
                className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-all hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-white/[0.06]"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-indigo-300">
                  <Icon name={f.icon} className="h-5 w-5" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-white">{f.title}</h3>
                  <StatusChip status={f.status} />
                  {f.plan && <PlanTag plan={f.plan} />}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.desc}</p>
                {f.note && (
                  <p className="mt-auto pt-4 text-xs leading-relaxed text-gray-500">{f.note}</p>
                )}
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-gray-500">
            Plan tags show where a feature belongs on the roadmap. A tag never means the feature is
            switched on — the chip and the note do.
          </p>
        </div>
      </section>

      {/* Plain-words note */}
      <section className="border-t border-white/10 bg-gray-950 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-9">
            <h2 className="text-xl font-bold text-white">Why the labels matter</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              A features page is easy to fill with things that are not finished. We would rather
              show you six features marked Partial than six marked Live that fall apart on your
              first call. If something you need is not ready, tell us — it is how the roadmap gets
              prioritized.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <Link to="/demo" className="font-semibold text-indigo-300 underline decoration-indigo-400/30 underline-offset-4 transition hover:text-indigo-200">
                Try the demo line
              </Link>
              <Link to="/pricing" className="font-semibold text-indigo-300 underline decoration-indigo-400/30 underline-offset-4 transition hover:text-indigo-200">
                See what each plan includes
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gray-950 py-20 sm:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-indigo-600/15 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-[360px] w-[360px] rounded-full bg-purple-600/10 blur-[100px]" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Start with what already works
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-400">
            Call answering, real bookings, reminders and post-call summaries are live on every
            plan today. The rest arrives as it is finished.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all hover:from-indigo-400 hover:to-indigo-500 hover:shadow-[0_0_50px_rgba(99,102,241,0.4)]"
            >
              Get Started
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-gray-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              Get a Demo
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
