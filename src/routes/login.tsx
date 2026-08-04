import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // Native submit handler — React onSubmit doesn't fire on some mobile browsers
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handler = (e: Event) => {
      e.preventDefault();
      handleLogin();
    };
    form.addEventListener("submit", handler);
    return () => form.removeEventListener("submit", handler);
  }, [email, password]);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Invalid email or password");
      }

      const data = await res.json() as { token: string; user: Record<string, unknown> };
      // Store token
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      // Redirect to dashboard
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-gray-50">
      {/* Left panel — branding */}
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-indigo-600 to-purple-700 p-12 text-white lg:flex">
        <div>
          <Link to="/" className="flex items-center">
            <img src="/images/logo.png" alt="ReceptionAI" className="h-9 w-auto brightness-0 invert" width={800} height={450} />
          </Link>
        </div>
        <div className="max-w-md">
          <blockquote className="text-2xl font-semibold leading-snug">
            "We went from missing 40% of our calls to answering every single one. Our bookings doubled in the first month."
          </blockquote>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
              MJ
            </div>
            <div>
              <p className="font-medium">Marcus Johnson</p>
              <p className="text-sm text-indigo-200">Johnson's HVAC Services</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-indigo-200">
          <span>© 2026 ReceptionAI</span>
          <a href="/privacy" className="hover:text-white">Privacy</a>
          <a href="/terms" className="hover:text-white">Terms</a>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo for mobile */}
          <div className="mb-10 flex justify-center lg:hidden">
            <img src="/images/logo.png" alt="ReceptionAI" className="h-8 w-auto" width={800} height={450} />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="mt-2 text-sm text-gray-500">Sign in to your ReceptionAI dashboard.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <form ref={formRef} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-between">
              <Link to="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-700">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
