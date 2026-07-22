import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Running migrations...");

  // Create enums (drop first to handle re-runs)
  const enumDefs = [
    `CREATE TYPE user_role AS ENUM ('owner', 'admin', 'agent', 'viewer')`,
    `CREATE TYPE conversation_type AS ENUM ('call', 'sms', 'web_chat', 'whatsapp', 'facebook')`,
    `CREATE TYPE conversation_status AS ENUM ('active', 'ended', 'missed', 'voicemail', 'transferred')`,
    `CREATE TYPE conversation_direction AS ENUM ('inbound', 'outbound')`,
    `CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system')`,
    `CREATE TYPE message_content_type AS ENUM ('text', 'audio', 'transcript', 'image')`,
    `CREATE TYPE transcription_status AS ENUM ('pending', 'completed', 'failed')`,
    `CREATE TYPE callback_status AS ENUM ('pending', 'contacted', 'resolved', 'declined')`,
    `CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled')`,
    `CREATE TYPE calendar_provider AS ENUM ('google', 'microsoft')`,
    `CREATE TYPE trigger_type AS ENUM ('greeting', 'voicemail', 'appointment_booking', 'appointment_reminder', 'faq', 'fallback', 'after_hours', 'transfer', 'follow_up')`,
    `CREATE TYPE language_code AS ENUM ('en', 'es')`,
    `CREATE TYPE campaign_trigger AS ENUM ('missed_call', 'after_appointment', 'no_contact', 'birthday', 'appointment_reminder', 'custom')`,
    `CREATE TYPE follow_up_channel AS ENUM ('sms', 'email', 'voice')`,
    `CREATE TYPE follow_up_status AS ENUM ('pending', 'queued', 'sent', 'delivered', 'failed', 'opted_out', 'replied')`,
    `CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')`,
    `CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual')`,
    `CREATE TYPE usage_type AS ENUM ('ai_minutes', 'sms_outbound', 'sms_inbound', 'phone_line', 'recording_storage')`,
  ];
  for (const def of enumDefs) {
    try { await sql(def); } catch (e) { console.log("Enum exists or error:", def.slice(0, 40)); }
  }

  console.log("Enums created");

  // Create organizations table
  await sql`CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255),
    phone VARCHAR(30),
    timezone VARCHAR(100) NOT NULL DEFAULT 'America/Chicago',
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    logo_url TEXT,
    website VARCHAR(500),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'US',
    industry VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS orgs_slug_idx ON organizations(slug)`;

  // Create organization_settings
  await sql`CREATE TABLE IF NOT EXISTS organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, key)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS org_settings_org_idx ON organization_settings(organization_id)`;

  // Create users
  await sql`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'agent',
    password_hash VARCHAR(255),
    avatar_url TEXT,
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    is_active VARCHAR(1) NOT NULL DEFAULT '1',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS users_org_idx ON users(organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`;

  // Create user_invitations
  await sql`CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'agent',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS invitations_org_idx ON user_invitations(organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS invitations_token_idx ON user_invitations(token)`;

  // Create phone_numbers
  await sql`CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    label VARCHAR(100),
    provider VARCHAR(50) NOT NULL DEFAULT 'twilio',
    provider_sid VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    capabilities JSONB NOT NULL DEFAULT '{"voice": true, "sms": true, "mms": false}',
    forwarding_number VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS phone_numbers_org_idx ON phone_numbers(organization_id)`;

  // Create contacts
  await sql`CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(30),
    company VARCHAR(255),
    notes TEXT,
    tags JSONB DEFAULT '[]',
    preferred_language VARCHAR(10) DEFAULT 'en',
    opt_out_sms BOOLEAN DEFAULT false,
    opt_out_email BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS contacts_org_idx ON contacts(organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS contacts_phone_idx ON contacts(phone)`;
  await sql`CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(email)`;

  // Create conversations
  await sql`CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type conversation_type NOT NULL DEFAULT 'call',
    status conversation_status NOT NULL DEFAULT 'active',
    direction conversation_direction NOT NULL DEFAULT 'inbound',
    subject VARCHAR(500),
    twilio_call_sid VARCHAR(100),
    twilio_chat_sid VARCHAR(100),
    source_url TEXT,
    ai_handled BOOLEAN DEFAULT true,
    escalated_to_human BOOLEAN DEFAULT false,
    escalated_at TIMESTAMPTZ,
    escalation_reason TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS conversations_org_idx ON conversations(organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS conversations_contact_idx ON conversations(contact_id)`;
  await sql`CREATE INDEX IF NOT EXISTS conversations_status_idx ON conversations(status)`;
  await sql`CREATE INDEX IF NOT EXISTS conversations_started_idx ON conversations(started_at)`;

  // Create messages
  await sql`CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role message_role NOT NULL DEFAULT 'user',
    content TEXT NOT NULL,
    content_type message_content_type NOT NULL DEFAULT 'text',
    twilio_message_sid VARCHAR(100),
    media_urls JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id)`;
  await sql`CREATE INDEX IF NOT EXISTS messages_org_idx ON messages(organization_id)`;

  // Create recordings
  await sql`CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    recording_url TEXT,
    duration_seconds INTEGER,
    transcription_text TEXT,
    transcription_status transcription_status DEFAULT 'pending',
    storage_provider VARCHAR(50),
    storage_key VARCHAR(500),
    twilio_recording_sid VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS recordings_org_idx ON recordings(organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS recordings_conversation_idx ON recordings(conversation_id)`;

  // Create missed_calls
  await sql`CREATE TABLE IF NOT EXISTS missed_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    caller_number VARCHAR(20) NOT NULL,
    caller_name VARCHAR(255),
    twilio_call_sid VARCHAR(100),
    ring_duration_seconds INTEGER,
    voicemail_url TEXT,
    voicemail_transcription TEXT,
    callback_requested BOOLEAN DEFAULT false,
    callback_status callback_status DEFAULT 'pending',
    callback_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS missed_calls_org_idx ON missed_calls(organization_id)`;

  // Create appointments
  await sql`CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(100) NOT NULL DEFAULT 'America/Chicago',
    status appointment_status NOT NULL DEFAULT 'scheduled',
    cancellation_reason TEXT,
    service_type VARCHAR(255),
    staff_assigned_id UUID REFERENCES users(id) ON DELETE SET NULL,
    location VARCHAR(500),
    notes TEXT,
    reminder_sent_at TIMESTAMPTZ,
    reminder_sent_count VARCHAR(1) DEFAULT '0',
    confirmation_sent_at TIMESTAMPTZ,
    external_calendar_event_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS appointments_org_idx ON appointments(organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS appointments_start_idx ON appointments(start_time)`;
  await sql`CREATE INDEX IF NOT EXISTS appointments_status_idx ON appointments(status)`;

  // Create calendar_integrations
  await sql`CREATE TABLE IF NOT EXISTS calendar_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider calendar_provider NOT NULL,
    provider_email VARCHAR(255) NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    calendar_id VARCHAR(500),
    calendar_name VARCHAR(255),
    sync_direction VARCHAR(20) DEFAULT 'both',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, provider, provider_email)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS cal_integrations_org_idx ON calendar_integrations(organization_id)`;

  // Create business_hours
  await sql`CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    day_of_week VARCHAR(1) NOT NULL,
    open_time VARCHAR(5) NOT NULL DEFAULT '09:00',
    close_time VARCHAR(5) NOT NULL DEFAULT '17:00',
    is_closed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, day_of_week)
  )`;

  // Create holiday_overrides
  await sql`CREATE TABLE IF NOT EXISTS holiday_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT true,
    open_time VARCHAR(5),
    close_time VARCHAR(5),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // Create ai_response_templates
  await sql`CREATE TABLE IF NOT EXISTS ai_response_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type trigger_type NOT NULL,
    language language_code NOT NULL DEFAULT 'en',
    response_text TEXT NOT NULL,
    voice_id VARCHAR(100),
    system_prompt TEXT,
    variables JSONB DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order VARCHAR(3) DEFAULT '0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS ai_templates_org_idx ON ai_response_templates(organization_id)`;

  // Create ai_knowledge_base
  await sql`CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(255),
    language language_code NOT NULL DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS ai_kb_org_idx ON ai_knowledge_base(organization_id)`;

  // Create follow_up_campaigns
  await sql`CREATE TABLE IF NOT EXISTS follow_up_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_event campaign_trigger NOT NULL,
    delay_minutes INTEGER NOT NULL DEFAULT 15,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    interval_minutes INTEGER NOT NULL DEFAULT 1440,
    channels JSONB NOT NULL DEFAULT '["sms"]',
    message_template TEXT,
    language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS campaigns_org_idx ON follow_up_campaigns(organization_id)`;

  // Create follow_up_messages
  await sql`CREATE TABLE IF NOT EXISTS follow_up_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES follow_up_campaigns(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    channel follow_up_channel NOT NULL DEFAULT 'sms',
    message_content TEXT NOT NULL,
    status follow_up_status NOT NULL DEFAULT 'pending',
    attempt_number INTEGER NOT NULL DEFAULT 1,
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    twilio_message_sid VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS followup_msgs_org_idx ON follow_up_messages(organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS followup_msgs_status_idx ON follow_up_messages(status)`;

  // Create subscription_plans
  await sql`CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    stripe_price_id_monthly VARCHAR(255),
    stripe_price_id_annual VARCHAR(255),
    price_monthly_cents INTEGER NOT NULL,
    price_annual_cents INTEGER NOT NULL,
    included_phone_lines INTEGER NOT NULL DEFAULT 1,
    included_ai_minutes INTEGER NOT NULL DEFAULT 500,
    included_sms_messages INTEGER DEFAULT 0,
    features JSONB DEFAULT '[]',
    limits JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // Create subscriptions
  await sql`CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    status subscription_status NOT NULL DEFAULT 'incomplete',
    billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    addons JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS subscriptions_org_idx ON subscriptions(organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status)`;

  // Create usage_records
  await sql`CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    record_type usage_type NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_label VARCHAR(50) DEFAULT 'minutes',
    description VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS usage_org_idx ON usage_records(organization_id)`;

  // Create stripe_events
  await sql`CREATE TABLE IF NOT EXISTS stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  console.log("All tables created!");

  // Seed subscription plans
  await sql`INSERT INTO subscription_plans (name, display_name, description, price_monthly_cents, price_annual_cents, included_phone_lines, included_ai_minutes, features, sort_order, is_active)
  VALUES 
    ('starter', 'Starter', 'Perfect for solopreneurs. 1 phone line, 500 AI-minutes, SMS & web chat.', 9900, 95040, 1, 500, '["1 phone line", "500 AI-minutes/month", "SMS & web chat", "Basic calendar sync", "English & Spanish", "Email support"]', 1, true),
    ('growth', 'Growth', 'Ideal for growing teams. 2 lines, 2,000 AI-minutes, WhatsApp & Facebook.', 19900, 191040, 2, 2000, '["2 phone lines", "2,000 AI-minutes/month", "WhatsApp & Facebook", "Advanced analytics", "Team management", "Priority support"]', 2, true),
    ('scale', 'Scale', 'For high-volume businesses. Unlimited lines, custom AI, priority support.', 39900, 383040, 999, 10000, '["Unlimited phone lines", "10,000+ AI-minutes/month", "Custom AI responses", "All channels", "Dedicated manager", "24/7 priority support"]', 3, true)
  ON CONFLICT (name) DO NOTHING`;

  console.log("Seed data inserted!");
  console.log("Migration complete!");
}

migrate().catch(console.error);