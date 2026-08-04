import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import Header from "~/components/Header";
import Footer from "~/components/Footer";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("starter");
  const [acknowledgedTerms, setAcknowledgedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const planSelectRef = useRef<HTMLSelectElement>(null);

  // Native change listener — React onChange doesn't fire on some mobile browsers
  useEffect(() => {
    const el = planSelectRef.current;
    if (!el) return;
    const handler = () => setPlan(el.value);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);

  const deriveCompanyName = (emailAddr: string) => {
    const localPart = emailAddr.split("@")[0] || "";
    return localPart.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 20) || "My Business";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!acknowledgedTerms) {
      setError("Please acknowledge the terms to continue");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: deriveCompanyName(email),
          email,
          name: fullName,
          plan,
          useExistingNumber: false,
          existingPhoneNumber: "",
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong");
      }

      const { url } = (await res.json()) as { url: string };
      if (url) {
        window.location.href = url;
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const plans = [
    { value: "starter", label: "Starter — $99/mo", desc: "1 line, 500 AI-minutes, SMS + web chat" },
    { value: "growth", label: "Growth — $199/mo", desc: "2 lines, 2,000 AI-minutes, WhatsApp + analytics" },
    { value: "scale", label: "Scale — $399/mo", desc: "Unlimited lines, 10K+ minutes, custom AI, priority support" },
  ];

  const planBadges: Record<string, string> = {
    starter: "Popular",
    growth: "Best Value",
    scale: "Pro",
  };

  const planDetails: Record<string, { icon: string; features: string[] }> = {
    starter: {
      icon: "phone",
      features: ["1 phone line", "500 AI-minutes/mo", "SMS + Web Chat", "Built-in Calendar"],
    },
    growth: {
      icon: "globe",
      features: ["2 phone lines", "2,000 AI-minutes/mo", "WhatsApp + Facebook", "Analytics dashboard"],
    },
    scale: {
      icon: "sparkle",
      features: ["Unlimited lines", "10,000+ AI-minutes/mo", "Custom AI responses", "Priority support"],
    },
  };

  const selectedPlan = planDetails[plan];

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-amber-50/40 via-orange-50/20 to-white px-4 py-20 sm:py-28">
        <div className="w-full max-w-lg">
          {/* Card */}
          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/50 sm:p-10">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-200">
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                Start your free trial
              </h1>
              <p className="mt-1.5 text-sm text-gray-500">
                No credit card required. Set up in under 2 minutes.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label htmlFor="signupName" className="block text-sm font-semibold text-gray-700">
                  Full Name
                </label>
                <input
                  id="signupName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  autoFocus
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="signupEmail" className="block text-sm font-semibold text-gray-700">
                  Email
                </label>
                <input
                  id="signupEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Plan Selector — native <select> with planSelectRef */}
              <div>
                <label htmlFor="signupPlan" className="block text-sm font-semibold text-gray-700">
                  Plan
                </label>
                <div className="relative mt-1">
                  <select
                    id="signupPlan"
                    ref={planSelectRef}
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="block w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 pr-10 text-sm font-medium text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    style={{ WebkitAppearance: "none", MozAppearance: "none" }}
                  >
                    {plans.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>

                {/* Plan badge */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {planBadges[plan]}
                  </span>
                </div>

                {/* Selected plan features */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedPlan.features.map((feat) => (
                    <span key={feat} className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs text-green-700">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {feat}
                    </span>
                  ))}
                </div>
              </div>

              {/* FOUNDER50 — exclusive limited offer */}
              <div className="relative overflow-hidden rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
                <div className="absolute -right-3 -top-3 h-12 w-12 rounded-full bg-amber-200/50" />
                <p className="relative text-center text-sm font-bold text-amber-800">
                  <span className="inline-flex items-center gap-0.5">
                    <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                    FOUNDER50
                    <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                  </span>
                  {" — "}
                  50% off for 3 months, automatically applied!
                </p>
              </div>

              {/* Password — with trust cue */}
              <div>
                <label htmlFor="signupPassword" className="flex items-center justify-between text-sm font-semibold text-gray-700">
                  Password
                  <span className="flex items-center gap-1 text-xs font-normal text-blue-600">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    Encrypted
                  </span>
                </label>
                <input
                  id="signupPassword"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password (min 8 characters)"
                  className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Terms Checkbox */}
              <label className={`flex items-start gap-3 rounded-xl border p-3 transition-all cursor-pointer ${
                !acknowledgedTerms && error === "Please acknowledge the terms to continue"
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}>
                <input
                  type="checkbox"
                  checked={acknowledgedTerms}
                  onChange={(e) => { setAcknowledgedTerms(e.target.checked); setError(""); }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">
                  I agree to the Terms of Service and understand ReceptionAI is provided AS IS with no guarantees or liability.
                </span>
              </label>

              {!acknowledgedTerms && error === "Please acknowledge the terms to continue" && (
                <p className="text-xs text-red-500">Please acknowledge the terms to continue</p>
              )}

              {error && error !== "Please acknowledge the terms to continue" && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              {/* CTA + Risk Reversal */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading || !acknowledgedTerms}
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-amber-200 transition-all hover:from-amber-400 hover:to-orange-400 hover:shadow-xl hover:shadow-amber-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg disabled:hover:shadow-amber-200"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                        </svg>
                        Setting up your account...
                      </>
                    ) : (
                      <>
                        Start My Free Trial
                        <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent group-hover:animate-[shimmer_1.5s_ease-in-out]" />
                </button>

                {/* Risk-reversal + trust badges */}
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    14 days free
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Cancel anytime
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    SSL secured
                  </span>
                </div>
              </div>
            </form>

            {/* Footer links */}
            <p className="mt-6 text-center text-xs text-gray-400">
              You won't be charged until your trial ends.{" "}
              <a href="/terms" className="underline decoration-gray-300 underline-offset-2 transition hover:text-gray-600 hover:decoration-gray-400">
                Terms of Service
              </a>
              {" · "}
              <a href="/privacy" className="underline decoration-gray-300 underline-offset-2 transition hover:text-gray-600 hover:decoration-gray-400">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
