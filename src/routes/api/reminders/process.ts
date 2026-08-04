/**
 * GET /api/reminders/process
 *
 * Cron endpoint: processes due appointment reminders and sends them via Telnyx SMS.
 * Designed to be called every 5 minutes by Vercel Cron or an external scheduler.
 *
 * Security: requires a shared secret (CRON_SECRET) in the Authorization header.
 *
 * Flow:
 *   1. Query appointment_reminders WHERE status='pending' AND scheduled_at <= NOW()
 *   2. For each, send SMS via Telnyx
 *   3. Update status to 'sent' or 'failed'
 *   4. Update appointment.reminder_sent_count + next_reminder_at
 */


import { neon } from "@neondatabase/serverless";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export async function GET({ request }: { request: Request }) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET || "receptionai-cron-secret-dev";
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (token !== cronSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = sql();
  const now = new Date().toISOString();

  try {
    // Fetch due reminders with org phone numbers
    const dueReminders = await db`
      SELECT
        ar.id as reminder_id,
        ar.appointment_id,
        ar.organization_id,
        ar.reminder_type,
        ar.recipient_phone,
        ar.recipient_email,
        ar.message_body,
        a.customer_name,
        a.title,
        o.name as org_name,
        o.id as org_id
      FROM appointment_reminders ar
      JOIN appointments a ON ar.appointment_id = a.id
      JOIN organizations o ON ar.organization_id = o.id
      WHERE ar.status = 'pending'
        AND ar.scheduled_at <= ${now}
      LIMIT 50
    `;

    const results = { sent: 0, failed: 0, skipped: 0 };

    for (const r of dueReminders) {
      // Get org's phone number for the "from" field
      const phoneRow = await db`
        SELECT phone_number FROM phone_numbers
        WHERE organization_id = ${r.org_id}
          AND is_active = true
        LIMIT 1
      `;

      const fromNumber = phoneRow[0]?.phone_number || "";

      if (!r.recipient_phone || !fromNumber) {
        // No phone to send to/from — mark as failed
        await db`
          UPDATE appointment_reminders
          SET status = 'failed', error_message = 'Missing phone number', updated_at = NOW()
          WHERE id = ${r.reminder_id}
        `;
        results.skipped++;
        continue;
      }

      try {
        // Send via Telnyx
        const sent = await sendTelnyxSms(r.recipient_phone, fromNumber, r.message_body);

        if (sent) {
          await db`
            UPDATE appointment_reminders
            SET status = 'sent', sent_at = NOW(), updated_at = NOW()
            WHERE id = ${r.reminder_id}
          `;

          // Update appointment counters
          await db`
            UPDATE appointments
            SET reminder_sent_at = NOW(),
                reminder_sent_count = COALESCE(NULLIF(reminder_sent_count, '0')::int + 1, 1)::text,
                updated_at = NOW()
            WHERE id = ${r.appointment_id}
          `;

          results.sent++;
        } else {
          await db`
            UPDATE appointment_reminders
            SET status = 'failed', error_message = 'Telnyx API error', updated_at = NOW()
            WHERE id = ${r.reminder_id}
          `;
          results.failed++;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await db`
          UPDATE appointment_reminders
          SET status = 'failed', error_message = ${errMsg}, updated_at = NOW()
          WHERE id = ${r.reminder_id}
        `;
        results.failed++;
      }
    }

    // Update next_reminder_at for appointments that still have pending reminders
    if (results.sent > 0) {
      await db`
        UPDATE appointments a
        SET next_reminder_at = (
          SELECT MIN(ar.scheduled_at)
          FROM appointment_reminders ar
          WHERE ar.appointment_id = a.id AND ar.status = 'pending'
        ),
        updated_at = NOW()
        WHERE a.id IN (
          SELECT DISTINCT ar2.appointment_id
          FROM appointment_reminders ar2
          WHERE ar2.status = 'pending'
        )
      `;
    }

    console.log(`[Reminders Process] Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}`);

    return new Response(
      JSON.stringify({ processed: dueReminders.length, ...results }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Reminders Process] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: "Processing failed", detail: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// ─── Telnyx SMS ────────────────────────────────────────────────────

async function sendTelnyxSms(
  to: string,
  from: string,
  body: string,
): Promise<boolean> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) {
    console.warn("[Reminders] TELNYX_API_KEY not set");
    return false;
  }

  try {
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to,
        text: body,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Reminders] Telnyx error: ${res.status} ${errText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Reminders] Telnyx send error:", err);
    return false;
  }
}
