-- Migration: Add telnyxNumberId to phone_numbers and stripeCustomerId to organizations
-- Date: 2026-07-22

ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS telnyx_number_id VARCHAR(100);
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{"voice":true,"sms":true,"mms":false}'::jsonb;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Add index for Telnyx number lookup
CREATE INDEX IF NOT EXISTS phone_numbers_telnyx_idx ON phone_numbers(telnyx_number_id);

-- Add index for Stripe customer lookup on organizations
CREATE INDEX IF NOT EXISTS orgs_stripe_customer_idx ON organizations(stripe_customer_id);
