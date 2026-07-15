/**
 * GET  /api/appointments  — List appointments (with date range, status filter)
 * POST /api/appointments  — Create a new appointment
 */

import { z } from "zod";
import { authenticate } from "../../../lib/middleware";
import { getDb, isMockMode } from "../../../db/index";
import { appointments, contacts } from "../../../db/schema/index";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const createAppointmentSchema = z.object({
  contactId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  serviceType: z.string().max(255).optional(),
  staffAssignedId: z.string().uuid().optional(),
  location: z.string().max(500).optional(),
  notes: z.string().optional(),
});

export async function GET({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const startDate = url.searchParams.get("start");
    const endDate = url.searchParams.get("end");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const usingMock = isMockMode();
    if (usingMock) {
      return new Response(
        JSON.stringify({
          appointments: [],
          total: 0,
          limit,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();
    const conditions = [eq(appointments.organizationId, authResult.organizationId)];

    if (status) {
      conditions.push(eq(appointments.status, status as any));
    }
    if (startDate) {
      conditions.push(gte(appointments.startTime, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(appointments.endTime, new Date(endDate)));
    }

    const rows = await db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(desc(appointments.startTime))
      .limit(limit);

    return new Response(
      JSON.stringify({
        appointments: rows,
        total: rows.length,
        limit,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Appointments GET] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch appointments" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const body = await request.json();
    const parsed = createAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { contactId, title, description, startTime, endTime, serviceType, staffAssignedId, location, notes } = parsed.data;
    const usingMock = isMockMode();

    if (usingMock) {
      const mockAppt = {
        id: crypto.randomUUID(),
        organizationId: authResult.organizationId,
        contactId,
        title,
        description: description || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: "scheduled",
        serviceType: serviceType || null,
        staffAssignedId: staffAssignedId || null,
        location: location || null,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return new Response(
        JSON.stringify({ appointment: mockAppt }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();
    const id = crypto.randomUUID();

    await db.insert(appointments).values({
      id,
      organizationId: authResult.organizationId,
      contactId,
      title,
      description: description || null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: "scheduled",
      serviceType: serviceType || null,
      staffAssignedId: staffAssignedId || null,
      location: location || null,
      notes: notes || null,
    });

    const [created] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    return new Response(
      JSON.stringify({ appointment: created }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Appointments POST] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create appointment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
