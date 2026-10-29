/**
 * Client-side authentication utilities.
 *
 * Provides login/logout functions, token storage,
 * and a protected route wrapper for the React frontend.
 */

const TOKEN_KEY = "receptionai_token";
const USER_KEY = "receptionai_user";

export interface AuthUser {
  userId: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
  organizationName: string;
}

/**
 * Store the auth token in localStorage.
 */
export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Get the stored auth token.
 */
export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

/**
 * Remove the stored auth token.
 */
export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

/**
 * Store the current user info.
 */
export function setUser(user: AuthUser): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

/**
 * Get the stored user info.
 */
export function getUser(): AuthUser | null {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Check if the user is authenticated (has a token).
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Pending signup credentials — the short bridge between paying and being signed in.
 *
 * The customer types an email + password on /signup, leaves the tab for Stripe Checkout,
 * and comes back on /signup/success. Session storage carries those credentials across that
 * redirect so the success page can sign them in automatically instead of dropping them onto
 * an unauthenticated dashboard.
 *
 * Rules: session-scoped only (never localStorage), read-and-delete in one step, never put in
 * a URL, never logged.
 */
export const PENDING_SIGNUP_KEY = "pendingSignup";

export interface PendingSignup {
  email: string;
  password: string;
}

/** Stash the credentials the customer just typed, right before leaving for Stripe. */
export function stashPendingSignup(email: string, password: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PENDING_SIGNUP_KEY,
      JSON.stringify({ email, password })
    );
  } catch {
    // Private mode or storage disabled — the success page degrades to a login link.
  }
}

/**
 * Read AND remove the stashed credentials in one step.
 * Returns null when there is nothing usable (already used, blocked storage, bad JSON).
 */
export function takePendingSignup(): PendingSignup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_SIGNUP_KEY);
    window.sessionStorage.removeItem(PENDING_SIGNUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSignup>;
    if (!parsed?.email || !parsed?.password) return null;
    return { email: String(parsed.email), password: String(parsed.password) };
  } catch {
    return null;
  }
}

/**
 * Login function — calls the API and stores the token.
 */
export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = (await response.json()) as {
      token?: string;
      user?: AuthUser;
      error?: string;
    };

    if (!response.ok || !data.token) {
      return { success: false, error: data.error || "Login failed" };
    }

    setToken(data.token);
    if (data.user) {
      setUser(data.user);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Register a new organization and admin user.
 */
export async function register(data: {
  name: string;
  email: string;
  password: string;
  industry?: string;
  timezone?: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = (await response.json()) as {
      token?: string;
      user?: AuthUser;
      error?: string;
    };

    if (!response.ok || !result.token) {
      return { success: false, error: result.error || "Registration failed" };
    }

    setToken(result.token);
    if (result.user) {
      setUser(result.user);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Logout — clears the token and redirects.
 */
export function logout(): void {
  clearToken();
  // Attempt to call the logout endpoint (fire and forget)
  fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}

/**
 * Fetch the current user from the API.
 */
export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      clearToken();
      return null;
    }

    const data = (await response.json()) as { user: AuthUser };
    if (data.user) {
      setUser(data.user);
    }
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Get authorization headers for API calls.
 */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
