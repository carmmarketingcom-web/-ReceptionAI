-- 0013 — transfer outcomes are recorded (owner request 2026-11-18)
--
-- Why this exists: until 2026-11-18 nothing outbound could dial at all (Telnyx rejected every
-- call with D38 — the voice application had no Outbound Voice Profile), so the first real
-- transfer happened that day. Its outcome lived only in the server log, which is gone the next
-- time the process restarts, and nothing in the dashboard could say whether the owner actually
-- answered the caller.
--
-- One row per transfer attempt, written by the voice server at four points:
--   no_target — nobody to ring (no transfer_number and no organizations.phone)
--   failed    — the dial itself was rejected, or the bridge command failed
--   bridged   — the owner answered and the caller was connected to them
--   missed    — the owner never picked up; the caller is told someone will call back
--
--   source — 'inbound' for a call answered on the business line,
--            'reminder_call' for option 3 on the automated 24-hour reminder call.
--
-- A write failure here must never break a live call: the server wraps every insert in
-- try/catch and logs one line. So this table is the record of what we managed to store, not a
-- guaranteed one-row-per-attempt ledger — the dashboard says so rather than implying otherwise.
-- The server also issues this CREATE TABLE itself on the first transfer (the same pattern 0008
-- and 0010 use), so a deploy records transfers before this file has been applied by hand.
CREATE TABLE IF NOT EXISTS transfer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  conversation_id uuid NULL,
  caller_number text NULL,
  target_number text NULL,
  outcome text NOT NULL,           -- 'bridged' | 'missed' | 'failed' | 'no_target'
  language text NOT NULL DEFAULT 'en',
  source text NOT NULL DEFAULT 'inbound',  -- 'inbound' | 'reminder_call'
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- The dashboard reads this org's newest rows first.
CREATE INDEX IF NOT EXISTS transfer_events_org_created_idx
  ON transfer_events (organization_id, created_at DESC);
