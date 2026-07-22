import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import Header from "~/components/Header";
import Footer from "~/components/Footer";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const plans = [
  {
    slug: "starter",
    name: "Starter",
    price: "$99",
    priceNum: 99,
    features: ["1 phone line", "500 AI-minutes/mo", "SMS & web chat", "Basic calendar sync", "Email support"],
  },
  {
    slug: "growth",
    name: "Growth",
    price: "$199",
    priceNum: 199,
    features: ["2 phone lines", "2,000 AI-minutes/mo", "WhatsApp & Facebook", "Advanced analytics", "Team management", "Priority support"],
    popular: true,
  },
  {
    slug: "scale",
    name: "Scale",
    price: "$399",
    priceNum: 399,
    features: ["Unlimited lines", "10,000+ AI-minutes/mo", "Custom AI responses", "All channels included", "Dedicated manager", "24/7 priority support"],
  },
];

function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "checkout" | "success">("form");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [useExistingNumber, setUseExistingNumber] = useState(false);
  const [existingPhoneNumber, setExistingPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // POST to Stripe checkout endpoint
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          email,
          name: fullName,
          plan: selectedPlan,
          useExistingNumber,
          existingPhoneNumber: useExistingNumber ? existingPhoneNumber : "",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong");
      }

      const { url } = await res.json() as { url: string };

      // If Stripe URL returned, redirect
      if (url) {
        window.location.href = url;
        return;
      }

      // Fallback: go to success page
      router.navigate({
        to: "/signup/success",
        search: { plan: selectedPlan, email },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="flex-1 bg-gray-50 py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          {step === "form" && (
            <>
              <div className="mb-8 text-center">
                <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
                  Free 14-Day Trial
                </span>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Start your free trial
                </h1>
                <p className="mt-2 text-gray-500">
                  No credit card required. Cancel anytime.
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Plan Selection */}
              <div className="mb-8 grid gap-4 sm:grid-cols-3">
                {plans.map((plan) => (
                  <button
                    key={plan.slug}
                    onClick={() => setSelectedPlan(plan.slug)}
                    className={`relative rounded-xl border p-4 text-left transition ${
                      selectedPlan === plan.slug
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                          Most Popular
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-900">{plan.name}</p>
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                        selectedPlan === plan.slug ? "border-indigo-600 bg-indigo-600" : "border-gray-300"
                      }`}>
                        {selectedPlan === plan.slug && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{plan.price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                    <ul className="mt-3 space-y-1">
                      {plan.features.slice(0, 4).map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                          <svg className="h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="space-y-5">
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                      Company Name
                    </label>
                    <input
                      id="company"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your Business Name"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Smith"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="signupEmail" className="block text-sm font-medium text-gray-700">
                      Business Email
                    </label>
                    <input
                      id="signupEmail"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="mb-3 text-sm font-medium text-gray-700">Phone Number</p>
                    <label className={`flex items-start gap-3 rounded-lg border p-3 transition cursor-pointer ${!useExistingNumber ? "border-indigo-200 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input
                        type="radio"
                        name="phoneOption"
                        checked={!useExistingNumber}
                        onChange={() => setUseExistingNumber(false)}
                        className="mt-0.5 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Get a new phone number</p>
                        <p className="text-xs text-gray-500">We'll assign you a local business number. Instant activation.</p>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 rounded-lg border p-3 mt-2 transition cursor-pointer ${useExistingNumber ? "border-indigo-200 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input
                        type="radio"
                        name="phoneOption"
                        checked={useExistingNumber}
                        onChange={() => setUseExistingNumber(true)}
                        className="mt-0.5 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Use my existing number</p>
                        <p className="text-xs text-gray-500">Port your current business number. Takes 1-3 business days.</p>
                        {useExistingNumber && (
                          <input
                            type="tel"
                            value={existingPhoneNumber}
                            onChange={(e) => setExistingPhoneNumber(e.target.value)}
                            placeholder="(555) 123-4567"
                            className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required={useExistingNumber}
                          />
                        )}
                      </div>
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? "Setting up your account..." : `Get Started with ${plans.find(p => p.slug === selectedPlan)?.name}`}
                  </button>
                </div>
                <p className="mt-4 text-center text-xs text-gray-400">
                  By signing up you agree to our Terms of Service and Privacy Policy.
                </p>
              </form>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}