import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { login, takePendingSignup } from "~/lib/auth";
import { t } from "~/lib/i18n";

/**
 * The thank-you page a paying customer lands on.
 *
 * Owner incident 2026-11-20: Stripe sent him back here before the webhook had created anything,
 * this page could not sign him in, and he ended up looking at the signup form again — paid, with
 * no account and no number.
 *
 * So the page no longer depends on the webhook arriving first. It reads `session_id` from the URL
 * (Stripe substitutes `{CHECKOUT_SESSION_ID}` in the success_url), asks
 * `/api/stripe/session-status`, and that endpoint provisions the account if nothing has yet. The
 * page shows the number we bought, the email we sent it to, and two buttons.
 *
 * Nothing here is ever the signup form and nothing is ever a bare error.
 */
export const Route = createFileRoute("/signup_/success")({
  component: SuccessPage,
  validateSearch: (search: Record<string, unknown>) => ({
    plan: (search.plan as string) || "growth",
    email: (search.email as string) || "",
    session_id: (search.session_id as string) || "",
  }),
});

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

type Phase = "waiting" | "ready" | "confirming";
type SignIn = "unknown" | "done" | "needed";

interface SessionInfo {
  paid: boolean;
  ready: boolean;
  businessName: string | null;
  firstName: string | null;
  email: string | null;
  phoneNumber: string | null;
}

// One attempt per page load, no matter how React re-renders (StrictMode runs effects twice,
// and a second run would find the stashed credentials already consumed and wrongly report
// a failure after a successful sign-in).
let handoffStarted = false;

/** "(727) 910-1304" — what a customer expects to read and dial. E.164 stays on the tel: link. */
function prettyNumber(raw?: string | null): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw ? raw.trim() : null;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/**
 * Ask the server until the account and its number exist, or 60 seconds pass. Returns the session
 * info once it is ready; null when the payment is not confirmed yet or the wait ran out — both of
 * which land on the calm page, never on an error.
 */
async function pollSession(sessionId: string): Promise<SessionInfo | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `/api/stripe/session-status?session_id=${encodeURIComponent(sessionId)}`,
        { cache: "no-store" }
      );
      const data = (await res.json().catch(() => null)) as SessionInfo | null;
      if (data?.ready) return data;
      if (data && !data.paid) return null;
    } catch (err) {
      console.warn("[Signup] session-status check failed:", String(err).slice(0, 120));
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return null;
}

function SuccessPage() {
  const { email: emailFromUrl, session_id: sessionId } = Route.useSearch();
  const [phase, setPhase] = useState<Phase>(sessionId ? "waiting" : "confirming");
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [email, setEmail] = useState(emailFromUrl || "");
  const [signIn, setSignIn] = useState<SignIn>("unknown");

  useEffect(() => {
    if (handoffStarted) return;
    handoffStarted = true;

    // Read AND delete the stashed credentials immediately — they are never reused, never logged,
    // and never placed in a URL.
    const pending = takePendingSignup();
    const knownEmail = (pending?.email || emailFromUrl || "").trim();
    if (knownEmail) setEmail(knownEmail);

    const run = async () => {
      if (!sessionId) {
        // An old link with no session id: keep the previous behaviour, which is the only thing we
        // can do without one — sign them in with the password they just chose, straight to setup.
        if (pending) {
          const result = await login(pending.email, pending.password);
          if (result.success) {
            window.location.replace("/setup");
            return;
          }
          console.warn("[Signup] automatic sign-in failed:", result.error || "unknown error");
          setSignIn("needed");
        }
        setPhase("confirming");
        return;
      }

      const ready = await pollSession(sessionId);
      if (!ready) {
        setPhase("confirming");
        return;
      }

      setInfo(ready);
      if (ready.email) setEmail(ready.email);
      setPhase("ready");

      // The dashboard only opens if this browser actually holds a session. One attempt, then we
      // say plainly how to get in rather than leaving them at a button that bounces to /login.
      if (pending) {
        const result = await login(pending.email, pending.password);
        if (!result.success) {
          console.warn("[Signup] automatic sign-in failed:", result.error || "unknown error");
        }
        setSignIn(result.success ? "done" : "needed");
      } else {
        setSignIn("needed");
      }
    };

    void run();
  }, [sessionId, emailFromUrl]);

  const loginHref = email ? `/login?email=${encodeURIComponent(email)}` : "/login";
  const pretty = prettyNumber(info?.phoneNumber);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-white via-indigo-50/30 to-white px-4 py-12">
      <div className="w-full max-w-md text-center">
        {phase === "waiting" && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t("success.waiting.title")}</h1>
              <p className="mt-2 text-sm text-gray-500">{t("success.waiting.note")}</p>
            </div>
          </div>
        )}

        {phase === "ready" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">🎉</div>

            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {t("success.ready.title")}
                {info?.firstName ? `, ${info.firstName}` : ""}!
              </h1>
              {info?.businessName && (
                <p className="mt-1 text-sm text-gray-500">
                  {t("success.ready.business")}{" "}
                  <span className="font-semibold text-gray-900">{info.businessName}</span>
                </p>
              )}
            </div>

            {pretty ? (
              <div className="w-full rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                  {t("success.ready.numberLabel")}
                </p>
                <a
                  href={`tel:${info?.phoneNumber || ""}`}
                  className="mt-1 block text-2xl font-bold text-indigo-700 underline-offset-4 hover:underline"
                >
                  {pretty}
                </a>
                <p className="mt-2 text-sm text-indigo-900">{t("success.ready.callIt")}</p>
              </div>
            ) : (
              <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
                <p className="text-sm text-amber-900">{t("success.ready.pendingNumber")}</p>
              </div>
            )}

            {email && (
              <p className="text-sm text-gray-500">
                {t("success.ready.emailed")} <span className="font-medium text-gray-900">{email}</span>
              </p>
            )}

            <div className="mt-1 flex w-full flex-col gap-2">
              <a
                href="/dashboard"
                className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                {t("success.ready.openDashboard")}
              </a>
              <a
                href="/setup"
                className="w-full rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
              >
                {t("success.ready.finishSetup")}
              </a>
            </div>

            {signIn === "done" && <p className="text-xs text-gray-400">{t("success.ready.signedIn")}</p>}

            {signIn === "needed" && (
              <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
                <p className="text-sm text-amber-900">
                  {t("success.ready.loginRequired")}{" "}
                  <span className="break-all font-medium">{email}</span>{" "}
                  {t("success.ready.loginRequiredTail")}
                </p>
                <a
                  href={loginHref}
                  className="mt-2 inline-block text-sm font-semibold text-indigo-700 underline underline-offset-2"
                >
                  {t("success.ready.loginLink")}
                </a>
              </div>
            )}
          </div>
        )}

        {phase === "confirming" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-3xl">⏳</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t("success.confirming.title")}</h1>
              <p className="mt-2 text-sm text-gray-500">{t("success.confirming.body")}</p>
              {email && <p className="mt-2 break-all text-sm font-medium text-gray-900">{email}</p>}
            </div>

            <a
              href={loginHref}
              className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              {t("success.confirming.login")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
