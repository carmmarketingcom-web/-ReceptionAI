-- 0016 — a customer asks for a Google Calendar / Outlook connection (owner request 2026-11-19)
--
-- Why this exists: the owner wants customers told that the built-in calendar is the one to keep,
-- with a Google/Outlook connection available on request. Two-way sync does not exist yet and the
-- business holds no Google Cloud OAuth client and no Microsoft Entra app, so there is no install
-- link to render. This table is the request itself — one row per org and provider, so a customer
-- asking twice updates their note instead of piling up duplicates.
--
--   provider — 'google' | 'outlook' | 'both'
--   status   — 'requested' | 'contacted' | 'done' | 'declined'
--
-- Idempotent: safe to run more than once. The server also issues this CREATE TABLE itself on the
-- first request (the same pattern 0008, 0010 and 0013 use), so a deploy records requests before
-- this file has been applied by hand.
CREATE TABLE IF NOT EXISTS calendar_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  requested_by_user_id uuid NULL,
  requested_by_email text NULL,
  provider text NOT NULL DEFAULT 'both',   -- 'google' | 'outlook' | 'both'
  note text NULL,
  status text NOT NULL DEFAULT 'requested', -- 'requested' | 'contacted' | 'done' | 'declined'
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- One request per org per provider: a second request updates the row rather than duplicating it.
CREATE UNIQUE INDEX IF NOT EXISTS calendar_requests_org_provider_idx
  ON calendar_requests (organization_id, provider);
