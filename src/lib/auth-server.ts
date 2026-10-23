/**
 * Server-side authentication utilities.
 *
 * Provides JWT sign/verify, bcrypt password hashing,
 * and session management for API routes.
 */

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const JWT_EXPIRY = "24h";

// Resolve the signing secret lazily and fail closed if it's missing —
// never fall back to a hardcoded dev value (security: a public fallback
// would let anyone forge org-scoped tokens).
function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured — refusing to sign/verify auth tokens.");
  }
  return new TextEncoder().encode(secret);
}

export interface JwtPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
}

/**
 * Hash a password using bcrypt (cost factor 12).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a JWT token for an authenticated user.
 */
export async function createToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(jwtSecret());
}

/**
 * Verify and decode a JWT token.
 * Returns the payload or null if invalid/expired.
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  const secret = jwtSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract the Bearer token from an Authorization header.
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Generate a random slug for organizations.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
