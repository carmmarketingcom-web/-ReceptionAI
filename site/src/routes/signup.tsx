import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Header from "~/components/Header";
import Footer from "~/components/Footer";
import { stashPendingSignup } from "~/lib/auth";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("starter");
  const [acknowledgedTerms, setAcknowledgedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Last-resort only: if the business-name field is somehow empty, fall back to the email
  // local part. A typed business name always wins — this never overrides it.
  const deriveCompanyName = (emailAddr: string) => {
    const localPart = emailAddr.split("@")[0] || "";
    return localPart.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 20) || "My Business";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Business name is what the AI says to every caller ("Thanks for calling {Business}"),
    // so it is required and must not be whitespace only.
    const business = businessName.trim();
    if (!business) {
      setError("Please enter your business name");
      return;
    }

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
          companyName: business || deriveCompanyName(email),
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
        // Hand the credentials to the success page so it can sign the customer in when
        // Stripe sends them back. Session-scoped, wiped the moment it is read, and never
        // put in a URL (the password must not end up in history or server logs).
        stashPendingSignup(email, password);
        window.location.href = url;
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-white via-indigo-50/30 to-white px-4 py-20" style={{ colorScheme: "light" }}>
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-100/50" style={{ colorScheme: "light" }}>
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
              <p className="mt-2 text-sm text-gray-500">Secure checkout. Cancel anytime.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label htmlFor="signupName" className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  id="signupName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Business Name — this is what the AI says to every caller */}
              <div>
                <label htmlFor="signupBusinessName" className="block text-sm font-medium text-gray-700">Business name</label>
                <input
                  id="signupBusinessName"
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => { setBusinessName(e.target.value); setError(""); }}
                  placeholder="Smith HVAC & Plumbing"
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1.5 text-xs text-gray-500">This is the name your callers will hear.</p>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="signupEmail" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="signupEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Plan Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Plan</label>
                <div className="mt-1.5 flex gap-1 rounded-xl bg-gray-100 p-1">
                  {[
                    { slug: "starter", label: "Starter", price: "$99" },
                    { slug: "growth", label: "Growth", price: "$199" },
                    { slug: "scale", label: "Scale", price: "$399" },
                  ].map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setPlan(p.slug)}
                      className={`flex-1 cursor-pointer rounded-lg px-3 py-3 text-sm font-medium transition ${
                        plan === p.slug
                          ? "bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      <div>{p.label}</div>
                      <div className="font-normal opacity-60">{p.price}/mo</div>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-xs text-indigo-600 font-medium">
                  🎉 <strong>FOUNDER50</strong> — 50% off for the first 3 months, first 100 customers only!
                </p>
                              </div>
              {/* Password */}
              <div>
                <label htmlFor="signupPassword" className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  id="signupPassword"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password (min 8 characters)"
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Terms Checkbox */}
              <label className={`flex items-start gap-3 rounded-xl border p-3 transition cursor-pointer ${!acknowledgedTerms && error === "Please acknowledge the terms to continue" ? "border-red-200 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input
                  type="checkbox"
                  checked={acknowledgedTerms}
                  onChange={(e) => { setAcknowledgedTerms(e.target.checked); setError(""); }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-500">
                  I agree to the Terms of Service and understand ReceptionAI is provided AS IS with no guarantees or liability.
                </span>
              </label>

              {!acknowledgedTerms && error === "Please acknowledge the terms to continue" && (
                <p className="text-xs text-red-500">Please acknowledge the terms to continue</p>
              )}

              {/* Other errors */}
              {error && error !== "Please acknowledge the terms to continue" && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading || !acknowledgedTerms}
                className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Setting up your account..." : "Start Today"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-400">
              Cancel anytime. You'll be charged for your first month at checkout.{" "}
              <a href="/terms" className="underline hover:text-gray-600">Terms of Service</a>{" "}
              ·{" "}
              <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>.
            </p>

            {/* Honest caveat — plans are monthly, and not every listed feature is live yet */}
            <p className="mt-3 text-center text-xs text-gray-500">
              Plans are month-to-month, no contracts. Some Growth and Scale features — WhatsApp +
              Facebook messaging, advanced analytics, per-member routing — are still in
              development.{" "}
              <a href="/features" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700">
                See the Features page
              </a>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
