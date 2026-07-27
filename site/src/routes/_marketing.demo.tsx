import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/demo")({
  component: DemoPage,
});

type DemoStep = {
  speaker: "caller" | "ai";
  text: string;
  delay: number;
  highlight?: string;
};

const demoScript: DemoStep[] = [
  { speaker: "caller", text: "Hi, I need my AC fixed. Can you help?", delay: 1000, highlight: "call-handling" },
  { speaker: "ai", text: "Of course! I can help you book a service visit. What's your name?", delay: 2000 },
  { speaker: "caller", text: "I'm David from 123 Oak Street.", delay: 2000 },
  { speaker: "ai", text: "Thanks David! Let me check available slots for tomorrow...", delay: 2500, highlight: "availability" },
  { speaker: "ai", text: "Great, I have an opening at 10 AM tomorrow morning. Does that work?", delay: 3000 },
  { speaker: "caller", text: "Perfect, book it!", delay: 2000 },
  { speaker: "ai", text: "Done! Your appointment is confirmed for tomorrow at 10 AM. You'll receive an SMS reminder. Is there anything else?", delay: 3500, highlight: "booking" },
  { speaker: "caller", text: "No, that's all. Thanks!", delay: 2000 },
  { speaker: "ai", text: "You're welcome, David! Have a great day.", delay: 2500 },
];

function DemoPage() {
  const [visibleMessages, setVisibleMessages] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) return;
    if (visibleMessages >= demoScript.length) return;

    const step = demoScript[visibleMessages];
    const timer = setTimeout(() => {
      setVisibleMessages((v) => v + 1);
      if (step.highlight) {
        setHighlight(step.highlight);
        setTimeout(() => setHighlight(null), 3000);
      }
    }, step.delay);

    return () => clearTimeout(timer);
  }, [visibleMessages, isPlaying]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [visibleMessages]);

  const resetDemo = () => {
    setVisibleMessages(0);
    setIsPlaying(true);
  };

  const features = [
    { id: "call-handling", title: "24/7 Call Answering", desc: "Never miss a lead — AI answers instantly, day or night", icon: "📞" },
    { id: "availability", title: "Smart Scheduling", desc: "Checks your calendar and books automatically", icon: "📅" },
    { id: "booking", title: "Instant Confirmations", desc: "Sends SMS confirmations & reminders", icon: "✅" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/30 via-white to-white">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">Live Demo</span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            See ReceptionAI in action
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            Watch how the AI receptionist handles a real customer call — automatically booking appointments, checking availability, and sending confirmations.
          </p>
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

              {/* Conversation */}
              <div
                ref={chatContainerRef}
                className="h-[520px] space-y-3 overflow-y-auto bg-gray-50 p-4"
              >
                {/* AI greeting (always visible) */}
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-indigo-600 px-4 py-2 text-sm text-white shadow-sm">
                    <p className="font-semibold">ReceptionAI</p>
                    <p>Thank you for calling. How can I help you today?</p>
                  </div>
                </div>

                {demoScript.slice(0, visibleMessages).map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.speaker === "caller" ? "justify-end" : "justify-start"} animate-fade-in`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
                        msg.speaker === "caller"
                          ? "rounded-br-sm bg-gray-200 text-gray-900"
                          : "rounded-bl-sm bg-indigo-600 text-white"
                      }`}
                    >
                      {msg.speaker === "ai" && <p className="text-[10px] font-semibold text-indigo-200">ReceptionAI</p>}
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {/* Typing indicator */}
                {visibleMessages < demoScript.length && isPlaying && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1 rounded-2xl bg-indigo-100 px-4 py-3">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="border-t border-gray-100 bg-white p-3">
                {visibleMessages >= demoScript.length ? (
                  <button
                    onClick={resetDemo}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    Watch Again
                  </button>
                ) : (
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                  >
                    {isPlaying ? (
                      <>
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                        Pause
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        Resume
                      </>
                    )}
                  </button>
                )}
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
              to="/pricing"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-700"
            >
              Start Free Trial
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mt-24">
          <div className="text-center">
            <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">Testimonials</span>
            <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">Trusted by businesses like yours</h2>
            <p className="mx-auto mt-3 max-w-xl text-gray-600">
              See what other service business owners say about ReceptionAI.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                quote: "We were missing about 10 calls a day. Since we switched to ReceptionAI, we haven't missed a single one. It books appointments automatically and our customers love that someone answers instantly.",
                name: "Mike Torres",
                business: "Torres HVAC & Plumbing",
                initials: "MT",
                color: "bg-red-100 text-red-600",
              },
              {
                quote: "I was skeptical about AI answering my dental patients, but after the first week I was sold. The Spanish/English switching is huge for my practice — my bilingual patients feel much more comfortable.",
                name: "Dr. Sofia Kim",
                business: "BrightSmile Dental",
                initials: "SK",
                color: "bg-blue-100 text-blue-600",
              },
              {
                quote: "Setup took 15 minutes. The AI handles 90% of my inbound calls and I only get transferred the complex legal intakes. It's like hiring a receptionist for $99/mo.",
                name: "James Carter",
                business: "Carter Law Group",
                initials: "JC",
                color: "bg-amber-100 text-amber-600",
              },
              {
                quote: "Best decision I've made for my business this year. My human receptionist went part-time, and ReceptionAI filled the gap flawlessly. Our booking rate went up 40%.",
                name: "Lisa Rodriguez",
                business: "Elite Med Spa",
                initials: "LR",
                color: "bg-green-100 text-green-600",
              },
              {
                quote: "I used to dread checking my voicemail after a weekend. Now every call is answered, every appointment booked. The SMS reminders alone cut our no-shows in half.",
                name: "Dave Chen",
                business: "Chen Electric",
                initials: "DC",
                color: "bg-purple-100 text-purple-600",
              },
              {
                quote: "We run 4 trucks and my office manager was overwhelmed. ReceptionAI handles scheduling, rescheduling, and follow-ups. My team actually leaves on time now.",
                name: "Alex Morton",
                business: "Morton Home Services",
                initials: "AM",
                color: "bg-pink-100 text-pink-600",
              },
            ].map((t) => (
              <div key={t.name} className="group rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-center gap-1 text-indigo-500">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">"{t.quote}"</p>
                <div className="mt-4 flex items-center gap-3 border-t border-gray-50 pt-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${t.color}`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.business}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features grid */}
        <div className="mt-24">
          <h2 className="text-center text-2xl font-bold text-gray-900">Everything included</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: "🤖", title: "AI Call Answering", desc: "24/7 inbound call handling with natural conversation" },
              { icon: "📅", title: "Auto Scheduling", desc: "Calendar sync & automatic appointment booking" },
              { icon: "💬", title: "Multi-Channel", desc: "Voice, SMS, web chat, WhatsApp & Facebook" },
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