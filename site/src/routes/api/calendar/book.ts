/**
 * POST /api/calendar/book
 * Books an appointment: creates a calendar event, saves to DB, and schedules reminders.
 */


import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../../lib/middleware";
import { scheduleReminders, type ReminderPayload } from "../../../lib/reminders";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export async function POST({ request }: { request: Request }) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  try {
    const body = (await request.json()) as {
      contactId?: string;
      title?: string;
      date?: string;     // YYYY-MM-DD
      time?: string;     // HH:MM
      endTime?: string;  // HH:MM
      service?: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      notes?: string;
      duration?: number; // minutes, default 60
    };

    const {
      contactId,
      title = "",
      date = "",
      time = "",
      service = "General Service",
      customerName = "",
      customerPhone = "",
      customerEmail = "",
      notes = "",
      duration = 60,
    } = body;

    // Validate
    if (!date || !time) {
      return new Response(
        JSON.stringify({ error: "date and time are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!customerName || !customerPhone) {
      return new Response(
        JSON.stringify({ error: "customerName and customerPhone are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: "date must be YYYY-MM-DD" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Calculate end time
    const [hour, min] = time.split(":").map(Number);
    const endMinutes = hour * 60 + min + duration;
    const endTime =
      body.endTime ||
      `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    const startTime = `${date}T${time}:00`;
    const endTimeISO = `${date}T${endTime}:00`;

    const db = sql();
    const { organizationId, userId } = authResult;

    // 1. Look up or create contact
    let finalContactId = contactId;
    if (!finalContactId) {
      // Try to find existing contact by phone
      const existing = await db`
        SELECT id FROM contacts
        WHERE organization_id = ${organizationId}
          AND phone = ${customerPhone}
        LIMIT 1
      `;
      if (existing[0]) {
        finalContactId = existing[0].id;
      } else {
        // Create contact
        const created = await db`
          INSERT INTO contacts (id, organization_id, name, phone, email, created_at, updated_at)
          VALUES (gen_random_uuid(), ${organizationId}, ${customerName},
                  ${customerPhone}, ${customerEmail || null}, NOW(), NOW())
          RETURNING id
        `;
        finalContactId = created[0]?.id;
      }
    }

    // 2. Get org name and phone for reminders
    const orgRow = await db`
      SELECT o.name, pn.phone_number as org_phone
      FROM organizations o
      LEFT JOIN phone_numbers pn ON pn.organization_id = o.id AND pn.is_active = true
      WHERE o.id = ${organizationId}
      LIMIT 1
    `;

    const orgName = orgRow[0]?.name || "Our Business";
    const orgPhone = orgRow[0]?.org_phone || "";

    // 3. Create appointment
    const apptTitle = title || `${service} - ${customerName}`;

    const appointment = await db`
      INSERT INTO appointments
        (id, organization_id, contact_id, title, description,
         start_time, end_time, service_type, notes,
         status, created_at, updated_at)
      VALUES
        (gen_random_uuid(), ${organizationId}, ${finalContactId},
         ${apptTitle}, ${notes || null},
         ${startTime}, ${endTimeISO},
         ${service}, ${notes || null},
         'confirmed', NOW(), NOW())
      RETURNING id
    `;

    const appointmentId = appointment[0]?.id;
    if (!appointmentId) {
      throw new Error("Failed to create appointment");
    }

    // 4. Schedule reminders
    const reminderPayload: ReminderPayload = {
      appointmentId,
      organizationId,
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      service,
      date,
      time,
      orgName,
      orgPhone,
    };

    await scheduleReminders(reminderPayload);

    return new Response(
      JSON.stringify({
        success: true,
        appointment: {
          id: appointmentId,
          title: apptTitle,
          customerName,
          service,
          date,
          time: `${time} - ${endTime}`,
          status: "confirmed",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Calendar Book] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: "Failed to book appointment", detail: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
