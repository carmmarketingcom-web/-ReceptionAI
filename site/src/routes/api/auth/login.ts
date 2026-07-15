/**
 * POST /api/auth/login
 *
 * Authenticates a user by email + password.
 * Body: { email, password }
 * Returns: { token, user }
 */

import { z } from "zod";
import { verifyPassword, createToken } from "../../../lib/auth-server";
import { getDb, isMockMode } from "../../../db/index";
import { users, organizations } from "../../../db/schema/index";
import { eq, and } from "drizzle-orm";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: parsed.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { email, password } = parsed.data;
    const usingMock = isMockMode();

    if (usingMock) {
      // In mock mode, accept demo credentials
      if (email === "demo@receptionai.com" && password === "demo1234") {
        const token = await createToken({
          userId: "mock-user-1",
          organizationId: "mock-org-1",
          email,
          role: "owner",
        });
        return new Response(
          JSON.stringify({
            token,
            user: {
              userId: "mock-user-1",
              organizationId: "mock-org-1",
              email,
              name: "Demo User",
              role: "owner",
              organizationName: "Demo Business",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();

    // Find user by email (join with org to get org name)
    const result = await db
      .select({
        userId: users.id,
        organizationId: users.organizationId,
        email: users.email,
        name: users.name,
        role: users.role,
        passwordHash: users.passwordHash,
        organizationName: organizations.name,
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.email, email))
      .limit(1);

    const user = result[0];

    if (!user || !user.passwordHash) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = await createToken({
      userId: user.userId,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    });

    return new Response(
      JSON.stringify({
        token,
        user: {
          userId: user.userId,
          organizationId: user.organizationId,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationName: user.organizationName,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Login] Error:", error);
    return new Response(
      JSON.stringify({ error: "Login failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
