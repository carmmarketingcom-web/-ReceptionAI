import { useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/demo")({
  component: DemoPage,
});

const demoScript = [
  { speaker: "caller", text: "Hi, I need my AC fixed. Can you help?", highlight: "call-handling" },
  { speaker: "ai", text: "Of course! I can help you book a service visit. What's your name?" },
  { speaker: "caller", text: "I'm David from 123 Oak Street." },
  { speaker: "ai", text: "Thanks David! Let me check available slots for tomorrow...", highlight: "availability" },
  { speaker: "ai", text: "Great, I have an opening at 10 AM tomorrow morning. Does that work?" },
  { speaker: "caller", text: "Perfect, book it!" },
  { speaker: "ai", text: "Done! Your appointment is confirmed for tomorrow at 10 AM. You'll receive an SMS reminder. Is there anything else?", highlight: "booking" },
  { speaker: "caller", text: "No, that's all. Thanks!" },
  { speaker: "ai", text: "You're welcome, David! Have a great day." },
];

const TYPING_DELAY_MS = 1200; // delay between each message
const TOTAL_DURATION = (demoScript.length + 2) * TYPING_DELAY_MS; // +2 for typing indicator

function DemoPage() {
  const [demoKey, setDemoKey] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const resetDemo = () => {
    setDemoKey((k) => k + 1);
    setHighlight(null);
  };

  const features = [
    { id: "call-handling", title: "24/7 Call Answering", desc: "Never miss a lead — AI answers instantly, day or night", icon: "📞" },
    { id: "availability", title: "Smart Scheduling", desc: "Checks your calendar and books automatically", icon: "📅" },
    { id: "booking", title: "Instant Confirmations", desc: "Sends SMS confirmations & reminders", icon: "✅" },
  ];

  // Highlight sync: each message with a highlight sets it, then clears after 3s
  const handleHighlight = (h: string | undefined) => {
    if (h) {
      setHighlight(h);
      setTimeout(() => setHighlight(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 via-white to-white">
      {/* CSS-only animation for demo messages — works without JS hydration */}
      <style>{`
        @keyframes demoFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes demoBounce {
          0%, 80%, 100% { transform: scale(0.4); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        .demo-msg-initial { opacity: 0; transform: translateY(8px); }
        .demo-msg-animate { animation: demoFadeIn 0.4s ease-out forwards; }
        .demo-typing-dot { animation: demoBounce 1.4s infinite ease-in-out both; }
        .demo-typing-dot:nth-child(1) { animation-delay: 0s; }
        .demo-typing-dot:nth-child(2) { animation-delay: 0.16s; }
        .demo-typing-dot:nth-child(3) { animation-delay: 0.32s; }
      `}</style>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">Live Demo</span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            See ReceptionAI in action
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "#111827" }}>
            Watch how the AI receptionist handles a real customer call — automatically booking appointments, checking availability, and sending confirmations.
          </p>
        </div>

        {/* Promo Video */}
        <div className="mt-10 flex justify-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
            <div className="relative" style={{ paddingBottom: "177.78%" }}>
              <iframe
                src="https://www.youtube.com/embed/74K17_g_Ir8?rel=0"
                title="ReceptionAI Promo Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-center">
              <p className="text-sm font-medium text-gray-700">Akoni Cooling &amp; Heating — Powered by ReceptionAI</p>
            </div>
          </div>
        </div>

        {/* Demo Section */}
        <div className="mt-12 flex flex-col items-center gap-8 lg:flex-row lg:items-start">
          {/* Phone Mockup */}
          <div className="w-full max-w-sm">
            <div className="overflow-hidden rounded-[2.5rem] border-4 border-gray-800 bg-white shadow-2xl">
              {/* Phone notch */}
              <div className="relative flex items-center justify-center bg-gray-800 py-3">
                <div className="h-5 w-24 rounded-full bg-gray-900" />
                <div className="absolute right-4 top-3 h-3 w-3 rounded-full bg-green-500" />
              </div>

              {/* Conversation — ALL messages rendered in HTML, animated with CSS delays */}
              <div key={demoKey} ref={chatRef} className="h-[520px] space-y-3 overflow-y-auto bg-gray-50 p-4">
                {/* AI greeting (always visible) */}
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-indigo-600 px-4 py-2 text-sm text-white shadow-sm">
                    <p className="font-semibold">ReceptionAI</p>
                    <p>Thank you for calling. How can I help you today?</p>
                  </div>
                </div>

                {/* Demo script messages — all in HTML, CSS animation with staggered delays */}
                {demoScript.map((msg, i) => {
                  const delay = (i + 1) * TYPING_DELAY_MS;
                  const isCaller = msg.speaker === "caller";
                  return (
                    <div
                      key={i}
                      className={`flex ${isCaller ? "justify-end" : "justify-start"} demo-msg-initial`}
                      style={{ animation: `demoFadeIn 0.4s ease-out ${delay}ms forwards` }}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
                          isCaller ? "rounded-br-sm bg-gray-200 text-gray-900" : "rounded-bl-sm bg-indigo-600 text-white"
                        }`}
                      >
                        {!isCaller && <p className="text-[10px] font-semibold text-indigo-200">ReceptionAI</p>}
                        <p className="text-sm">{msg.text}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator — CSS animated dots */}
                <div
                  className="demo-msg-initial flex justify-start"
                  style={{ animation: `demoFadeIn 0.3s ease-out ${(demoScript.length + 1) * TYPING_DELAY_MS}ms forwards` }}
                >
                  <div className="flex items-center gap-1 rounded-2xl bg-indigo-100 px-4 py-3">
                    <span className="demo-typing-dot inline-block h-2 w-2 rounded-full bg-indigo-400" />
                    <span className="demo-typing-dot inline-block h-2 w-2 rounded-full bg-indigo-400" />
                    <span className="demo-typing-dot inline-block h-2 w-2 rounded-full bg-indigo-400" />
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="border-t border-gray-100 bg-white p-3">
                <button
                  onClick={resetDemo}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  Watch Again
                </button>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-gray-400">Interactive demo — watch how calls are handled automatically</p>
          </div>

          {/* Feature callouts */}
          <div className="flex-1 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">What's happening:</h2>
            {features.map((f) => (
              <div
                key={f.id}
                className={`rounded-xl border p-5 transition-all duration-500 ${
                  highlight === f.id
                    ? "border-indigo-300 bg-indigo-50 shadow-md shadow-indigo-100"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{f.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{f.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
              <h3 className="font-semibold text-gray-900">Available in English & Spanish</h3>
              <p className="mt-1 text-sm text-gray-600">Your customers can interact in the language they prefer. The AI seamlessly switches between both.</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">EN</span>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">ES</span>
              </div>
            </div>

            <Link
              to="/signup"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-700"
            >
              Start Today
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Calendar Demo */}
        <div className="mt-24">
          <div className="text-center">
            <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">Built-in Calendar</span>
            <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">No Google OAuth. No external calendar.</h2>
            <p className="mx-auto mt-3 max-w-xl text-gray-600">
              ReceptionAI has its own scheduling system. Set your business hours and it handles everything — bookings, reminders, and follow-ups.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h3 className="text-lg font-semibold text-gray-900">July 2026</h3>
                <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="flex gap-2">
                <span className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white">Week</span>
                <span className="rounded-lg px-4 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100">Month</span>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-gray-100 bg-white text-center text-xs">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="border-r border-gray-50 py-3 font-semibold text-gray-500 last:border-r-0">
                  {day}
                </div>
              ))}
              {[26, 27, 28, 29, 30, 31, 1].map((date, i) => (
                <div key={i} className={`border-r border-gray-50 py-2 font-bold last:border-r-0 ${i === 2 ? "rounded-full bg-indigo-600 text-white mx-auto flex h-9 w-9 items-center justify-center" : "text-gray-900"}`}>
                  {date}
                </div>
              ))}
            </div>

            <div className="divide-y divide-gray-50">
              {[
                { time: "8:00 AM", booked: false },
                { time: "9:00 AM", booked: true, client: "Sarah Johnson", service: "AC Repair", color: "bg-amber-100 border-amber-300 text-amber-800" },
                { time: "10:00 AM", booked: true, client: "David (demo call)", service: "AC Service Visit", color: "bg-green-100 border-green-300 text-green-800", highlight: true },
                { time: "11:00 AM", booked: false },
                { time: "12:00 PM", booked: true, client: "Mike Torres", service: "Plumbing Inspection", color: "bg-blue-100 border-blue-300 text-blue-800" },
                { time: "1:00 PM", booked: false },
                { time: "2:00 PM", booked: false },
                { time: "3:00 PM", booked: true, client: "Emily Davis", service: "Electrical Check", color: "bg-purple-100 border-purple-300 text-purple-800" },
              ].map((slot) => (
                <div key={slot.time} className={`flex items-center gap-4 px-6 py-3 ${slot.highlight ? "bg-green-50" : ""}`}>
                  <span className="w-20 shrink-0 text-sm font-medium text-gray-500">{slot.time}</span>
                  {slot.booked ? (
                    <div className={`flex-1 rounded-lg border px-4 py-2 ${slot.color} ${slot.highlight ? "ring-2 ring-green-400 ring-offset-1" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{slot.client}</p>
                          <p className="text-xs opacity-75">{slot.service}</p>
                        </div>
                        {slot.highlight && (
                          <span className="rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">Just Booked!</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 rounded-lg border border-dashed border-gray-200 py-2.5 text-center text-xs text-gray-300">
                      Available
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-gray-400">
            Example calendar — sample appointments shown for illustration, not real customer data.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
              <span className="text-2xl">⏰</span>
              <h4 className="mt-2 font-semibold text-gray-900">Auto-Confirmations</h4>
              <p className="mt-1 text-xs text-gray-500">SMS confirmation sent instantly after booking</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
              <span className="text-2xl">🔔</span>
              <h4 className="mt-2 font-semibold text-gray-900">Smart Reminders</h4>
              <p className="mt-1 text-xs text-gray-500">Automatic reminders at 24h and 2h before each appointment</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
              <span className="text-2xl">📱</span>
              <h4 className="mt-2 font-semibold text-gray-900">Post-Call SMS</h4>
              <p className="mt-1 text-xs text-gray-500">Owner gets a text summary after every call — no dashboard needed</p>
            </div>
          </div>
        </div>

        {/* What you actually get — no customer quotes (we have none yet) */}
        <div className="mt-24">
          <div className="text-center">
            <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">Live today</span>
            <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">What happens when you call</h2>
            <p className="mx-auto mt-3 max-w-xl text-gray-600">
              ReceptionAI is new, so we're not going to quote customers we don't have yet. Call the number below and
              check every one of these yourself.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "🗣️",
                title: "A real conversation, in English or Spanish",
                body: "Press 1 for English or 2 for Spanish before the menu. No phone tree — you can just say what you need.",
              },
              {
                icon: "📅",
                title: "Books on the call, from your real calendar",
                body: "It reads live availability — your hours, your holidays, appointments already booked and a 15-minute buffer — books the slot, then texts the caller a confirmation.",
              },
              {
                icon: "🔔",
                title: "Reminders that go out on their own",
                body: "A text 24 hours before the appointment and again 2 hours before, in the caller's language.",
              },
              {
                icon: "🧑‍💼",
                title: "Press 3 and the call rings your phone",
                body: "Ask for a person and the call is bridged to you. If you can't pick up, the caller gets a text back so the conversation doesn't just end.",
              },
              {
                icon: "📱",
                title: "A summary text after every call",
                body: "Caller, duration, outcome and what they wanted — sent to your phone, no dashboard login needed.",
              },
              {
                icon: "🎙️",
                title: "Voicemail you can actually play",
                body: "Press 9 to leave a message: the recording is saved, playable in your dashboard, and you're alerted once.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Try it live CTA */}
        <div className="mt-20 text-center">
          <div className="mx-auto inline-flex items-center gap-4 rounded-2xl border-2 border-green-300 bg-green-50 px-8 py-5 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-200 text-2xl">
              📞
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-green-800">Want to try it yourself?</p>
              <p className="text-xs text-green-600">Call the AI receptionist right now — it's live</p>
              <a href="tel:+17279667556" className="text-2xl font-bold text-green-700 hover:text-green-600 transition tracking-wide">
                (727) 966-7556
              </a>
            </div>
          </div>
        </div>

        {/* Features grid */}
        <div className="mt-24">
          <h2 className="text-center text-2xl font-bold text-gray-900">Everything included</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: "🤖", title: "AI Call Answering", desc: "24/7 inbound call handling with natural conversation" },
              { icon: "📅", title: "Auto Scheduling", desc: "Books appointments automatically on your built-in calendar" },
              { icon: "💬", title: "Multi-Channel", desc: "Voice, SMS and web chat. WhatsApp and Facebook are in development." },
              { icon: "🌐", title: "Bilingual", desc: "English & Spanish — seamless switching" },
              { icon: "🔄", title: "Human Handoff", desc: "Smart escalation when needed" },
              { icon: "📊", title: "Analytics", desc: "Track calls, bookings, and missed opportunities" },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-gray-100 bg-white p-5 text-center shadow-sm">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-3 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
