-- Migration: Add transfer_number to organizations
-- When a caller asks to speak to a person, calls forward to this number (optional).
-- Leave NULL/blank to fall back to the organization phone, then the owner's user phone.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS transfer_number VARCHAR(30);
