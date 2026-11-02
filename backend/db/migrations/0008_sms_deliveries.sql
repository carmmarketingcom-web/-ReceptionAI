-- 0008 — outbound SMS delivery records
--
-- Why this exists: sendSms() was fire-and-forget. It awaited the Telnyx POST,
-- threw the response away and logged "Sent" whatever came back. Every outbound
-- SMS failed for a week (36 sent, 36 failed, 0 delivered — Telnyx error 40010,
-- "the sending number is not 10DLC-registered") and nobody knew, because
-- nothing recorded the outcome and the delivery webhook had nowhere to write.
--
-- One row per outbound message:
--   queued    — Telnyx accepted the POST (or reported message.sent)
--   delivered — message.finalized with status delivered
--   failed    — the POST was rejected, or message.finalized carried errors[]
--
-- telnyx_message_id is NULL when the POST itself failed (no id exists), so it
-- must stay nullable; UNIQUE still holds for real ids. Epoch milliseconds and
-- TEXT/INTEGER columns, exactly like system_alert_state (migration 0007), so
-- the same DDL runs against Postgres and against the SQLite fake used by
-- scripts/verify-sms-delivery.test.ts.
--
-- The server also issues this CREATE TABLE IF NOT EXISTS itself on the first
-- send, so tracking works before this migration is applied by hand.
CREATE TABLE IF NOT EXISTS sms_deliveries (
  id                TEXT PRIMARY KEY,
  telnyx_message_id TEXT UNIQUE,
  to_number         TEXT,
  kind              TEXT,
  parts             INTEGER,
  status            TEXT,
  error_code        TEXT,
  created_at_ms     BIGINT,
  updated_at_ms     BIGINT
);

CREATE INDEX IF NOT EXISTS sms_deliveries_created_idx ON sms_deliveries (created_at_ms);
CREATE INDEX IF NOT EXISTS sms_deliveries_status_idx ON sms_deliveries (status);
