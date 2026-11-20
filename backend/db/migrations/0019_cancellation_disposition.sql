-- 0019 — what happens to the customer's number(s) when they cancel (owner 2026-11-20)
--
-- Why this exists: cancelling used to stop at Stripe. `subscriptions.status` went to 'canceled'
-- and nothing else changed — the AI kept answering the number, the booking page stayed up, the
-- reminder sweep kept dialling, and nobody at the company was told. The owner approved a flow
-- where cancelling is one question ("where should calls go?") with two plain answers, and every
-- consequence below is decided by `src/lib/cancellation.ts`.
--
-- subscription_cancellations gains the answer and the clock:
--   disposition        'nowhere' | 'forward' — where calls go after the paid month
--   forward_to         the number calls ring, when disposition = 'forward'
--   service_ended_at   when the sweep actually cut the business over (NULL = still being served)
--   data_delete_after  service_ended_at + 90 days; the customer's data is readable until then
--   data_delete_alerted_at  set once the team has been told the 90 days are up. Nothing deletes
--                      rows on a timer: the sweep reports, a human confirms.
--
-- organizations.service_ended_at is the single flag the call path, the reminder sweep, the
-- callback sweep and the booking page read. It is cleared if the customer resumes.
--
-- number_lifecycle is one row per number, written the moment service ends:
--   'nowhere'  out_of_service_until = service_ends_at + 14d, release_at = the same instant
--   'forward'  forward_until = service_ends_at + 30d, out_of_service_until = forward_until + 14d,
--              release_at = out_of_service_until
-- release_status walks scheduled → releasing → released, or blocked_pending_port / failed. The
-- row is claimed BEFORE the carrier call and `released_at` is only set when Telnyx accepted it,
-- so a restart, a second server or two overlapping ticks cannot release a number twice.
--
-- The server also issues every statement here itself on first use (the pattern 0008/0010/0013
-- use), so a deploy that lands before this file is applied by hand still behaves.
ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS disposition text;
ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS forward_to text;
ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS service_ended_at timestamptz;
ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS data_delete_after timestamptz;
ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS data_delete_alerted_at timestamptz;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS service_ended_at timestamptz;

CREATE TABLE IF NOT EXISTS number_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  phone_number_id uuid NULL,
  phone_e164 text NOT NULL,
  telnyx_number_id text NULL,
  mode text NOT NULL,                          -- 'nowhere' | 'forward'
  forward_to text NULL,
  service_ends_at timestamptz NOT NULL,
  forward_until timestamptz NULL,
  out_of_service_until timestamptz NOT NULL,
  release_at timestamptz NOT NULL,
  release_status text NOT NULL DEFAULT 'scheduled',
  release_note text NULL,
  released_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- One schedule per number. This index is what makes a re-run of the end-service pass a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS number_lifecycle_number_key
  ON number_lifecycle (phone_e164);

CREATE INDEX IF NOT EXISTS number_lifecycle_release_idx
  ON number_lifecycle (release_at) WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS organizations_service_ended_idx
  ON organizations (service_ended_at) WHERE service_ended_at IS NOT NULL;
