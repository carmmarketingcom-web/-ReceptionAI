# ReceptionAI — Database Architecture

## Overview

PostgreSQL database for a multi-tenant AI receptionist SaaS platform. All
tenant data is isolated via `organization_id` foreign keys on every table.

**Stack:** Neon serverless Postgres → Drizzle ORM → TanStack Start API routes.

## Tenant Isolation Strategy

Every table includes `organization_id` as a non-null foreign key to
`organizations`. Row-Level Security (RLS) is configured per-organization
to enforce tenant isolation at the database level. All queries are scoped
with `WHERE organization_id = $currentOrgId`.

## Table Map (23 tables across 6 domains)

### Organizations & Users
| Table | Purpose | Key columns |
|---|---|---|
| `organizations` | Tenant businesses | slug (unique), timezone, locale |
| `organization_settings` | Flexible key-value settings per org | key + value (JSONB) |
| `users` | Employees of each org | email+org unique, role (owner/admin/agent/viewer) |
| `user_invitations` | Pending user invites | token, expires_at |

### Communications
| Table | Purpose | Key columns |
|---|---|---|
| `phone_numbers` | Twilio phone lines per org | provider_sid, capabilities (JSONB) |
| `contacts` | Customer CRM | phone+org unique, opt-out flags |
| `conversations` | Calls, texts, chats | type, status, ai_handled, escalated_to_human |
| `messages` | Individual messages | role (user/assistant/system), content_type |
| `recordings` | Call recordings | recording_url, transcription_text |
| `missed_calls` | Missed call tracking | callback_requested, callback_status |

### Appointments & Calendar
| Table | Purpose | Key columns |
|---|---|---|
| `appointments` | Bookings | status lifecycle, staff_assigned, external_calendar_event_id |
| `calendar_integrations` | Google/Microsoft OAuth | encrypted tokens, sync_enabled |
| `business_hours` | Weekly open/close times | day_of_week (0-6), open/close_time |
| `holiday_overrides` | Holiday closures | date, is_closed |

### AI
| Table | Purpose | Key columns |
|---|---|---|
| `ai_response_templates` | Customizable AI responses | trigger_type, language (en/es), voice_id |
| `ai_knowledge_base` | FAQ-style Q&A for AI | category, language |

### Follow-Ups
| Table | Purpose | Key columns |
|---|---|---|
| `follow_up_campaigns` | Automated outreach rules | trigger_event, delay, max_attempts |
| `follow_up_messages` | Individual sent messages | channel (sms/email/voice), status lifecycle |

### Billing
| Table | Purpose | Key columns |
|---|---|---|
| `subscription_plans` | Plan definitions (Starter/Growth/Scale) | Stripe price IDs, feature list |
| `subscriptions` | Active org subscriptions | Stripe IDs, period dates, trial |
| `usage_records` | Metered usage (AI minutes, SMS) | record_type, quantity |
| `stripe_events` | Webhook audit log | stripe_event_id (unique), payload |

## Enums

### user_role
`owner`, `admin`, `agent`, `viewer`

### conversation_type
`call`, `sms`, `web_chat`, `whatsapp`, `facebook`

### conversation_status
`active`, `ended`, `missed`, `voicemail`, `transferred`

### appointment_status
`scheduled`, `confirmed`, `cancelled`, `completed`, `no_show`, `rescheduled`

### trigger_type (AI templates)
`greeting`, `voicemail`, `appointment_booking`, `appointment_reminder`, `faq`, `fallback`, `after_hours`, `transfer`, `follow_up`

### subscription_status
`active`, `past_due`, `canceled`, `trialing`, `incomplete`, `incomplete_expired`, `unpaid`, `paused`

## Indexing Strategy

- **Tenant isolation indexes**: Every table has `(organization_id)` for fast tenant-scoped queries.
- **Uniqueness with org scope**: e.g., `(organization_id, email)` on users, `(organization_id, phone)` on contacts.
- **Status/temporal indexes**: For dashboards: `conversations(status)`, `appointments(start_time)`, `follow_up_messages(scheduled_for)`.
- **Lookup indexes**: `twilio_call_sid`, `stripe_customer_id`, `stripe_subscription_id`, `token`.

## Key Design Decisions

1. **UUIDs everywhere**: All primary keys use UUIDv4 for distributed safety and
   to avoid sequential ID enumeration across tenants.

2. **JSONB for flexible data**: Settings, metadata, tags, capabilities, features,
   and addons all use JSONB — avoids schema churn for rapidly evolving features.

3. **Soft relationships**: Several FKs use `ON DELETE SET NULL` (e.g., contact
   on conversations) so deleting a contact doesn't cascade-delete conversation
   history.

4. **Encrypted tokens**: Calendar OAuth tokens are stored encrypted
   (`access_token_encrypted`, `refresh_token_encrypted`) — encryption handled
   at the application layer.

5. **AI handling metrics**: `conversations.ai_handled` and
   `escalated_to_human` directly support the KPI of tracking the human
   escalation rate (<15% target).

6. **Bilingual support**: `locale` on orgs, `language` on AI templates and
   knowledge base — designed for English/Spanish from day one.

## Migration Workflow

```bash
# After editing schema files:
cd /home/team/shared/backend
bun run db:generate   # Creates migration files in db/migrations/
bun run db:migrate    # Applies migrations to DATABASE_URL
bun run db:seed       # Seeds starter data (plans, default templates)
```

## Next Steps

1. **Connect Neon**: The team lead needs to complete the Neon signup to
   provide `DATABASE_URL`. Once connected, run `db:generate` and `db:migrate`.

2. **Add RLS policies**: PostgreSQL Row-Level Security policies should be
   added in a migration to enforce `organization_id` filtering.

3. **API Layer**: Build TanStack Start server functions that query through
   the Drizzle client with organization scoping.

4. **Auth Integration**: Wire Better-Auth or NextAuth.js to the `users` table.
