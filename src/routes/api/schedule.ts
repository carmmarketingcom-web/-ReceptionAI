/**
 * GET /api/schedule
 *
 * Returns appointments for a given month for the authenticated organization.
 * Query: ?month=YYYY-MM (defaults to current month)
 *
 * Route file for route-tree generation. The actual handler runs inline in serve.ts
 * (the custom Bun server) using the same logic — JWT auth + DB-backed schedule queries.
 * Replaces the Google Calendar OAuth dependency with a simple DB-backed schedule.
 */

import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../lib/middleware";

export const Route = createFileRoute("/api/schedule")({});

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export async function GET({ request }: { request: Request }) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const { organizationId } = authResult;
  const db = sql();

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month") || "";

  // Parse month or default to current
  let year: number;
  let month: number;
  if (/^\d{4}-\d{2}$/.test(monthParam)) {
    [year, month] = monthParam.split("-").map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  // Calculate month boundaries
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDay = new Date(year, month, 0).getDate(); // Last day of month
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

  try {
    const rows = await db`
      SELECT
        a.id,
        a.title,
        a.start_time,
        a.end_time,
        a.status,
        a.service_type,
        a.notes,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email
      FROM appointments a
      LEFT JOIN contacts c ON a.contact_id = c.id
      WHERE a.organization_id = ${organizationId}
        AND DATE(a.start_time) >= ${startDate}::date
        AND DATE(a.start_time) <= ${endDate}::date
        AND a.status IN ('confirmed', 'scheduled', 'completed')
      ORDER BY a.start_time ASC
    `;

    const appointments = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      date: new Date(r.start_time).toISOString().split("T")[0],
      time: new Date(r.start_time).toISOString().split("T")[1].substring(0, 5),
      endTime: r.end_time ? new Date(r.end_time).toISOString().split("T")[1].substring(0, 5) : null,
      status: r.status,
      service: r.service_type,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerEmail: r.customer_email,
    }));

    // Build day-by-day map
    const byDay: Record<string, typeof appointments> = {};
    for (const a of appointments) {
      byDay[a.date] = byDay[a.date] || [];
      byDay[a.date].push(a);
    }

    // Count upcoming (all future, not just this month)
    const upcomingRow = await db`
      SELECT COUNT(*) as count
      FROM appointments
      WHERE organization_id = ${organizationId}
        AND start_time >= NOW()
        AND status IN ('confirmed', 'scheduled')
    `;

    return new Response(
      JSON.stringify({
        year,
        month,
        monthLabel: new Date(year, month - 1).toLocaleString("en", { month: "long", year: "numeric" }),
        appointments,
        byDay,
        totalInMonth: appointments.length,
        totalUpcoming: Number(upcomingRow[0]?.count || 0),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Schedule API] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: "Failed to load schedule", detail: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
