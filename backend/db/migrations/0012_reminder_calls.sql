-- 0012 — automated 24-hour reminder CALL (owner request 2026-11-17)
--
-- Why this exists: texting is off until the toll-free verification is approved, and a caller
-- who books by phone leaves no email address — so today that customer receives no reminder at
-- all (the row falls back to 'sms', which is off). The reminder call is the channel that needs
-- no carrier approval.
--
-- A '24h_call' row with channel 'voice' is queued when the booking is created (with a phone
-- number on it) and dialled by the in-process 5-minute reminder sweep, inside 09:00–20:00 at
-- the business, only while the Telnyx balance is at least $5.
--
--   result — the outcome of the call, plain text:
--            dialed | confirmed | cancelled | transfer | optout | no_answer | failed | skipped
--            (the reason for a skipped row is in error_message)
--
-- The server also issues these two ALTERs itself on the first sweep, so a deploy works before
-- this migration is applied by hand (same pattern as 0008 and 0010).
ALTER TABLE appointment_reminders ADD COLUMN IF NOT EXISTS result TEXT;

-- Opt-out is per contact: pressing 9 on a reminder call sets it, and it survives a re-booking.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reminder_calls_opt_out BOOLEAN NOT NULL DEFAULT false;

-- The sweep looks for due rows by channel; this keeps that lookup cheap.
CREATE INDEX IF NOT EXISTS reminders_channel_scheduled_idx
  ON appointment_reminders (channel, status, scheduled_at);
