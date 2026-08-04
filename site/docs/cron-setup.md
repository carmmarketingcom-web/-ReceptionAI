# Appointment Reminder Cron Setup

## Overview
The reminder system sends automated SMS reminders before appointments. Reminders are scheduled at:
- **24 hours before** the appointment (confirmation request)
- **2 hours before** the appointment (final reminder)
- **1 hour after** the appointment (follow-up / rating request)

An external cron service must periodically hit the `/api/reminders/process` endpoint to process due reminders.

## How It Works

1. When an appointment is booked, `scheduleReminders()` inserts pending reminder records into `appointment_reminders`
2. Each reminder has a `scheduled_at` timestamp and `status = 'pending'`
3. The cron endpoint queries for pending reminders where `scheduled_at <= NOW()`
4. For each due reminder, it sends an SMS via Telnyx and marks the reminder as `sent` or `failed`

## Endpoint

```
GET https://receptionai.ctonew.app/api/reminders/process?secret=CRON_SECRET
```

- **Method**: GET
- **Auth**: Pass `CRON_SECRET` as either:
  - Query parameter: `?secret=YOUR_CRON_SECRET`
  - Authorization header: `Authorization: Bearer YOUR_CRON_SECRET`
- **Response**: `{"processed": N, "sent": N, "failed": N}`

## CRON_SECRET

The current `CRON_SECRET` is stored in `.env`. The production server loads this automatically via a manual `.env` parser at the top of `serve.ts`.

To rotate the secret:
1. Update `CRON_SECRET` in `.env`
2. Restart the server (`bun run publish`)
3. Update the cron job URL with the new secret

## External Cron Setup

Use any cron service that hits HTTP endpoints (cron-job.org, UptimeRobot, EasyCron, etc.):

### Recommended: cron-job.org

1. Create a free account at https://cron-job.org
2. Create a new cron job:
   - **URL**: `https://receptionai.ctonew.app/api/reminders/process?secret=YOUR_CRON_SECRET`
   - **Interval**: Every 5 minutes (`*/5 * * * *`)
   - **Method**: GET
   - **Timeout**: 30 seconds
3. Save and enable

### Why every 5 minutes?

- Reminders don't need second-level precision
- 5 minutes is frequent enough to catch reminders close to their scheduled time
- The endpoint is lightweight (max 50 reminders per run, indexed query)
- Idempotent — processing the same reminder twice is harmless (it's already marked `sent`/`failed`)

## Monitoring

Check the response status:
- **200** with `{"processed": 0}` — no reminders due (normal, expected most of the time)
- **200** with `{"processed": N, "sent": N}` — N reminders sent successfully
- **200** with `{"processed": N, "failed": N}` — all N reminders failed (likely phone number issue)
- **401** — wrong CRON_SECRET

The endpoint logs failures to the server log. Check `/tmp/serve.log` or `.run/server.log` for error details.

## Fallback Behavior

If `CRON_SECRET` is not set in the environment, the endpoint falls back to a dev secret (`receptionai-cron-secret-dev`). This is for local development only — the production `.env` should always have a secure `CRON_SECRET` set.
