import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/set-password")({
  component: SetPasswordPage,
});

/**
 * Where a Carm Marketing buyer lands from their welcome email.
 *
 * The link is single use and expires in 7 days; both facts are checked server-side in
 * /api/auth/set-password, so this page only has to say clearly what happened.
 */
function SetPasswordPage() {
  const [token, setToken] = useState("");
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("token") || "";
    setToken(fromUrl);
    if (!fromUrl) {
      setLinkError("This page needs the link from your email. Open that link, or ask us for a new one.");
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/auth/set-password?token=${encodeURIComponent(fromUrl)}`);
        const data = (await res.json()) as { valid?: boolean; email?: string; error?: string };
        if (!data.valid) {
          setLinkError(data.error || "This link can't be used. Ask us for a new one.");
        } else if (data.email) {
          setEmail(data.email);
        }
      } catch {
        setLinkError("We couldn't check that link. Please try again.");
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (data.error) {
        setError(data.error);
      } else {
        setDone(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center">
            <img src="/images/logo.png" alt="ReceptionAI" className="h-9 w-auto" width={800} height={450} />
          </Link>
        </div>
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {done ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✅</div>
              <h1 className="mt-4 text-xl font-bold text-gray-900">Password set!</h1>
              <p className="mt-2 text-sm text-gray-600">
                You can sign in now with {email || "your email address"} and the password you just chose.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Go to sign in
              </Link>
            </div>
          ) : checking ? (
            <p className="text-center text-sm text-gray-600">Checking your link…</p>
          ) : linkError ? (
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900">This link can't be used</h1>
              <p className="mt-2 text-sm text-gray-600">{linkError}</p>
              <p className="mt-4 text-sm text-gray-600">
                Already set a password?{" "}
                <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
                  Sign in here
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900">Set your password</h1>
              <p className="mt-2 text-sm text-gray-600">
                {email ? `For ${email}. ` : ""}This link works once and expires 7 days after it was sent.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
                    Confirm password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Type it again"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading ? "Saving…" : "Set password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
