-- Migration: Add appointment_reminders table
-- Tracks pending/sent reminders for scheduled appointments.

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reminder_type VARCHAR(20) NOT NULL,  -- '24h_before', '2h_before', 'follow_up', 'no_show'
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'cancelled'
  channel VARCHAR(10) NOT NULL DEFAULT 'sms',  -- 'sms', 'email'
  recipient_phone VARCHAR(30),
  recipient_email VARCHAR(255),
  message_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reminders_status_scheduled_idx ON appointment_reminders(status, scheduled_at);
CREATE INDEX IF NOT EXISTS reminders_appointment_idx ON appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS reminders_org_idx ON appointment_reminders(organization_id);

-- Add a next_reminder_at column to appointments for quick lookups
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS next_reminder_at TIMESTAMPTZ;
