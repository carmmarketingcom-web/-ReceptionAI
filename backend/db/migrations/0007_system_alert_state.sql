-- 0007 — Telnyx balance watchdog state
--
-- The balance watchdog texts the owner when the prepaid Telnyx balance drops
-- below $50 (warn, ≤1/24h) and $20 (urgent, ≤1/6h). Telnyx is the only vendor
-- that hard-stops: at $0 inbound calls fail, so a paying customer's line goes
-- dead with no warning.
--
-- The last-fired timestamps live here (not in memory) so a redeploy or restart
-- cannot re-spam the owner with the same alert. Epoch milliseconds, not
-- timestamps, so the same DDL and the same statements run unchanged against
-- Postgres and against the SQLite fake used by scripts/verify-balance-watchdog.test.ts.
--
-- The server also issues this CREATE TABLE IF NOT EXISTS itself on the first
-- check, so the watchdog works before this migration is applied by hand.
-- Applying it is still the right thing to do: it makes the table visible to
-- anyone reading the schema.
CREATE TABLE IF NOT EXISTS system_alert_state (
  alert_key         TEXT PRIMARY KEY,
  last_fired_at_ms  BIGINT,
  last_level        TEXT,
  last_value        TEXT
);
