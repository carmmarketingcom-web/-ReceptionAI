-- Migration: make webhook processing exactly-once, and give Carm buyers a way in
--
-- Two defects, one theme: a customer who pays must end up with a working account, exactly once.
--
-- 1) Idempotency. Stripe retries deliveries and can deliver several event types for one
--    payment (checkout.session.completed, payment_intent.succeeded, invoice.paid). Nothing
--    recorded which events had been processed, so a retry re-ran provisioning and created a
--    second organization, user, Telnyx number and subscription row for one payment — a
--    duplicate number is real money.
--
--    `stripe_events` already existed in the schema as an audit table with
--    `stripe_event_id VARCHAR(255) NOT NULL UNIQUE`; nothing wrote to it. The webhook now
--    CLAIMS an event before doing any work:
--        INSERT … ON CONFLICT (stripe_event_id) DO NOTHING RETURNING id
--    No row returned = someone already owns this event = do nothing, answer 200. The unique
--    constraint is what makes that safe under concurrent deliveries, so it is re-stated here
--    for any environment whose table predates it.
--
-- 2) Set-password links. Carm Marketing one-time buyers are provisioned with a random bcrypt
--    hash nobody knows and receive no email, so a paying customer had no way into their own
--    dashboard. Their welcome email now carries a single-use link; the token's SHA-256 digest
--    lives here (never the token itself) so "used" is durable and can only be claimed once.
--
-- Idempotent: every statement is safe to re-run.

-- ── 1. Stripe event ledger ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- The constraint the claim relies on. Added separately so a table created before this
-- migration (without UNIQUE) is brought up to the same guarantee.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'stripe_events'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%(stripe_event_id)%'
  ) THEN
    -- Duplicate ids can only exist if something inserted without the constraint; keep the
    -- earliest row (the one whose processing actually happened) and drop the rest.
    DELETE FROM stripe_events a
    USING stripe_events b
    WHERE a.stripe_event_id = b.stripe_event_id
      AND a.created_at > b.created_at;
    ALTER TABLE stripe_events ADD CONSTRAINT stripe_events_stripe_event_id_key UNIQUE (stripe_event_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS stripe_events_type_idx ON stripe_events (event_type);
CREATE INDEX IF NOT EXISTS stripe_events_created_at_idx ON stripe_events (created_at);

-- ── 2. Set-password tokens ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_set_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- SHA-256 hex of the whole token. Never the token itself.
  token_hash VARCHAR(64) NOT NULL,
  purpose VARCHAR(40) NOT NULL DEFAULT 'set-password',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS password_set_tokens_hash_key ON password_set_tokens (token_hash);
CREATE INDEX IF NOT EXISTS password_set_tokens_user_idx ON password_set_tokens (user_id);

-- ── 3. Cheap lookup for the provisioning guard ─────────────────────────────────────────────
-- The webhook refuses to provision twice for the same Stripe customer or checkout session,
-- which means it looks orgs up by stripe_customer_id on every delivery.
CREATE INDEX IF NOT EXISTS organizations_stripe_customer_idx ON organizations (stripe_customer_id);
