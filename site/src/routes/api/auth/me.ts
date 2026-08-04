/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's info.
 * Requires: Authorization: Bearer <token>
 * Returns: { user }
 */


import { authenticate } from "../../../lib/middleware";
import { getDb, isMockMode } from "../../../db/index";
import { users, organizations } from "../../../db/schema/index";
import { eq } from "drizzle-orm";

export async function GET({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);

    // If authenticate returned a Response (error), propagate it
    if (authResult instanceof Response) {
      return authResult;
    }

    const usingMock = isMockMode();

    if (usingMock) {
      return new Response(
        JSON.stringify({
          user: {
            userId: authResult.userId,
            organizationId: authResult.organizationId,
            email: authResult.auth.email,
            name: "Demo User",
            role: authResult.userRole,
            organizationName: "Demo Business",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();

    const result = await db
      .select({
        userId: users.id,
        organizationId: users.organizationId,
        email: users.email,
        name: users.name,
        role: users.role,
        organizationName: organizations.name,
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, authResult.userId))
      .limit(1);

    const user = result[0];

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ user }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Me] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch user" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
