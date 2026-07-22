import { Link, createFileRoute } from "@tanstack/react-router";
import Header from "~/components/Header";
import Footer from "~/components/Footer";

export const Route = createFileRoute("/signup/success")({
  component: SuccessPage,
  validateSearch: (search: Record<string, unknown>) => ({
    plan: (search.plan as string) || "growth",
    email: (search.email as string) || "",
  }),
});

function SuccessPage() {
  const { plan, email } = Route.useSearch();
  const plans: Record<string, string> = { starter: "Starter", growth: "Growth", scale: "Scale" };
  const planName = plans[plan] || "Growth";

  // Mock phone number — will be replaced with real data from API
  const phoneNumber = "(555) " + String(Math.floor(Math.random() * 900) + 100) + "-" + String(Math.floor(Math.random() * 9000) + 1000);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-white via-indigo-50/30 to-white px-4 py-20">
        <div className="w-full max-w-md text-center">
          {/* Success Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="mt-6 text-3xl font-bold text-gray-900">You're all set!</h1>
          <p className="mt-2 text-gray-500">
            Welcome to ReceptionAI. Your {planName} plan is active and your AI receptionist is ready to take calls.
          </p>

          {/* Phone Number */}
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Your new business number</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{phoneNumber}</p>
            <p className="mt-2 text-sm text-gray-500">
              Save this number. Your AI receptionist answers calls here 24/7.
            </p>
          </div>

          {/* Quick Setup Checklist */}
          <div className="mt-6 space-y-3 text-left">
            {[
              { text: "Connect your calendar for appointment scheduling", done: true },
              { text: "Set your business hours and AI greeting", done: false },
              { text: "Add your team members", done: false },
              { text: "Start receiving calls on your new number", done: true },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3 rounded-lg bg-white p-3 text-sm">
                <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${item.done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                  {item.done ? (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs">○</span>
                  )}
                </div>
                <span className={item.done ? "text-gray-500" : "text-gray-400"}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 space-y-3">
            <Link
              to="/setup"
              className="block w-full rounded-xl bg-indigo-600 px-6 py-3 text-center text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
            >
              Complete Setup →
            </Link>
            <Link
              to="/dashboard"
              className="block w-full rounded-xl border border-gray-200 bg-white px-6 py-3 text-center text-base font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Go to Dashboard
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            Confirmation sent to {email || "your email"}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}