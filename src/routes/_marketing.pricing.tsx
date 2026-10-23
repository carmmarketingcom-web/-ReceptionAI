import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/pricing")({
  component: PricingPage,
});

const tiers = [
  {
    name: "Starter",
    price: "$99",
    description: "Perfect for solopreneurs and small shops just getting started.",
    features: [
      "1 phone line",
      "500 AI-minutes/month",
      "SMS & web chat",
      "Basic calendar sync",
      "English & Spanish support",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
    stripePaymentLink: "https://buy.stripe.com/6oU5kD6rW2C52Fd1D3aVa02",
    stripePriceId: "price_1TxrHbP7NtNpgQde64Zp1tgM",
  },
  {
    name: "Growth",
    price: "$199",
    description: "Ideal for growing teams that need more coverage and channels.",
    features: [
      "2 phone lines",
      "2,000 AI-minutes/month",
      "WhatsApp & Facebook integration",
      "Advanced analytics dashboard",
      "Team management",
      "Priority email & chat support",
    ],
    cta: "Start Free Trial",
    popular: true,
    stripePaymentLink: "https://buy.stripe.com/eVq14ng2w90tfrZ4PfaVa03",
    stripePriceId: "price_1TxrJCP7NtNpgQdeNBA9dxqn",
  },
  {
    name: "Scale",
    price: "$399",
    description: "For high-volume businesses that need unlimited capacity and custom AI.",
    features: [
      "Unlimited phone lines (5+ add-on)",
      "10,000+ AI-minutes/month",
      "Custom AI response training",
      "All channels included",
      "Dedicated account manager",
      "24/7 priority phone support",
    ],
    cta: "Start Free Trial",
    popular: false,
    stripePaymentLink: "https://buy.stripe.com/14AaEX03ygsVbbJchHaVa04",
    stripePriceId: "price_1TxrKSP7NtNpgQdeh8Jh1P2Z",
  },
];

const addOns = [
  { name: "Extra phone number", price: "$15/mo" },
  { name: "Additional AI-minutes (500)", price: "$25/mo" },
  { name: "Custom integration setup", price: "$500 one-time" },
  { name: "HIPAA compliance add-on", price: "$50/mo" },
];

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white via-indigo-50/30 to-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            Pricing
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            No hidden fees, no surprise charges. Start small and scale as you grow.
          </p>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="bg-white pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  tier.popular
                    ? "border-indigo-200 bg-white shadow-xl shadow-indigo-100 ring-1 ring-indigo-500"
                    : "border-gray-200 bg-white shadow-sm"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-indigo-600 px-4 py-1 text-sm font-semibold text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900">{tier.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{tier.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900">{tier.price}</span>
                  <span className="text-base text-gray-500">/month</span>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-gray-600">
                      <svg
                        className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/signup"
                  className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-center text-sm font-semibold transition ${
                    tier.popular
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {tier.cta}
                  <svg
                    className="ml-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </Link>
              </div>
            ))}
          </div>

          {/* Annual billing note */}
          <p className="mt-8 text-center text-sm text-gray-500">
            All plans include a 14-day free trial. Your card is entered at checkout for billing, but you won't be charged until your trial ends. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Add-ons */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-gray-900">Optional Add-ons</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
            Customize your plan with these extras.
          </p>
          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {addOns.map((addon) => (
              <div
                key={addon.name}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4"
              >
                <span className="text-sm font-medium text-gray-900">{addon.name}</span>
                <span className="text-sm font-semibold text-indigo-600">{addon.price}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
          <div className="mt-8 space-y-6">
            {[
              {
                q: "Can I switch plans later?",
                a: "Yes! You can upgrade or downgrade at any time. Changes take effect immediately, and we'll prorate your billing.",
              },
              {
                q: "What happens if I run out of AI-minutes?",
                a: "You can purchase additional minutes in bundles of 500. We'll notify you when you're approaching your limit.",
              },
              {
                q: "Is there a long-term contract?",
                a: "No. All plans are month-to-month. You can cancel anytime — no penalties, no hidden fees.",
              },
              {
                q: "Can I use my existing phone number?",
                a: "Yes, but our honest recommendation is to start with a new ReceptionAI number. You're live in minutes, every call is recorded and summarized straight to your phone, and your existing number keeps working for outbound calls, existing customers, and emergencies. Porting your number to us is possible, but we don't recommend it: it typically takes 1–4 weeks with your current carrier, can briefly interrupt service if anything slips, and adds friction you don't need on day one. If you still want to port, we'll handle it with you directly — you send a recent bill and sign a letter of authorization, we submit the port, and we update you at every step. Talk to our team and we'll guide you through it.",
              },
              {
                q: "Can I keep my old number without porting?",
                a: "Yes — and this is what most of our customers do. Ask your current carrier to forward calls from your existing number to your new ReceptionAI number. Your old number keeps ringing, callers never notice a change, and your AI receptionist answers every call. No porting delays, no downtime, no risk. We'll give you the exact forwarding instructions for your carrier.",
              },
              {
                q: "How does the 14-day free trial work?",
                a: "You get full access to all features for 14 days, including 500 AI-minutes on Starter. Your card is entered at checkout but you're only charged after the trial ends — cancel before then and you pay nothing.",
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-xl border border-gray-100 bg-white p-6">
                <h3 className="font-semibold text-gray-900">{faq.q}</h3>
                <p className="mt-2 text-sm text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">Still have questions?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
            Talk to our team. We'll help you find the perfect plan for your business.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-600 transition hover:bg-indigo-50"
            >
              Start Free Trial
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-400 bg-transparent px-8 py-4 text-base font-semibold text-white transition hover:bg-indigo-500/20"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
