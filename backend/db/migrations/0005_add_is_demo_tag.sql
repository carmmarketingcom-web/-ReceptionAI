-- Migration: tag demo-line traffic so the owner's real reporting excludes it
--
-- Owner decision 2026-10-29: calls to the public demo line (+17279667556) are the owner's own
-- test traffic and must never appear in his dashboard, analytics or KPIs. The tag is written
-- at call time from CallState.isDemo — it is NEVER inferred from the phone number at read
-- time, because a future real customer could be assigned a similar number.
--
-- Which tables get their own column:
--   conversations — the per-call row; everything else hangs off it.
--   missed_calls  — has NO conversation_id, so it cannot be filtered through a join.
--   appointments  — a booking taken on the demo line is demo traffic, and appointments are
--                   counted by the dashboard ("bookings today") and by /api/analytics.
-- Which tables are filtered through the join instead of duplicating the column:
--   recordings, messages, follow_up_messages — all carry conversation_id NOT NULL and are
--   read with a join on conversations, so conversations.is_demo is the single source of truth.
--
-- Idempotent: every statement is safe to re-run (IF NOT EXISTS, and back-fills only touch
-- rows that are still false).

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE missed_calls  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE appointments  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- Cheap default-on filter: every reporting query is scoped by organization_id already.
CREATE INDEX IF NOT EXISTS conversations_org_is_demo_idx ON conversations (organization_id, is_demo);
CREATE INDEX IF NOT EXISTS missed_calls_org_is_demo_idx  ON missed_calls (organization_id, is_demo);
CREATE INDEX IF NOT EXISTS appointments_org_is_demo_idx  ON appointments (organization_id, is_demo);

-- ── Back-fill ───────────────────────────────────────────────────────────────────────────────
-- 1) Rows that carry the demo line's phone_number_id — the exact, unambiguous match.
UPDATE conversations c SET is_demo = true
FROM phone_numbers pn
WHERE c.phone_number_id = pn.id
  AND pn.phone_number = '+17279667556'
  AND c.is_demo = false;

UPDATE missed_calls m SET is_demo = true
FROM phone_numbers pn
WHERE m.phone_number_id = pn.id
  AND pn.phone_number = '+17279667556'
  AND m.is_demo = false;

-- 2) Older rows with no phone_number_id at all: attribute them by the org that owns the demo
--    line, but ONLY for an org whose single line is the demo number. A real customer always
--    has their own number, so their rows can never be swept in by this.
UPDATE conversations c SET is_demo = true
WHERE c.phone_number_id IS NULL
  AND c.is_demo = false
  AND c.organization_id IN (
    SELECT pn.organization_id FROM phone_numbers pn
    WHERE pn.phone_number = '+17279667556'
      AND NOT EXISTS (
        SELECT 1 FROM phone_numbers other
        WHERE other.organization_id = pn.organization_id
          AND other.phone_number <> '+17279667556'
      )
  );

UPDATE missed_calls m SET is_demo = true
WHERE m.phone_number_id IS NULL
  AND m.is_demo = false
  AND m.organization_id IN (
    SELECT pn.organization_id FROM phone_numbers pn
    WHERE pn.phone_number = '+17279667556'
      AND NOT EXISTS (
        SELECT 1 FROM phone_numbers other
        WHERE other.organization_id = pn.organization_id
          AND other.phone_number <> '+17279667556'
      )
  );

-- 3) Appointments booked before conversation links existed, in that same demo-only org.
UPDATE appointments a SET is_demo = true
WHERE a.is_demo = false
  AND a.organization_id IN (
    SELECT pn.organization_id FROM phone_numbers pn
    WHERE pn.phone_number = '+17279667556'
      AND NOT EXISTS (
        SELECT 1 FROM phone_numbers other
        WHERE other.organization_id = pn.organization_id
          AND other.phone_number <> '+17279667556'
      )
  );
