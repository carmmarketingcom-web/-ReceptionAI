-- 0010 — outbound email records
--
-- Why this exists: email became the PRIMARY notification channel on 2026-11-03 (post-call
-- summary, voicemail, missed call, callback request, owner-transfer alert), because every
-- text is blocked by the carrier until the sending number is 10DLC-registered. A silent
-- email failure would therefore mean nobody is told a call happened — exactly the failure
-- that hid the broken "../lib/email" import for months.
--
-- One row per outbound email:
--   sent   — Resend accepted the message
--   failed — Resend rejected it, or no provider was configured
--
-- Epoch milliseconds and TEXT/INTEGER columns, exactly like sms_deliveries (0008), so the
-- same DDL runs against Postgres and against the SQLite fake used by
-- scripts/verify-email-primary.test.ts.
--
-- The server also issues this CREATE TABLE IF NOT EXISTS itself on the first send, so
-- /api/health can report email health before this migration is applied by hand.
CREATE TABLE IF NOT EXISTS email_deliveries (
  id             TEXT PRIMARY KEY,
  to_email       TEXT,
  subject        TEXT,
  kind           TEXT,
  org_id         TEXT,
  status         TEXT,
  error          TEXT,
  created_at_ms  BIGINT,
  updated_at_ms  BIGINT
);

CREATE INDEX IF NOT EXISTS email_deliveries_created_idx ON email_deliveries (created_at_ms);
CREATE INDEX IF NOT EXISTS email_deliveries_status_idx ON email_deliveries (status);
