import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/faq")({
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Getting Started with ReceptionAI
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Everything you need to know to sign up, log in, and start using your AI receptionist.
          </p>
        </div>
      </section>

      {/* Signup SOP */}
      <section id="signup" className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">1</span>
            <h2 className="text-2xl font-bold text-gray-900">Sign Up for Your Plan</h2>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Step-by-Step</h3>
              <ol className="list-decimal ml-5 space-y-3 text-sm">
                <li>
                  <strong>Go to the signup page.</strong> Visit{" "}
                  <a href="/signup" className="text-indigo-600 underline">receptionai.ctonew.app/signup</a>{" "}
                  or click <strong>Start Today</strong> from the homepage.
                </li>
                <li>
                  <strong>Enter your full name.</strong> This will appear on your account and in communications.
                </li>
                <li>
                  <strong>Enter your email address.</strong> Use your business email — this is where login links and notifications will be sent.
                </li>
                <li>
                  <strong>Choose your plan.</strong> Select <strong>Starter</strong> ($99/mo), <strong>Growth</strong> ($199/mo), or <strong>Scale</strong> ($399/mo) from the dropdown. Your first month is charged at checkout — no auto-renewals.
                </li>
                <li>
                  <strong>Create a password.</strong> Must be at least 8 characters.
                </li>
                <li>
                  <strong>Check the terms box</strong> and click <strong>Start Today</strong>.
                </li>
                <li>
                  <strong>Complete payment.</strong> You'll be redirected to Stripe's secure checkout. Enter your card details. You'll be charged for your first month. No hidden fees, no auto-renewals — cancel anytime.
                </li>
                <li>
                  <strong>Done!</strong> After payment, your account is created automatically — your phone number is provisioned and your dashboard is ready.
                </li>
              </ol>
            </div>

            {/* Screenshot */}
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-lg">
              <img
                src="/signup-screenshot.png"
                alt="Signup page screenshot showing form fields and plan selector"
                className="w-full"
              />
              <p className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
                The signup form — fill in your details, pick a plan, and start your free trial.
              </p>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
              <p className="text-sm text-indigo-800">
                <strong>💡 FOUNDER50 Discount:</strong> Use code <strong>FOUNDER50</strong> at checkout for <strong>50% off your first 3 months</strong>. This is automatically applied during signup.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Login SOP */}
      <section id="login" className="bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">2</span>
            <h2 className="text-2xl font-bold text-gray-900">Log In to Your Dashboard</h2>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Step-by-Step</h3>
              <ol className="list-decimal ml-5 space-y-3 text-sm">
                <li>
                  <strong>Go to the login page.</strong> Visit{" "}
                  <a href="/login" className="text-indigo-600 underline">receptionai.ctonew.app/login</a>.
                </li>
                <li>
                  <strong>Enter your email and password</strong> — the same ones you used during signup.
                </li>
                <li>
                  <strong>Click Sign In.</strong> You'll be taken to your dashboard immediately.
                </li>
                <li>
                  <strong>Forgot your password?</strong> Click the <strong>Forgot password?</strong> link on the login page. Enter your email and we'll send you a reset link.
                </li>
              </ol>
            </div>

            {/* Screenshot */}
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-lg">
              <img
                src="/login-screenshot.png"
                alt="Login page screenshot showing email and password fields"
                className="w-full"
              />
              <p className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
                The login page — use the email and password you created during signup.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h2>

          <div className="space-y-4">
            {[
              {
                q: "How long is the free trial?",
                a: "14 days. You won't be charged until the trial ends. Cancel anytime before then and you won't pay anything.",
              },
              {
                q: "What happens after I sign up?",
                a: "Your account is created automatically. A phone number is provisioned for your business, and your dashboard is ready immediately. You can start receiving calls right away.",
              },
              {
                q: "Will my customers have to dial a new number?",
                a: "Yes — and that's intentional. When you sign up you get a dedicated AI receptionist number, so your new AI assistant has one clear, always-on line. Your customers can keep using the number they already know by forwarding it to your new one — dial *72 followed by your new number (turn it off with *73), or set it up in your provider's portal in about 5 minutes — with no downtime and the option to switch it off anytime.",
              },
              {
                q: "Can I use (port) my own phone number instead?",
                a: (
                  <>
                    <p>Yes, you can — but we don't recommend it, and here's exactly why.</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>
                        <strong>Instant:</strong> your number is live the moment you sign up. Porting takes 1–2 weeks, during which you could be missing calls.
                      </li>
                      <li>
                        <strong>No hidden risk:</strong> porting requires your current provider to release the number — it can be declined, delayed, or temporarily disrupt service.
                      </li>
                      <li>
                        <strong>Cleaner AI experience:</strong> the AI receptionist is built around its own number — post-call text summaries, repeat-caller recognition, and reminders all flow automatically. Porting complicates that setup for little benefit.
                      </li>
                      <li>
                        <strong>Forwarding gives you everything porting does</strong> — customers keep calling the number they know — with none of the wait or risk.
                      </li>
                    </ul>
                    <p className="mt-2">If you still want to port, choose "Use my existing number" at signup — we record the request and a temporary number keeps you covered until the transfer completes (expect 1–2 weeks and possible hiccups with your current carrier). For 95% of businesses, the smart move is: keep your advertised number, forward it to your new AI number — same customer experience, zero downtime.</p>
                  </>
                ),
              },
              {
                q: "What if a caller wants to speak to a real person?",
                a: "The AI recognizes the request and forwards the call straight to you (or whoever you configure as the owner). If you can't answer, the system texts you the caller's number so you can call them back — no missed opportunities.",
              },
              {
                q: "How do I cancel?",
                a: "Go to your dashboard Settings page and click Cancel Subscription. No phone calls, no hassle. You'll retain access until the end of your billing period.",
              },
              {
                q: "What if I need help?",
                a: "Your dashboard includes a help widget in the bottom-right corner. You can also email us at support@receptionai.ctonew.app.",
              },
              {
                q: "Does the AI speak Spanish?",
                a: "Yes! ReceptionAI handles calls, texts, and web chats in both English and Spanish. Callers can switch languages at any time.",
              },
              {
                q: "What happens if the AI can't handle a call?",
                a: "The system automatically transfers to a human. You can set your forwarding number in the dashboard Settings. Our target is to handle 85%+ of calls without escalation.",
              },
              {
                q: "Can I change my plan later?",
                a: "Absolutely. Upgrade or downgrade anytime from your dashboard. Changes take effect at the start of your next billing period.",
              },
              {
                q: "Is my data secure?",
                a: "Yes. All data is encrypted in transit and at rest. We use Stripe for payment processing — we never store your credit card details. See our Privacy Policy for full details.",
              },
              {
                q: "Do I need to install anything?",
                a: "No. Everything runs in the cloud. You access your dashboard through any web browser. No apps to install, no hardware to buy.",
              },
            ].map((item, i) => (
              <details key={i} className="group rounded-xl border border-gray-200 bg-white">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
                  {item.q}
                  <svg className="h-5 w-5 shrink-0 text-gray-400 group-open:rotate-180 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </summary>
                <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">Ready to get started?</h2>
          <p className="mt-3 text-lg text-indigo-100">
            Try ReceptionAI free for 14 days. No credit card required until your trial ends.
          </p>
          <div className="mt-8">
            <Link
              to="/signup"
              className="inline-block rounded-xl bg-white px-8 py-3 text-base font-semibold text-indigo-600 shadow-lg hover:bg-indigo-50 transition"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
