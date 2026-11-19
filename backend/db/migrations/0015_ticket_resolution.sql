-- 0015 — closing the loop on a support ticket (owner request 2026-11-19)
--
-- Why this exists: a customer could report a problem and the team could read it, but nothing
-- in the product could set a status, record what was actually done, or tell the customer. The
-- owner's ask: when we resolve a ticket, the customer must be told.
--
--   resolution  — the one or two lines of what was actually done, shown on the dashboard and
--                 emailed to the customer when the ticket is resolved
--   resolved_at — when it was resolved, stamped once so re-sending cannot move the date
--   team_reply  — the last reply we sent the customer
--   replied_at  — when that reply went out
--
-- The server also issues these same ALTER statements itself on first use (the pattern 0012,
-- 0013 and 0014 use), so a deploy works before this file is applied by hand.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolution text NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS team_reply text NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS replied_at timestamptz NULL;
