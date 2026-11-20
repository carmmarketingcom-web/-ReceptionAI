-- 0018 — reminders and follow-ups: claim before sending, one row of a kind per appointment.
--
-- Why: processDueReminders() selected every 'pending' row that was due and only marked it
-- 'sent' after the provider call returned. Two overlapping ticks, a slow tick or a crash
-- mid-send therefore handed the same row to two senders, and a customer could receive the
-- same reminder twice. There was also no rule stopping two rows of the same kind from being
-- scheduled for one appointment, so a retried booking inserted the whole set again.
--
-- What this migration adds:
--   claimed_at            when a tick took the row (status='sending'); NULL once it settles
--   provider_message_id   the Telnyx message id (or call control id) that proves the send
--   unique index          (appointment_id, reminder_type) — the database now refuses a
--                         second row of the same kind for one appointment
--
-- The server issues these same statements on its first sweep (ensureReminderClaimSchema in
-- serve.ts), so a deploy is not blocked on this file being applied by hand. Running both is
-- safe: every statement is idempotent.

ALTER TABLE appointment_reminders ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE appointment_reminders ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Collapse rows that are already duplicated before the unique index can be created. A row
-- that already sent outranks an unsent one (a delivery record is never deleted); otherwise
-- the earliest row wins, because it is the one whose scheduled_at the customer was told.
DELETE FROM appointment_reminders WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY appointment_id, reminder_type
             ORDER BY (status = 'sent') DESC, created_at ASC, id ASC
           ) AS rn
    FROM appointment_reminders
  ) ranked
  WHERE ranked.rn > 1
);

-- One row of each kind per appointment, enforced by the database rather than by convention.
CREATE UNIQUE INDEX IF NOT EXISTS appointment_reminders_appt_kind
  ON appointment_reminders (appointment_id, reminder_type);

-- The claim query reads "status='pending' AND scheduled_at <= now()" every five minutes.
-- 0003 already created (status, scheduled_at); this one lets the claim also find dead
-- claims (status='sending' AND claimed_at < cutoff) without a full scan.
CREATE INDEX IF NOT EXISTS reminders_claimed_at_idx
  ON appointment_reminders (status, claimed_at);
