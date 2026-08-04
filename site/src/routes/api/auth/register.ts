/**
 * POST /api/auth/register
 *
 * Creates a new organization and admin user.
 * Body: { name, email, password, industry?, timezone?, locale? }
 * Returns: { token, user }
 */


import { z } from "zod";
import { hashPassword, createToken, generateSlug } from "../../../lib/auth-server";
import { getDb, isMockMode } from "../../../db/index";
import {
  organizations,
  users,
  businessHours,
} from "../../../db/schema/index";

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  industry: z.string().max(100).optional(),
  timezone: z.string().max(100).optional(),
  locale: z.enum(["en", "es"]).optional(),
});

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: parsed.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { name, email, password, industry, timezone, locale } = parsed.data;
    const db = getDb();
    const usingMock = isMockMode();

    const passwordHash = await hashPassword(password);
    const slug = generateSlug(name);
    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    if (!usingMock) {
      // Create organization
      await db.insert(organizations).values({
        id: orgId,
        name,
        slug,
        email,
        timezone: timezone || "America/Chicago",
        locale: locale || "en",
        industry: industry || null,
      });

      // Create admin user
      await db.insert(users).values({
        id: userId,
        organizationId: orgId,
        email,
        name,
        role: "owner",
        passwordHash,
      });

      // Create default business hours (Mon-Fri 9-5, Sat-Sun closed)
      for (let day = 1; day <= 5; day++) {
        await db.insert(businessHours).values({
          id: crypto.randomUUID(),
          organizationId: orgId,
          dayOfWeek: String(day),
          openTime: "09:00",
          closeTime: "17:00",
        });
      }
      for (const day of [0, 6]) {
        await db.insert(businessHours).values({
          id: crypto.randomUUID(),
          organizationId: orgId,
          dayOfWeek: String(day),
          isClosed: true,
        });
      }
    }

    // Generate JWT
    const token = await createToken({
      userId,
      organizationId: orgId,
      email,
      role: "owner",
    });

    return new Response(
      JSON.stringify({
        token,
        user: {
          userId,
          organizationId: orgId,
          email,
          name,
          role: "owner",
          organizationName: name,
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Register] Error:", error);
    return new Response(
      JSON.stringify({ error: "Registration failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
