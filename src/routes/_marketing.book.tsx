import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";

export const Route = createFileRoute("/_marketing/book")({
  component: BookPage,
});

type Slot = { date: string; time: string; endTime: string; available: boolean };

const SERVICE_TYPES = [
  "Product Demo", "Pricing & Plans", "Get Started",
];

// Default demo org — in production this routes by domain/subdomain
const DEFAULT_ORG_ID = "demo";

export default function BookPage() {
  const [step, setStep] = useState<"form" | "slots" | "confirm" | "done">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [service, setService] = useState("General Service");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const findBtnRef = useRef<HTMLButtonElement>(null);

  // Get today's date as YYYY-MM-DD min
  const today = new Date().toISOString().split("T")[0];

  // Native DOM listener for Find Available Times button
  useEffect(() => {
    const el = findBtnRef.current;
    if (!el) return;
    const handler = async (e: Event) => {
      e.preventDefault();
      const n = nameRef.current?.value || "";
      const p = phoneRef.current?.value || "";
      const d = dateRef.current?.value || "";
      const s = serviceRef.current?.value || "General Service";
      const nt = notesRef.current?.value || "";
      const eAddr = emailRef.current?.value || "";
      setName(n); setPhone(p); setDate(d); setEmail(eAddr); setService(s); setNotes(nt);
      if (!n || !p || !d) { setError("Please fill in name, phone, and date."); return; }
      setLoading(true); setError("");
      try {
        const res = await fetch(`/api/booking/slots?org_id=${encodeURIComponent(DEFAULT_ORG_ID)}&date=${encodeURIComponent(d)}`);
        const data = (await res.json()) as { slots?: Slot[]; closed?: boolean; error?: string };
        if (data.error) { setError(data.error); setLoading(false); return; }
        setSlots(data.slots || []);
        setClosed(data.closed || false);
        setStep("slots");
      } catch {
        setError("Could not load available times. Please try again.");
      }
      setLoading(false);
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, []);

  const selectSlot = (s: Slot) => {
    setSelectedSlot(s);
    setStep("confirm");
  };

  // Native DOM listener for Schedule My Demo button
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = confirmBtnRef.current;
    if (!el || step !== "confirm") return;
    const handler = async (e: Event) => {
      e.preventDefault();
      const slot = selectedSlot;
      if (!slot) return;
      setLoading(true); setError("");
      try {
        const res = await fetch("/api/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org_id: DEFAULT_ORG_ID, name, phone, email, date, service,
            time: slot.time, notes,
          }),
        });
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (data.error) { setError(data.error); setLoading(false); return; }
        setStep("done");
      } catch {
        setError("Could not complete booking. Please try again.");
      }
      setLoading(false);
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [step, selectedSlot, name, phone, email, date, service, notes]);

  const reset = () => {
    setStep("form");
    setSlots([]);
    setSelectedSlot(null);
    setError("");
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" className="flex items-center gap-2">
            <img src="/images/logo.png" alt="ReceptionAI" className="h-7 w-auto" width={800} height={450} />
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        {/* Step 1: Form */}
        {step === "form" && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-3xl">📅</div>
                  <h1 className="mt-4 text-2xl font-bold text-gray-900">Book a Demo</h1>
                  <p className="mt-1 text-sm text-gray-500">Schedule a call to see how ReceptionAI works for your business.</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Full Name *</label>
                    <input ref={nameRef} type="text" defaultValue={name}
                      placeholder="Your name" className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Phone *</label>
                    <input ref={phoneRef} type="tel" defaultValue={phone}
                      placeholder="(555) 123-4567" className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Email</label>
                    <input ref={emailRef} type="email" defaultValue={email}
                      placeholder="you@example.com" className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">I'm interested in</label>
                    <select ref={serviceRef} defaultValue={service}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                      {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Preferred Date *</label>
                    <input ref={dateRef} type="date" defaultValue={date} min={today}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Notes (optional)</label>
                    <textarea ref={notesRef} defaultValue={notes} rows={2}
                      placeholder="Anything we should know..." className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>

                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <button ref={findBtnRef} disabled={loading}
                  className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50">
                  {loading ? "Checking availability..." : "Find Available Times"}
                </button>
              </div>
            )}

            {/* Step 2: Slot picker */}
            {step === "slots" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900">Select a Time</h1>
                  <p className="mt-1 text-sm text-gray-500">{date} · {service}</p>
                </div>

                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}

                {!loading && closed && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                    <p className="text-lg">😴</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">We're closed on this day.</p>
                    <p className="mt-1 text-xs text-gray-500">Please pick a different date.</p>
                    <button onClick={reset} className="mt-4 text-sm font-medium text-indigo-600 hover:underline">Try another date</button>
                  </div>
                )}

                {!loading && !closed && slots.length === 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                    <p className="text-lg">📅</p>
                    <p className="mt-2 text-sm font-medium text-gray-900">No available times</p>
                    <p className="mt-1 text-xs text-gray-500">All slots are booked for this date. Try another day.</p>
                    <button onClick={reset} className="mt-4 text-sm font-medium text-indigo-600 hover:underline">Try another date</button>
                  </div>
                )}

                {!loading && !closed && slots.length > 0 && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((s, i) => (
                        <button key={i} onClick={() => selectSlot(s)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center text-sm font-medium text-gray-700 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700">
                          {s.time}
                        </button>
                      ))}
                    </div>
                    <button onClick={reset} className="w-full text-sm text-gray-400 hover:text-gray-600">← Back</button>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === "confirm" && selectedSlot && (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900">Confirm Demo</h1>
                  <p className="mt-1 text-sm text-gray-500">Review your demo details.</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Name</span><span className="font-medium text-gray-900">{name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Phone</span><span className="font-medium text-gray-900">{phone}</span></div>
                  {email && <div className="flex justify-between text-sm"><span className="text-gray-500">Email</span><span className="font-medium text-gray-900">{email}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Interest</span><span className="font-medium text-gray-900">{service}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Date</span><span className="font-medium text-gray-900">{date}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Time</span><span className="font-medium text-gray-900">{selectedSlot.time} – {selectedSlot.endTime}</span></div>
                </div>

                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <div className="flex gap-3">
                  <button onClick={() => setStep("slots")} disabled={loading}
                    className="flex-1 rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    ← Back
                  </button>
                  <button ref={confirmBtnRef} disabled={loading}
                    className="flex-[2] rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50">
                    {loading ? "Booking..." : "Schedule My Demo"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Done */}
            {step === "done" && (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">✅</div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Demo Scheduled!</h1>
                  <p className="mt-2 text-sm text-gray-600">You'll receive an SMS confirmation shortly. We look forward to showing you ReceptionAI.</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-left space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Date</span><span className="font-medium text-gray-900">{date}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Time</span><span className="font-medium text-gray-900">{selectedSlot?.time} – {selectedSlot?.endTime}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Interest</span><span className="font-medium text-gray-900">{service}</span></div>
                </div>
                <button onClick={reset} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  Schedule Another
                </button>
              </div>
            )}
      </div>
    </div>
  );
}
