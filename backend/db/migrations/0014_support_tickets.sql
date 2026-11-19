-- 0014 — customer support tickets (owner request 2026-11-19)
--
-- Why this exists: when a customer hits a problem today there is no way to tell the team
-- without going through the owner. This table is the record of what a customer reported, and
-- the `context` snapshot is the point of the feature: it carries this org's own recent calls,
-- reminder-call results and transfer outcomes so the team can diagnose from the email alone
-- instead of asking the customer to describe what they already paid for.
--
--   category — 'calls' | 'booking' | 'billing' | 'login' | 'other'
--   severity — 'blocking' | 'normal' | 'question'
--   status   — 'open' | 'team_replied' | 'resolved' | 'closed'
--
-- The server also issues this CREATE TABLE itself on the first ticket (the same pattern 0008,
-- 0010, 0012 and 0013 use), so a deploy works before this file is applied by hand.
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opened_by_user_id uuid NULL,
  opened_by_email text NULL,
  category text NOT NULL DEFAULT 'other',   -- 'calls' | 'booking' | 'billing' | 'login' | 'other'
  severity text NOT NULL DEFAULT 'normal',  -- 'blocking' | 'normal' | 'question'
  subject text NOT NULL,
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',      -- 'open' | 'team_replied' | 'resolved' | 'closed'
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- The dashboard reads this org's newest rows first.
CREATE INDEX IF NOT EXISTS support_tickets_org_created_idx
  ON support_tickets (organization_id, created_at DESC);
