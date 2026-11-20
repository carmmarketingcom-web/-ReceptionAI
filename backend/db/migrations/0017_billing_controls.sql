-- 0017 — billing controls: cancel reasons and the once-only three-month credit (owner 2026-11-19)
--
-- Why this exists: the Billing page's cancel flow was a mock funnel that could not cancel
-- anything, nothing asked a customer WHY they were leaving, and the FOUNDER50 promo (50% off
-- months 1–3) drops every customer onto the full price on month 4 with nothing to soften it.
--
-- FOUNDER50 IS NOT TOUCHED BY THIS FILE. The coupon keeps discounting months 1–3 exactly as it
-- does today. `subscription_credits` is a separate, once-only half-month credit that lands on the
-- invoice after three months, and a customer may have both.
--
-- subscription_cancellations — one open row per org while a cancellation is pending; `resumed_at`
-- is stamped if the customer undoes it, and a later cancel updates the open row instead of adding
-- a second one. `reason` is one of the six the owner asked for, `comment` is optional free text,
-- `effective_at` is the end of the paid period (the plan keeps working until then).
--
-- subscription_credits — the claim for the half-month credit. The UNIQUE index on organization_id
-- is the lock: the server inserts the claim BEFORE calling Stripe, so a restart, a second sweep or
-- two servers racing can never credit the same customer twice. If Stripe rejects the credit the
-- claim is deleted and a later sweep tries again.
--
-- The server also issues both CREATE TABLEs itself on first use (the same pattern 0008, 0010 and
-- 0013 use), so a deploy that lands before this file is applied by hand still records a
-- cancellation and still claims a credit exactly once.
CREATE TABLE IF NOT EXISTS subscription_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_subscription_id text NULL,
  reason text NOT NULL,                    -- 'Too expensive' | 'Not enough calls' | 'Missing a feature'
                                           -- | 'Closing the business' | 'Going elsewhere' | 'Other'
  comment text NULL,
  requested_by_email text NULL,
  effective_at timestamptz NULL,           -- end of the paid period; the plan runs until then
  resumed_at timestamptz NULL,             -- set when the customer undoes the cancellation
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscription_cancellations_org_created_idx
  ON subscription_cancellations (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscription_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_subscription_id text NULL,
  amount_cents integer NOT NULL,           -- Math.round(monthly plan price / 2)
  applied_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Exactly once, per customer. This index IS the idempotency of the credit.
CREATE UNIQUE INDEX IF NOT EXISTS subscription_credits_org_key
  ON subscription_credits (organization_id);
