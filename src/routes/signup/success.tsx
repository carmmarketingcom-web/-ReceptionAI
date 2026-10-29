import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { login, takePendingSignup } from "~/lib/auth";

export const Route = createFileRoute("/signup/success")({
  component: SuccessPage,
  validateSearch: (search: Record<string, unknown>) => ({
    plan: (search.plan as string) || "growth",
    email: (search.email as string) || "",
  }),
});

// One attempt per page load, no matter how React re-renders (StrictMode runs effects twice,
// and a second run would find the stashed credentials already consumed and wrongly report
// a failure after a successful sign-in).
let handoffStarted = false;

function SuccessPage() {
  const { email: emailFromUrl } = Route.useSearch();
  const [phase, setPhase] = useState<"signing-in" | "needs-login">("signing-in");
  const [email, setEmail] = useState(emailFromUrl || "");

  useEffect(() => {
    if (handoffStarted) return;
    handoffStarted = true;

    // Read AND delete the stashed credentials immediately — they are never reused,
    // never logged, and never placed in a URL.
    const pending = takePendingSignup();
    const knownEmail = (pending?.email || emailFromUrl || "").trim();
    if (knownEmail) setEmail(knownEmail);

    const run = async () => {
      if (pending) {
        // Same login call and same token storage as /login, so the dashboard finds the session.
        const result = await login(pending.email, pending.password);
        if (result.success) {
          // First screen is setup, where their real number and business details live.
          window.location.replace("/setup");
          return;
        }
        console.warn("[Signup] automatic sign-in failed:", result.error || "unknown error");
      }
      setPhase("needs-login");
    };

    void run();
  }, [emailFromUrl]);

  const loginHref = email ? `/login?email=${encodeURIComponent(email)}` : "/login";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-white via-indigo-50/30 to-white px-4">
      <div className="w-full max-w-md text-center">
        {phase === "signing-in" ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✅</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Account created!</h1>
              <p className="mt-1 text-sm text-gray-500">
                Signing you in and getting your phone number ready...
              </p>
            </div>
            <div className="h-1 w-32 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-1/2 animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-indigo-500" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✅</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Your account is ready</h1>
              <p className="mt-1 text-sm text-gray-500">
                Your payment went through and your phone number is being set up — we&apos;ll email it to you
                as soon as it&apos;s live.
              </p>
            </div>

            <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="text-sm text-amber-900">
                We couldn&apos;t sign you in automatically. Log in with the email and password you just chose
                and you&apos;ll go straight to setup.
              </p>
              {email && (
                <p className="mt-2 break-all text-sm font-medium text-amber-900">{email}</p>
              )}
            </div>

            <a
              href={loginHref}
              className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Log in
            </a>

            <p className="text-xs text-gray-400">
              Forgot the password you chose?{" "}
              <a href="/forgot-password" className="underline underline-offset-2 hover:text-gray-600">
                Reset it here
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
