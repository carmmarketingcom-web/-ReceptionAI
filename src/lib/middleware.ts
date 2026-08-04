/**
 * Auth middleware for API routes.
 *
 * Wraps a route handler with JWT verification.
 * Extracts organization_id and user_id from the token
 * and injects them into the request context.
 */

import { verifyToken, extractBearerToken } from "./auth-server";
import type { JwtPayload } from "./auth-server";

export interface AuthenticatedRequest extends Request {
  auth: JwtPayload;
  organizationId: string;
  userId: string;
  userRole: string;
}

/**
 * Middleware that authenticates a request via JWT Bearer token.
 * Returns the authenticated request or a 401 Response.
 */
export async function authenticate(
  request: Request
): Promise<AuthenticatedRequest | Response> {
  const token = extractBearerToken(request);

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Inject auth context into the request
  const authRequest = request as AuthenticatedRequest;
  authRequest.auth = payload;
  authRequest.organizationId = payload.organizationId;
  authRequest.userId = payload.userId;
  authRequest.userRole = payload.role;

  return authRequest;
}

/**
 * Require a minimum role for access.
 * Returns the request or a 403 Response.
 */
export function requireRole(
  request: AuthenticatedRequest,
  minimumRole: "owner" | "admin" | "agent" | "viewer"
): AuthenticatedRequest | Response {
  const roleHierarchy: Record<string, number> = {
    owner: 4,
    admin: 3,
    agent: 2,
    viewer: 1,
  };

  if (
    (roleHierarchy[request.userRole] || 0) <
    (roleHierarchy[minimumRole] || 0)
  ) {
    return new Response(
      JSON.stringify({ error: "Insufficient permissions" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return request;
}
