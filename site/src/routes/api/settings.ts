/**
 * GET /api/settings — Get organization settings (business hours, org profile, etc.)
 * PUT /api/settings — Update organization settings
 */

import { z } from "zod";
import { authenticate, requireRole } from "../../../lib/middleware";
import { getDb, isMockMode } from "../../../db/index";
import {
  organizations,
  businessHours,
  organizationSettings,
} from "../../../db/schema/index";
import { eq, and } from "drizzle-orm";

export async function GET({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const usingMock = isMockMode();
    if (usingMock) {
      return new Response(
        JSON.stringify({
          organization: {
            id: "mock-org-1",
            name: "Demo Business",
            slug: "demo-business",
            timezone: "America/Chicago",
            locale: "en",
            industry: "Service",
          },
          businessHours: [
            { dayOfWeek: "0", isClosed: true },
            { dayOfWeek: "1", openTime: "09:00", closeTime: "17:00" },
            { dayOfWeek: "2", openTime: "09:00", closeTime: "17:00" },
            { dayOfWeek: "3", openTime: "09:00", closeTime: "17:00" },
            { dayOfWeek: "4", openTime: "09:00", closeTime: "17:00" },
            { dayOfWeek: "5", openTime: "09:00", closeTime: "17:00" },
            { dayOfWeek: "6", isClosed: true },
          ],
          settings: {},
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();
    const orgId = authResult.organizationId;

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const hours = await db
      .select()
      .from(businessHours)
      .where(eq(businessHours.organizationId, orgId))
      .orderBy(businessHours.dayOfWeek as any);

    const settings = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId));

    const settingsMap: Record<string, any> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return new Response(
      JSON.stringify({
        organization: org || null,
        businessHours: hours,
        settings: settingsMap,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Settings GET] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch settings" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  timezone: z.string().max(100).optional(),
  locale: z.enum(["en", "es"]).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  website: z.string().max(500).optional(),
  industry: z.string().max(100).optional(),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  businessHours: z
    .array(
      z.object({
        dayOfWeek: z.string(),
        openTime: z.string().optional(),
        closeTime: z.string().optional(),
        isClosed: z.boolean().optional(),
      })
    )
    .optional(),
});

export async function PUT({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const roleCheck = requireRole(authResult, "admin");
    if (roleCheck instanceof Response) return roleCheck;

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { businessHours: bizHours, ...orgFields } = parsed.data;
    const usingMock = isMockMode();

    if (usingMock) {
      return new Response(
        JSON.stringify({ success: true, message: "Settings updated (mock mode)" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();
    const orgId = authResult.organizationId;

    // Update organization fields
    if (Object.keys(orgFields).length > 0) {
      await db
        .update(organizations)
        .set(orgFields)
        .where(eq(organizations.id, orgId));
    }

    // Update business hours
    if (bizHours) {
      for (const bh of bizHours) {
        await db
          .update(businessHours)
          .set({
            openTime: bh.openTime || null,
            closeTime: bh.closeTime || null,
            isClosed: bh.isClosed ?? false,
          })
          .where(
            and(
              eq(businessHours.organizationId, orgId),
              eq(businessHours.dayOfWeek, bh.dayOfWeek)
            )
          );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Settings PUT] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update settings" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
