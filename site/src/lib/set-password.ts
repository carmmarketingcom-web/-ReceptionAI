/**
 * Set-password links — how an owner who never chose a password gets into their dashboard.
 *
 * Carm Marketing's done-for-you buyers pay through a one-time Stripe Payment Link, so the
 * provisioning webhook has no password to hash: it used to store a random bcrypt hash that
 * nobody — not the customer, not us — could ever match, and sent no email. The account
 * existed and was unreachable.
 *
 * The scheme here follows the one already in this codebase for password resets (see
 * `/api/auth/forgot-password` in serve.ts): a jose JWT signed HS256 with the app's existing
 * `JWT_SECRET`, carrying `purpose` plus the user id, with a real expiry. What it adds is the
 * part the reset flow is missing — the token is genuinely SINGLE USE:
 *
 *   • the token's SHA-256 digest is stored in `password_set_tokens` at mint time;
 *   • consuming it marks the row `used_at`, in the same statement that requires `used_at IS NULL`,
 *     so a second attempt (or two racing attempts) cannot both win;
 *   • an expired row is refused even if the JWT itself still verifies.
 *
 * Why SHA-256 and not bcrypt: bcrypt only reads the first 72 bytes of its input, and a JWT is
 * longer than that — the tail (which is where the signature lives) would not be covered. A
 * digest of the whole token is the correct primitive here.
 */
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

/** A first-login link sits in an inbox, so it lives longer than a reset link — but not forever. */
export const SET_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const PURPOSE = "set-password";

function getSql() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  return neon(dbUrl);
}

/**
 * Same fail-closed rule as src/lib/auth-server.ts: never sign with a missing or short secret.
 * A weak fallback would let anyone forge a link into any account.
 */
function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is not configured (must be >=32 chars) — refusing to sign/verify set-password tokens.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * The digest we store. Never store the token itself.
 *
 * Web Crypto rather than node:crypto on purpose: TanStack pulls API routes into the client
 * bundle, where a node:crypto named import is an unresolved browser external and breaks the
 * build. `crypto.subtle` exists in Node 18+, Bun and the browser alike.
 */
export async function hashSetPasswordToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SetPasswordToken {
  token: string;
  expiresAt: Date;
}

/**
 * Mint a token for a user and record its digest. Throws if the digest cannot be stored —
 * a link we cannot later verify must never be emailed.
 */
export async function createSetPasswordToken(
  userId: string,
  email: string,
  organizationId: string | null = null,
  ttlMs: number = SET_PASSWORD_TTL_MS
): Promise<SetPasswordToken> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const token = await new SignJWT({
    userId,
    email,
    purpose: PURPOSE,
    // A per-mint id: without it, two links minted for the same user in the same second are
    // byte-identical (same claims, same iat/exp) and collide on the token_hash unique index.
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(jwtSecret());

  const sql = getSql();
  await sql`
    INSERT INTO password_set_tokens (id, user_id, organization_id, token_hash, purpose, expires_at)
    VALUES (${crypto.randomUUID()}, ${userId}, ${organizationId}, ${await hashSetPasswordToken(token)}, ${PURPOSE}, ${expiresAt.toISOString()})
  `;

  return { token, expiresAt };
}

/**
 * The absolute URL that goes in the email. `baseUrl` is passed in by the caller (from the
 * request host) so a link always points at the environment that provisioned the account.
 */
export async function createSetPasswordLink(opts: {
  userId: string;
  email: string;
  organizationId?: string | null;
  baseUrl: string;
  ttlMs?: number;
}): Promise<string> {
  const { token } = await createSetPasswordToken(
    opts.userId,
    opts.email,
    opts.organizationId ?? null,
    opts.ttlMs
  );
  const base = opts.baseUrl.replace(/\/+$/, "");
  return `${base}/set-password?token=${encodeURIComponent(token)}`;
}

export interface SetPasswordCheck {
  ok: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

/**
 * Read-only check used by the page to show "this link has expired" before the visitor types
 * anything. It does NOT consume the token.
 */
export async function checkSetPasswordToken(token: string): Promise<SetPasswordCheck> {
  if (!token) return { ok: false, error: "This link is missing its token. Use the link from your email." };

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, jwtSecret());
    payload = result.payload as Record<string, unknown>;
  } catch {
    return { ok: false, error: "This link is invalid or has expired. Ask us for a new one." };
  }
  if (payload.purpose !== PURPOSE) {
    return { ok: false, error: "This link is invalid or has expired. Ask us for a new one." };
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT id, user_id, expires_at, used_at FROM password_set_tokens
    WHERE token_hash = ${await hashSetPasswordToken(token)}
    LIMIT 1
  `) as Array<{ id: string; user_id: string; expires_at: string; used_at: string | null }>;
  const row = rows[0];
  if (!row) return { ok: false, error: "This link is no longer valid. Ask us for a new one." };
  if (row.used_at) return { ok: false, error: "This link has already been used. Sign in, or ask us for a new one." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This link has expired. Ask us for a new one." };
  }

  return { ok: true, userId: String(row.user_id), email: typeof payload.email === "string" ? payload.email : undefined };
}

/**
 * Consume the token and set the password. Single use: the UPDATE only matches a row that is
 * still unused, so the first caller wins and every later caller gets a clear message.
 */
export async function consumeSetPasswordToken(
  token: string,
  password: string
): Promise<SetPasswordCheck> {
  if (!token) return { ok: false, error: "This link is missing its token. Use the link from your email." };
  if (!password || password.length < 8) {
    return { ok: false, error: "Choose a password with at least 8 characters." };
  }

  const check = await checkSetPasswordToken(token);
  if (!check.ok || !check.userId) return check;

  const sql = getSql();
  const passwordHash = await bcrypt.hash(password, 12);

  // Claim the token first. If another request already claimed it, nothing is updated.
  const claimed = (await sql`
    UPDATE password_set_tokens SET used_at = NOW()
    WHERE token_hash = ${await hashSetPasswordToken(token)} AND used_at IS NULL
    RETURNING id
  `) as Array<{ id: string }>;
  if (!claimed.length) {
    return { ok: false, error: "This link has already been used. Sign in, or ask us for a new one." };
  }

  await sql`
    UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW()
    WHERE id = ${check.userId}
  `;

  return { ok: true, userId: check.userId, email: check.email };
}
