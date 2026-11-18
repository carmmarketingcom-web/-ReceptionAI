-- 0011 — texting add-on requests ($10/month, filed by us)
--
-- Why this exists: texting is OFF because the carriers rejected our toll-free
-- verification (2026-11-16) for missing opt-in consent. A business that wants text
-- alerts asks for them at setup time; we file the verification for their number and
-- confirm by email before any billing starts. Nothing in the product may claim that
-- texting is active until a real text is delivered.
--
-- One row per organization (a repeat request updates the row):
--   phone        — the mobile number we will file and text
--   consent_text — the exact wording the owner agreed to, stored verbatim: this is
--                  the opt-in evidence we file with the carrier
--   consent_at   — when they agreed
--   status       — 'requested' today; later states are set by us, never by the UI
--
-- The server also issues this CREATE TABLE IF NOT EXISTS itself on the first request,
-- so the endpoint works before this migration is applied by hand (same pattern as
-- 0008 sms_deliveries and 0010 email_deliveries).
CREATE TABLE IF NOT EXISTS texting_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL,
  phone            text,
  consent_text     text,
  consent_at       timestamptz,
  status           text NOT NULL DEFAULT 'requested',
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Repeat requests update the existing row instead of piling up duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS texting_requests_org_idx ON texting_requests (organization_id);
CREATE INDEX IF NOT EXISTS texting_requests_status_idx ON texting_requests (status);
