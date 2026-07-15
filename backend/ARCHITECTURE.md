# ReceptionAI — System Architecture

> **Version:** 1.0 | **Last Updated:** 2026-07-15 | **Status:** Design Phase

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Multi-Tenant Design](#2-multi-tenant-design)
3. [API Design](#3-api-design)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Deployment Architecture](#5-deployment-architecture)
6. [Security Architecture](#6-security-architecture)

---

## 1. System Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Web Dashboard│  │ Web Chat     │  │ Mobile PWA   │  │ Public Website │  │
│  │ (React SPA)  │  │ Widget       │  │ (responsive) │  │ (landing page) │  │
│  │ /dashboard/* │  │ embeddable   │  │              │  │ /              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                 │                   │           │
└─────────┼─────────────────┼─────────────────┼───────────────────┼───────────┘
          │                 │                 │                   │
          │          ┌──────┴──────┐          │                   │
          │          │  Twilio     │◄─────────┘                   │
          │          │  Voice/SMS  │                              │
          │          │  Webhooks   │                              │
          │          └──────┬──────┘                              │
          │                 │                                     │
┌─────────┼─────────────────┼─────────────────────────────────────┼───────────┐
│         ▼                 ▼                                     ▼           │
│                          API LAYER                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              TanStack Start (Vite + React SSR)                        │  │
│  │              Port 3000 — Single Origin                                 │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │  │
│  │  │ Server      │  │ API Routes  │  │ Middleware   │  │ Auth Guard │  │  │
│  │  │ Functions   │  │ /api/*      │  │ Pipeline     │  │ Session    │  │  │
│  │  │ (RPC)       │  │ REST        │  │              │  │ Validation │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │  │
│  └─────────┼────────────────┼────────────────┼───────────────┼─────────┘  │
│            │                │                │               │            │
└────────────┼────────────────┼────────────────┼───────────────┼────────────┘
             │                │                │               │
┌────────────┼────────────────┼────────────────┼───────────────┼────────────┐
│            ▼                ▼                ▼               ▼            │
│                         SERVICE LAYER                                      │
│                                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ AI Voice │  │ Calendar │  │ Notify   │  │ Billing  │  │ Follow-Up  │  │
│  │ Engine   │  │ Sync     │  │ Service  │  │ Service  │  │ Scheduler  │  │
│  │          │  │          │  │          │  │          │  │            │  │
│  │ STT/TTS  │  │ Google/  │  │ Email    │  │ Stripe   │  │ Cron Jobs  │  │
│  │ NLU/NLP  │  │ MS Graph │  │ SMS Push │  │ Webhooks │  │ Retry Q    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │             │             │             │              │          │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┼──────────┘
        │             │             │             │              │
┌───────┼─────────────┼─────────────┼─────────────┼──────────────┼──────────┐
│       ▼             ▼             ▼             ▼              ▼          │
│                           DATA LAYER                                      │
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │ PostgreSQL   │  │ Redis/       │  │ File Storage │                    │
│  │ (Neon)       │  │ Upstash      │  │ (S3/R2)      │                    │
│  │              │  │              │  │              │                    │
│  │ Primary DB   │  │ Session      │  │ Recordings   │                    │
│  │ Migrations   │  │ Cache        │  │ Transcripts  │                    │
│  │ RLS Policies │  │ Rate Limits  │  │ Avatars      │                    │
│  │ 23 Tables    │  │ Job Queue    │  │ Attachments  │                    │
│  └──────────────┘  └──────────────┘  └──────────────┘                    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────┐
                    │     EXTERNAL SERVICES            │
                    │                                  │
                    │  Twilio  — Voice, SMS, WhatsApp  │
                    │  Stripe  — Payments, Subscriptions│
                    │  Google  — Calendar, OAuth       │
                    │  Microsoft — Calendar, OAuth     │
                    │  Resend  — Transactional Email   │
                    │  OpenAI  — LLM (GPT-4o)          │
                    │  Deepgram— STT/TTS               │
                    └──────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19 + Tailwind CSS 4 | Web dashboard, landing page, chat widget |
| **Framework** | TanStack Start | SSR, server functions, API routes, file-based routing |
| **API** | TanStack Server Functions + REST | RPC-style internal calls, REST for webhooks |
| **Database** | Neon (PostgreSQL 16) | Primary data store, 23 tables, RLS |
| **ORM** | Drizzle ORM | Type-safe queries, migrations, schema definitions |
| **Cache** | Upstash Redis | Session store, rate limiting, job queue |
| **Auth** | Better-Auth | Email/password, Google OAuth, magic links |
| **Voice/SMS** | Twilio | Inbound/outbound calls, SMS, WhatsApp, webhooks |
| **Payments** | Stripe | Subscriptions, invoicing, webhooks |
| **AI/LLM** | OpenAI GPT-4o | NLU, response generation, intent classification |
| **STT/TTS** | Deepgram / ElevenLabs | Speech-to-text, text-to-speech |
| **Email** | Resend | Transactional emails, notifications |
| **Hosting** | Vercel | Frontend + API serverless functions |
| **Storage** | Cloudflare R2 / S3 | Call recordings, transcripts, avatars |

### 1.3 Directory Structure

```
/home/team/shared/
├── site/                          # TanStack Start app (port 3000)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── __root.tsx         # Root layout (auth provider, shell)
│   │   │   ├── index.tsx          # Public landing page "/"
│   │   │   ├── dashboard/         # Protected dashboard routes
│   │   │   │   ├── index.tsx      # Dashboard home
│   │   │   │   ├── conversations.tsx
│   │   │   │   ├── contacts.tsx
│   │   │   │   ├── appointments.tsx
│   │   │   │   ├── settings.tsx
│   │   │   │   └── billing.tsx
│   │   │   ├── api/
│   │   │   │   ├── twilio/
│   │   │   │   │   └── webhook.ts # Twilio webhook handler
│   │   │   │   ├── stripe/
│   │   │   │   │   └── webhook.ts # Stripe webhook handler
│   │   │   │   └── auth/
│   │   │   │       └── [...all].ts# Better-Auth handler
│   │   │   ├── login.tsx
│   │   │   ├── signup.tsx
│   │   │   └── widget.tsx         # Embeddable chat widget
│   │   ├── components/            # Shared UI components
│   │   ├── lib/                   # Client utilities
│   │   └── styles/
│   ├── vite.config.ts
│   └── package.json
│
└── backend/                       # Backend library (imported by site)
    ├── db/
    │   ├── schema/                # Drizzle ORM schema files
    │   │   ├── organizations.ts
    │   │   ├── communications.ts
    │   │   ├── appointments.ts
    │   │   ├── ai.ts
    │   │   ├── follow-ups.ts
    │   │   ├── billing.ts
    │   │   └── index.ts
    │   ├── migrations/            # Auto-generated SQL migrations
    │   ├── index.ts               # DB client singleton
    │   └── seed.ts                # Seed data
    ├── services/                  # Business logic services
    │   ├── ai-engine.ts           # AI conversation orchestration
    │   ├── calendar-sync.ts       # Google/Microsoft calendar sync
    │   ├── notifications.ts       # Email, SMS, push notifications
    │   ├── billing-service.ts     # Stripe subscription management
    │   └── follow-up-scheduler.ts # Background job scheduling
    ├── lib/
    │   ├── auth.ts                # Better-Auth configuration
    │   ├── twilio.ts              # Twilio client wrapper
    │   ├── stripe.ts              # Stripe client wrapper
    │   └── encryption.ts          # Token encryption utilities
    ├── drizzle.config.ts
    ├── package.json
    └── tsconfig.json
```

---

## 2. Multi-Tenant Design

### 2.1 Tenant Isolation Strategy

ReceptionAI uses **shared database with Row-Level Security (RLS)**.

**Why shared DB + RLS (not schema-per-tenant):**
- Simpler migrations — one schema to manage
- Neon's connection pooling works best with few connections
- Easier cross-tenant analytics for platform admins
- Drizzle ORM supports RLS naturally

**Tenant ID propagation:**
```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────┐
│ Request │ ──► │ Auth Guard   │ ──► │ Context      │ ──► │ Query   │
│ (JWT)   │     │ extract org  │     │ set org_id   │     │ scoped  │
└─────────┘     └──────────────┘     └──────────────┘     └─────────┘
```

Every table includes `organization_id` as a non-null FK to `organizations`. All queries are scoped:

```typescript
// All queries include org scope — never query without it
const conversations = await db
  .select()
  .from(schema.conversations)
  .where(eq(schema.conversations.organizationId, currentOrgId));
```

**RLS Policies** (applied via migration):
```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON conversations
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id')::uuid);
```

### 2.2 Organization Onboarding Flow

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────────┐   ┌───────────┐
│ Visit    │    │ Create    │    │ Verify   │    │ Configure    │   │ Go Live   │
│ Landing  │───►│ Account   │───►│ Email    │───►│ Business     │──►│ Dashboard │
│ Page     │    │ & Org     │    │          │    │ Profile      │   │ Active    │
└──────────┘    └───────────┘    └──────────┘    └──────────────┘   └───────────┘
                                                       │
                                                       ▼
                                               ┌───────────────┐
                                               │ 1. Business   │
                                               │    hours      │
                                               │ 2. AI voice   │
                                               │    settings   │
                                               │ 3. Calendar   │
                                               │    connect    │
                                               │ 4. Phone #    │
                                               │    provision  │
                                               │ 5. Payment    │
                                               │    method     │
                                               └───────────────┘
```

**Step details:**
1. **Create Org** — `POST /api/orgs` creates `organizations` + `users` (owner role) rows
2. **Verify Email** — Magic link sent via Resend, confirms `email_verified_at`
3. **Configure Profile** — Business name, industry, timezone, locale (en/es)
4. **Set Business Hours** — `POST /api/business-hours` (7 rows, one per day)
5. **Connect Calendar** — OAuth flow for Google/Microsoft, stores encrypted tokens
6. **Provision Phone** — `POST /api/phone-numbers` triggers Twilio number purchase
7. **Add Payment** — Stripe Checkout session, creates `subscriptions` row
8. **Go Live** — AI receptionist starts answering calls immediately

### 2.3 Phone Number Provisioning

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Admin clicks │     │ Search       │     │ Purchase &   │
│ "Add Number" │────►│ Twilio API   │────►│ Configure    │
│              │     │ (area code)  │     │ Webhook URL  │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                    ┌────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────┐
│  1. POST /api/phone-numbers { area_code: "512" }    │
│  2. Backend calls Twilio API:                       │
│     - availablePhoneNumbers.search(areaCode)        │
│     - incomingPhoneNumbers.create(phoneNumber,      │
│         voiceUrl: "https://.../api/twilio/webhook", │
│         smsUrl: "https://.../api/twilio/webhook")   │
│  3. Insert into phone_numbers table                 │
│  4. Return phone number to dashboard                │
└─────────────────────────────────────────────────────┘
```

**Limits enforced by subscription tier:**
| Tier | Max Phone Lines |
|---|---|
| Starter | 1 |
| Growth | 2 |
| Scale | Unlimited |

---

## 3. API Design

### 3.1 API Architecture

ReceptionAI uses a hybrid API approach:

- **Server Functions** (`createServerFn`) — For internal dashboard calls. Type-safe RPC from React components directly to backend logic. No HTTP boilerplate.
- **API Routes** (`/api/*`) — For external webhooks (Twilio, Stripe) and public endpoints. Standard REST pattern.
- **Auth Middleware** — Injected via TanStack Start middleware that validates sessions and extracts `organization_id`.

```
┌────────────────────────────────────────────────────┐
│                  TanStack Start                     │
│                                                    │
│  Server Functions (RPC)         API Routes (REST)  │
│  ┌──────────────────────┐    ┌──────────────────┐  │
│  │ getOrganization()    │    │ POST /api/twilio/ │  │
│  │ listConversations()  │    │   webhook         │  │
│  │ createAppointment()  │    │ POST /api/stripe/ │  │
│  │ updateSettings()     │    │   webhook         │  │
│  │ ...                  │    │ GET /api/widget/  │  │
│  └──────────────────────┘    │   [orgSlug]       │  │
│                              └──────────────────┘  │
│  Auth: session cookie         Auth: webhook sig    │
│  Scoped: automatic org_id     Scoped: manual       │
└────────────────────────────────────────────────────┘
```

### 3.2 REST API Endpoints

#### Organizations

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/orgs` | Create organization (signup) | None |
| `GET` | `/api/orgs/:id` | Get org details | Session |
| `PATCH` | `/api/orgs/:id` | Update org profile | Session (owner/admin) |
| `GET` | `/api/orgs/:id/settings` | Get org settings | Session |
| `PATCH` | `/api/orgs/:id/settings` | Update org settings | Session (owner/admin) |

#### Users & Invitations

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/orgs/:id/users` | List users in org | Session |
| `POST` | `/api/orgs/:id/invitations` | Invite user to org | Session (owner/admin) |
| `POST` | `/api/invitations/:token/accept` | Accept invitation | None (token) |
| `PATCH` | `/api/users/:id` | Update user (role, etc.) | Session (owner/admin) |
| `DELETE` | `/api/users/:id` | Remove user from org | Session (owner/admin) |

#### Phone Numbers

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/orgs/:id/phone-numbers` | List phone numbers | Session |
| `POST` | `/api/orgs/:id/phone-numbers` | Provision new number | Session (owner/admin) |
| `PATCH` | `/api/phone-numbers/:id` | Update number config | Session (owner/admin) |
| `DELETE` | `/api/phone-numbers/:id` | Release number | Session (owner/admin) |

#### Conversations & Messages

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/orgs/:id/conversations` | List conversations (paginated) | Session |
| `GET` | `/api/conversations/:id` | Get conversation detail | Session |
| `GET` | `/api/conversations/:id/messages` | Get messages for conversation | Session |
| `POST` | `/api/conversations/:id/messages` | Send message (manual) | Session |
| `PATCH` | `/api/conversations/:id` | Update status/assignment | Session |

#### Contacts

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/orgs/:id/contacts` | List contacts (search, paginate) | Session |
| `POST` | `/api/orgs/:id/contacts` | Create contact | Session |
| `GET` | `/api/contacts/:id` | Get contact detail | Session |
| `PATCH` | `/api/contacts/:id` | Update contact | Session |
| `DELETE` | `/api/contacts/:id` | Delete contact | Session |

#### Appointments

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/orgs/:id/appointments` | List appointments (date range) | Session |
| `POST` | `/api/orgs/:id/appointments` | Create appointment | Session / AI |
| `GET` | `/api/appointments/:id` | Get appointment detail | Session |
| `PATCH` | `/api/appointments/:id` | Update appointment | Session |
| `DELETE` | `/api/appointments/:id` | Cancel appointment | Session |

#### AI Configuration

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/orgs/:id/ai-templates` | List AI response templates | Session |
| `POST` | `/api/orgs/:id/ai-templates` | Create custom template | Session (owner/admin) |
| `PATCH` | `/api/ai-templates/:id` | Update template | Session (owner/admin) |
| `DELETE` | `/api/ai-templates/:id` | Delete template | Session (owner/admin) |
| `GET` | `/api/orgs/:id/knowledge-base` | List knowledge base entries | Session |
| `POST` | `/api/orgs/:id/knowledge-base` | Add knowledge entry | Session (owner/admin) |

#### Billing

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/orgs/:id/subscription` | Get current subscription | Session (owner/admin) |
| `POST` | `/api/orgs/:id/billing/checkout` | Create Stripe Checkout | Session (owner/admin) |
| `POST` | `/api/orgs/:id/billing/portal` | Create Stripe Customer Portal | Session (owner/admin) |
| `GET` | `/api/orgs/:id/usage` | Get usage summary | Session (owner/admin) |

#### Webhooks (no session auth)

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/twilio/webhook` | Twilio voice/SMS events | Twilio signature |
| `POST` | `/api/twilio/status` | Twilio message status callbacks | Twilio signature |
| `POST` | `/api/stripe/webhook` | Stripe events | Stripe signature |

### 3.3 Authentication Middleware

```typescript
// Middleware chain for server functions
export const authenticatedFn = createServerFn()
  .middleware([validateSession])
  .middleware([extractOrganization])
  .middleware([checkRateLimit]);

// Session validation
async function validateSession() {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("Unauthorized");
  return { userId: session.user.id };
}

// Organization extraction
async function extractOrganization({ userId }) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    with: { organization: true },
  });
  if (!user) throw new Error("No organization found");
  return { organizationId: user.organizationId, role: user.role };
}
```

### 3.4 Rate Limiting

| Tier | Rate Limit | Window |
|---|---|---|
| API calls (all tiers) | 100 req/s per org | 1 second |
| AI calls (Starter) | 500 AI-minutes/month | monthly |
| AI calls (Growth) | 2,000 AI-minutes/month | monthly |
| AI calls (Scale) | 10,000+ AI-minutes/month | monthly |
| SMS outbound | 50/org/min | per minute |

---

## 4. Data Flow Diagrams

### 4.1 Inbound Call → Book Appointment Flow

```
Caller                    Twilio                   ReceptionAI API            AI Engine                Calendar          Database
  │                         │                           │                       │                       │                  │
  │  1. Dials number        │                           │                       │                       │                  │
  │────────────────────────►│                           │                       │                       │                  │
  │                         │  2. POST /api/twilio/     │                       │                       │                  │
  │                         │     webhook (voice)       │                       │                       │                  │
  │                         │──────────────────────────►│                       │                       │                  │
  │                         │                           │  3. Lookup org by     │                       │                  │
  │                         │                           │     phone number       │                       │                  │
  │                         │                           │───────────────────────────────────────────────────────────────────►│
  │                         │                           │◄───────────────────────────────────────────────────────────────────│
  │                         │                           │                       │                       │                  │
  │                         │                           │  4. Find/create        │                       │                  │
  │                         │                           │     contact by caller  │                       │                  │
  │                         │                           │───────────────────────────────────────────────────────────────────►│
  │                         │                           │◄───────────────────────────────────────────────────────────────────│
  │                         │                           │                       │                       │                  │
  │                         │                           │  5. Create conversation│                       │                  │
  │                         │                           │     (status: active)   │                       │                  │
  │                         │                           │───────────────────────────────────────────────────────────────────►│
  │                         │                           │                       │                       │                  │
  │                         │                           │  6. Start AI session   │                       │                  │
  │                         │                           │──────────────────────►│                       │                  │
  │                         │                           │                       │  7. Load greeting     │                  │
  │                         │                           │                       │     template           │                  │
  │                         │                           │                       │──────────────────────────────────────────►│
  │                         │                           │                       │◄──────────────────────────────────────────│
  │                         │                           │                       │                       │                  │
  │                         │  8. TwiML <Gather>        │                       │  9. TTS: greeting     │                  │
  │                         │◄──────────────────────────│◄──────────────────────│     "How can I help?" │                  │
  │  10. "I need to        │                           │                       │                       │                  │
  │      book an appt"     │                           │                       │                       │                  │
  │────────────────────────►│  11. Speech result       │                       │                       │                  │
  │                         │──────────────────────────►│──────────────────────►│                       │                  │
  │                         │                           │                       │  12. NLU: intent =    │                  │
  │                         │                           │                       │      appointment_book │                  │
  │                         │                           │                       │                       │                  │
  │                         │                           │                       │  13. Check calendar   │                  │
  │                         │                           │                       │     availability      │                  │
  │                         │                           │                       │──────────────────────────────────────────►│
  │                         │                           │                       │◄──────────────────────────────────────────│
  │                         │                           │                       │                       │                  │
  │  14. "Does Tuesday      │                           │                       │                       │                  │
  │      at 2pm work?"      │                           │                       │                       │                  │
  │◄────────────────────────│◄──────────────────────────│◄──────────────────────│                       │                  │
  │                         │                           │                       │                       │                  │
  │  15. "Yes"              │                           │                       │                       │                  │
  │────────────────────────►│──────────────────────────►│──────────────────────►│                       │                  │
  │                         │                           │                       │  16. Create           │                  │
  │                         │                           │                       │      appointment       │                  │
  │                         │                           │                       │──────────────────────────────────────────►│
  │                         │                           │                       │◄──────────────────────────────────────────│
  │                         │                           │                       │                       │                  │
  │                         │                           │                       │  17. Sync to Google   │                  │
  │                         │                           │                       │     Calendar (if       │                  │
  │                         │                           │                       │     integrated)        │                  │
  │                         │                           │                       │───────────────────────►│                  │
  │                         │                           │                       │◄───────────────────────│                  │
  │                         │                           │                       │                       │                  │
  │  18. Confirmation       │                           │                       │                       │                  │
  │      "Booked for Tues   │                           │                       │                       │                  │
  │       at 2pm"           │                           │                       │                       │                  │
  │◄────────────────────────│◄──────────────────────────│◄──────────────────────│                       │                  │
  │                         │                           │                       │                       │                  │
  │  19. Hang up            │                           │                       │                       │                  │
  │────────────────────────►│  20. Status callback      │                       │                       │                  │
  │                         │──────────────────────────►│                       │                       │                  │
  │                         │                           │  21. Update            │                       │                  │
  │                         │                           │      conversation      │                       │                  │
  │                         │                           │      status: ended      │                       │                  │
  │                         │                           │───────────────────────────────────────────────────────────────────►│
  │                         │                           │                       │                       │                  │
  │                         │                           │  22. Queue follow-up   │                       │                  │
  │                         │                           │     confirmation SMS   │                       │                  │
  │                         │                           │───────────────────────────────────────────────────────────────────►│
```

### 4.2 SMS Conversation Flow

```
Customer                 Twilio                  ReceptionAI API           AI Engine              Database
  │                        │                          │                       │                      │
  │  1. Send SMS           │                          │                       │                      │
  │  "Do you fix ACs?"     │                          │                       │                      │
  │───────────────────────►│  2. POST /api/twilio/    │                       │                      │
  │                        │     webhook (sms)        │                       │                      │
  │                        │─────────────────────────►│                       │                      │
  │                        │                          │  3. Find org by       │                      │
  │                        │                          │     phone number       │                      │
  │                        │                          │──────────────────────────────────────────────►│
  │                        │                          │◄──────────────────────────────────────────────│
  │                        │                          │                       │                      │
  │                        │                          │  4. Find/create        │                      │
  │                        │                          │     contact            │                      │
  │                        │                          │──────────────────────────────────────────────►│
  │                        │                          │◄──────────────────────────────────────────────│
  │                        │                          │                       │                      │
  │                        │                          │  5. Find/create        │                      │
  │                        │                          │     conversation       │                      │
  │                        │                          │     (type: sms)        │                      │
  │                        │                          │──────────────────────────────────────────────►│
  │                        │                          │                       │                      │
  │                        │                          │  6. Insert message     │                      │
  │                        │                          │     (role: user)       │                      │
  │                        │                          │──────────────────────────────────────────────►│
  │                        │                          │                       │                      │
  │                        │                          │  7. Generate AI reply  │                      │
  │                        │                          │──────────────────────►│                      │
  │                        │                          │                       │  8. NLU + load KB    │
  │                        │                          │                       │─────────────────────►│
  │                        │                          │                       │◄─────────────────────│
  │                        │                          │                       │                      │
  │                        │                          │  9. AI reply text      │                      │
  │                        │                          │◄──────────────────────│                      │
  │                        │                          │                       │                      │
  │                        │                          │  10. Insert message    │                      │
  │                        │                          │      (role: asst)      │                      │
  │                        │                          │──────────────────────────────────────────────►│
  │                        │                          │                       │                      │
  │                        │  11. Twilio send SMS     │                       │                      │
  │                        │◄─────────────────────────│                       │                      │
  │                        │                          │                       │                      │
  │  12. "Yes, we do!      │                          │                       │                      │
  │   When do you need     │                          │                       │                      │
  │   service?"            │                          │                       │                      │
  │◄───────────────────────│                          │                       │                      │
  │                        │                          │                       │                      │
  │  (continues...)        │                          │                       │                      │
```

### 4.3 Web Chat Flow

```
Website Visitor          Chat Widget            ReceptionAI API          AI Engine            Database
      │                      │                        │                     │                    │
      │  1. Load page        │                        │                     │                    │
      │  with widget         │                        │                     │                    │
      │─────────────────────►│  2. GET /api/widget/   │                     │                    │
      │                      │     [orgSlug]          │                     │                    │
      │                      │───────────────────────►│                     │                    │
      │                      │                        │  3. Lookup org      │                    │
      │                      │                        │     by slug          │                    │
      │                      │                        │────────────────────────────────────────►│
      │                      │                        │◄────────────────────────────────────────│
      │                      │                        │                     │                    │
      │                      │  4. Widget config      │                     │                    │
      │                      │  (colors, greeting,    │                     │                    │
      │                      │   business hours)      │                     │                    │
      │                      │◄───────────────────────│                     │                    │
      │                      │                        │                     │                    │
      │  5. "Hi, I need      │                        │                     │                    │
      │      a quote"        │                        │                     │                    │
      │─────────────────────►│  6. POST /api/widget/  │                     │                    │
      │                      │     [orgSlug]/message  │                     │                    │
      │                      │───────────────────────►│                     │                    │
      │                      │                        │  7. Create contact   │                    │
      │                      │                        │     + conversation   │                    │
      │                      │                        │────────────────────────────────────────►│
      │                      │                        │                     │                    │
      │                      │                        │  8. AI response      │                    │
      │                      │                        │────────────────────►│                    │
      │                      │                        │◄────────────────────│                    │
      │                      │                        │                     │                    │
      │                      │  9. Server-Sent Events │                     │                    │
      │                      │     (stream response)  │                     │                    │
      │                      │◄───────────────────────│                     │                    │
      │                      │                        │                     │                    │
      │  10. "Sure! What     │                        │                     │                    │
      │       service?"      │                        │                     │                    │
      │◄─────────────────────│                        │                     │                    │
```

### 4.4 Calendar Sync Flow

```
Admin User           Dashboard           ReceptionAI API        Calendar Service       Google/MS          Database
    │                     │                     │                      │                    │               │
    │  1. Click           │                     │                      │                    │               │
    │  "Connect Calendar" │                     │                      │                    │               │
    │────────────────────►│  2. GET /api/      │                      │                    │               │
    │                     │     calendar/       │                      │                    │               │
    │                     │     connect/google  │                      │                    │               │
    │                     │────────────────────►│                      │                    │               │
    │                     │                     │  3. Generate OAuth   │                    │               │
    │                     │                     │     state + redirect │                    │               │
    │                     │  4. Redirect to     │─────────────────────►│                    │               │
    │                     │     Google OAuth    │                      │                    │               │
    │                     │◄────────────────────│                      │                    │               │
    │                     │                     │                      │                    │               │
    │  5. Google consent  │                     │                      │                    │               │
    │─────────────────────────────────────────────────────────────────►│                    │               │
    │◄─────────────────────────────────────────────────────────────────│                    │               │
    │                     │                     │                      │                    │               │
    │  6. OAuth callback  │                     │                      │                    │               │
    │  ?code=abc123       │                     │                      │                    │               │
    │────────────────────►│  7. GET /api/       │                      │                    │               │
    │                     │     calendar/callback│                      │                    │               │
    │                     │────────────────────►│                      │                    │               │
    │                     │                     │  8. Exchange code    │                    │               │
    │                     │                     │     for tokens       │                    │               │
    │                     │                     │─────────────────────►│                    │               │
    │                     │                     │◄─────────────────────│                    │               │
    │                     │                     │                      │                    │               │
    │                     │                     │  9. Encrypt tokens   │                    │               │
    │                     │                     │     Store in DB      │                    │               │
    │                     │                     │──────────────────────────────────────────────────────────►│
    │                     │                     │                      │                    │               │
    │                     │                     │  10. Initial sync    │                    │               │
    │                     │                     │─────────────────────►│                    │               │
    │                     │                     │                      │  11. Fetch events  │               │
    │                     │                     │                      │───────────────────►│               │
    │                     │                     │                      │◄───────────────────│               │
    │                     │                     │                      │                    │               │
    │                     │                     │                      │  12. Import events │               │
    │                     │                     │                      │     as appointments│               │
    │                     │                     │                      │──────────────────────────────────────►│
    │                     │                     │                      │                    │               │
    │                     │  13. "Calendar      │                      │                    │               │
    │                     │       connected!"   │                      │                    │               │
    │                     │◄────────────────────│                      │                    │               │
    │◄────────────────────│                     │                      │                    │               │
```

### 4.5 Billing/Subscription Flow

```
Admin User           Dashboard          ReceptionAI API       Stripe              Database
    │                    │                     │                  │                   │
    │  1. Click          │                     │                  │                   │
    │  "Upgrade Plan"    │                     │                  │                   │
    │───────────────────►│  2. POST /api/      │                  │                   │
    │                    │     billing/checkout│                  │                   │
    │                    │────────────────────►│                  │                   │
    │                    │                     │  3. Create       │                   │
    │                    │                     │     Checkout      │                   │
    │                    │                     │     Session       │                   │
    │                    │                     │─────────────────►│                   │
    │                    │                     │◄─────────────────│                   │
    │                    │  4. Checkout URL    │                  │                   │
    │                    │◄────────────────────│                  │                   │
    │                    │                     │                  │                   │
    │  5. Redirect to    │                     │                  │                   │
    │     Stripe Checkout│                     │                  │                   │
    │───────────────────────────────────────────────────────────►│                   │
    │                    │                     │                  │                   │
    │  6. Complete       │                     │                  │                   │
    │     payment        │                     │                  │                   │
    │◄───────────────────────────────────────────────────────────│                   │
    │                    │                     │                  │                   │
    │  7. Return to      │                     │                  │                   │
    │     dashboard      │                     │                  │                   │
    │───────────────────►│                     │                  │                   │
    │                    │                     │                  │                   │
    │                    │                     │  8. Stripe       │                   │
    │                    │                     │     webhook       │                   │
    │                    │                     │     checkout.     │                   │
    │                    │                     │     session.      │                   │
    │                    │                     │     completed     │                   │
    │                    │                     │◄─────────────────│                   │
    │                    │                     │                  │                   │
    │                    │                     │  9. Create/update│                   │
    │                    │                     │     subscription  │                   │
    │                    │                     │──────────────────────────────────────────►│
    │                    │                     │                  │                   │
    │                    │                     │  10. Update org  │                   │
    │                    │                     │      status       │                   │
    │                    │                     │──────────────────────────────────────────►│
    │                    │                     │                  │                   │
    │                    │  11. "Subscription  │                  │                   │
    │                    │       active!"      │                  │                   │
    │                    │◄────────────────────│                  │                   │
    │◄───────────────────│                     │                  │                   │
```

---

## 5. Deployment Architecture

### 5.1 Infrastructure Diagram

```
                          ┌──────────────────────┐
                          │     Cloudflare DNS   │
                          │  receptionai.com     │
                          └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │       Vercel         │
                          │                      │
                          │  ┌────────────────┐  │
                          │  │ Edge Functions │  │
                          │  │ (Middleware)   │  │
                          │  └───────┬────────┘  │
                          │          │           │
                          │  ┌───────▼────────┐  │
                          │  │ Serverless     │  │
                          │  │ Functions      │  │
                          │  │ (Node.js 22)   │  │
                          │  │ TanStack Start │  │
                          │  └───────┬────────┘  │
                          └──────────┼───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │  Neon           │  │  Upstash Redis  │  │  Twilio         │
    │  PostgreSQL     │  │                 │  │  Voice/SMS      │
    │                 │  │  Session Store  │  │  WhatsApp       │
    │  Primary DB     │  │  Cache Layer    │  │  Webhooks       │
    │  RLS Policies   │  │  Rate Limiter   │  │                 │
    └─────────────────┘  └─────────────────┘  └─────────────────┘

    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │  Stripe         │  │  Cloudflare R2  │  │  Resend         │
    │  Payments       │  │  File Storage   │  │  Email          │
    │  Subscriptions  │  │  Recordings     │  │  Notifications  │
    │  Webhooks       │  │  Transcripts    │  │                 │
    └─────────────────┘  └─────────────────┘  └─────────────────┘

    ┌─────────────────┐  ┌─────────────────┐
    │  OpenAI API     │  │  Deepgram API   │
    │  GPT-4o         │  │  STT / TTS      │
    │  Intent + Gen   │  │  Real-time      │
    └─────────────────┘  └─────────────────┘
```

### 5.2 Vercel Deployment

The site is deployed to Vercel using `bun run go-live`:

```
┌─────────────────────────────────────────────────────┐
│                  Deployment Flow                     │
│                                                     │
│  1. Build: vite build (SSR bundle)                  │
│  2. Bundle: .vercel/output (Node function)          │
│  3. Deploy: vercel deploy --prod                    │
│  4. URL: https://receptionai.vercel.app             │
│                                                     │
│  Environment Variables:                             │
│  - DATABASE_URL          (Neon Postgres)            │
│  - TWILIO_ACCOUNT_SID    (Twilio)                   │
│  - TWILIO_AUTH_TOKEN     (Twilio)                   │
│  - STRIPE_SECRET_KEY     (Stripe)                   │
│  - STRIPE_WEBHOOK_SECRET (Stripe)                   │
│  - BETTER_AUTH_SECRET    (Auth)                     │
│  - GOOGLE_CLIENT_ID      (Google OAuth)             │
│  - GOOGLE_CLIENT_SECRET  (Google OAuth)             │
│  - OPENAI_API_KEY        (OpenAI)                   │
│  - DEEPGRAM_API_KEY      (Deepgram)                 │
│  - RESEND_API_KEY        (Resend)                   │
│  - UPSTASH_REDIS_URL     (Upstash Redis)            │
└─────────────────────────────────────────────────────┘
```

### 5.3 Background Jobs

For recurring tasks (follow-up reminders, appointment notifications), ReceptionAI uses a lightweight approach:

```
┌─────────────────────────────────────────────────────┐
│              Background Job Strategy                 │
│                                                     │
│  Approach: Vercel Cron Jobs + Upstash QStash        │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Vercel Cron (every 1 min)                  │    │
│  │  GET /api/cron/process-follow-ups           │    │
│  │  → Queries follow_up_messages WHERE         │    │
│  │    scheduled_for <= NOW() AND status=pending│    │
│  │  → Sends via Twilio/Resend                 │    │
│  │  → Updates status                           │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Upstash QStash (delayed messages)          │    │
│  │  → Schedule: POST /api/cron/send-reminder   │    │
│  │  → Exactly-once delivery                    │    │
│  │  → Automatic retry with backoff             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Jobs:                                              │
│  - Follow-up messages (every 1 min)                 │
│  - Appointment reminders (24h, 1h before)           │
│  - Missed call callbacks (15 min after)             │
│  - Calendar sync (every 15 min)                     │
│  - Usage aggregation (hourly)                       │
│  - Subscription renewal checks (daily)              │
└─────────────────────────────────────────────────────┘
```

---

## 6. Security Architecture

### 6.1 Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  1. TRANSPORT SECURITY                           │   │
│  │     - TLS 1.3 everywhere (enforced)              │   │
│  │     - HSTS with 1-year max-age                   │   │
│  │     - HTTP → HTTPS redirect                      │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌─────────────────────▼───────────────────────────┐   │
│  │  2. AUTHENTICATION                               │   │
│  │     - Better-Auth (session-based + OAuth)        │   │
│  │     - Session cookies: httpOnly, secure, sameSite │   │
│  │     - Magic link email verification              │   │
│  │     - Password hashing: bcrypt (cost 12)         │   │
│  │     - MFA support (TOTP) for admin accounts      │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌─────────────────────▼───────────────────────────┐   │
│  │  3. AUTHORIZATION                                │   │
│  │     - Role-based access (owner/admin/agent/view) │   │
│  │     - Tenant isolation via RLS + org_id scoping  │   │
│  │     - API route guards per role                  │   │
│  │     - Webhook signature verification             │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌─────────────────────▼───────────────────────────┐   │
│  │  4. DATA PROTECTION                              │   │
│  │     - Encryption at rest (Neon, R2 default)      │   │
│  │     - Application-layer encryption for OAuth     │   │
│  │       tokens (AES-256-GCM)                       │   │
│  │     - PII masking in logs                        │   │
│  │     - Recording retention policies by tier       │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌─────────────────────▼───────────────────────────┐   │
│  │  5. NETWORK SECURITY                             │   │
│  │     - Rate limiting (100 req/s/org)              │   │
│  │     - IP allowlisting for webhooks (Twilio)      │   │
│  │     - CORS restricted to known origins           │   │
│  │     - CSP headers (Content-Security-Policy)      │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌─────────────────────▼───────────────────────────┐   │
│  │  6. AUDIT & COMPLIANCE                           │   │
│  │     - Audit log for all mutations                │   │
│  │     - Stripe events logged (stripe_events table) │   │
│  │     - Failed auth attempts logged                │   │
│  │     - SOC 2 readiness (design phase)             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Tenant Data Isolation

```
┌──────────────────────────────────────────────────────────┐
│              TENANT ISOLATION ENFORCEMENT                 │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Application Layer                               │    │
│  │  ┌───────────────────────────────────────────┐  │    │
│  │  │  Middleware extracts org_id from session   │  │    │
│  │  │  Every DB query includes:                  │  │    │
│  │  │    WHERE organization_id = $currentOrgId   │  │    │
│  │  │  No "super admin" bypass in query layer    │  │    │
│  │  └───────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│  ┌─────────────────────▼───────────────────────────┐    │
│  │  Database Layer                                  │    │
│  │  ┌───────────────────────────────────────────┐  │    │
│  │  │  Row-Level Security (RLS) enforced:        │  │    │
│  │  │    ALTER TABLE conversations               │  │    │
│  │  │    ENABLE ROW LEVEL SECURITY;              │  │    │
│  │  │    CREATE POLICY org_isolation             │  │    │
│  │  │    USING (organization_id =                │  │    │
│  │  │      current_setting('app.current_org_id') │  │    │
│  │  │      ::uuid);                              │  │    │
│  │  │                                            │  │    │
│  │  │  app.current_org_id set per-request        │  │    │
│  │  │  via SET LOCAL in transaction              │  │    │
│  │  └───────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 6.3 Webhook Security

```
┌──────────────────────────────────────────────────────────┐
│                WEBHOOK VERIFICATION                       │
│                                                          │
│  Twilio Webhooks:                                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │  1. Validate X-Twilio-Signature header           │    │
│  │  2. Compute HMAC-SHA1 of URL + params            │    │
│  │  3. Compare against signature                    │    │
│  │  4. Reject if mismatch → 403                     │    │
│  │  5. Validate request timestamp (tolerance: 5min) │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Stripe Webhooks:                                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │  1. Validate stripe-signature header             │    │
│  │  2. Construct signed payload from raw body       │    │
│  │  3. Verify with webhook signing secret           │    │
│  │  4. Check for duplicate event IDs                │    │
│  │  5. Store in stripe_events audit table           │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 6.4 Encryption Strategy

| Data | Method | Key Management |
|---|---|---|
| Passwords | bcrypt (cost 12) | Per-user salt |
| Calendar OAuth tokens | AES-256-GCM | Application key (env var) |
| Session tokens | Better-Auth managed | Rotated automatically |
| PII in transit | TLS 1.3 | Cloudflare/Vercel edge |
| Database at rest | Neon automatic encryption | Neon managed |
| Recordings at rest | R2 SSE | Cloudflare managed |
| API keys in code | Environment variables | Vercel env encryption |

### 6.5 Audit Logging

```
┌──────────────────────────────────────────────────────────┐
│                   AUDIT LOG SCHEMA                        │
│                                                          │
│  audit_logs table:                                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  id              UUID PRIMARY KEY                │    │
│  │  organization_id UUID (nullable — system events) │    │
│  │  user_id         UUID (nullable — system)        │    │
│  │  action          VARCHAR (create/update/delete/   │    │
│  │                    login/logout/export)           │    │
│  │  resource_type   VARCHAR (appointment/conversation│    │
│  │                    /user/setting)                 │    │
│  │  resource_id     UUID                            │    │
│  │  changes         JSONB (old/new diff)            │    │
│  │  ip_address      VARCHAR                         │    │
│  │  user_agent      VARCHAR                         │    │
│  │  created_at      TIMESTAMPTZ                     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Events logged:                                          │
│  - User login/logout                                     │
│  - User invitation sent/accepted                         │
│  - Organization settings changed                         │
│  - Phone number provisioned/released                     │
│  - Subscription created/updated/cancelled                │
│  - AI template created/updated/deleted                   │
│  - Calendar integration connected/disconnected           │
└──────────────────────────────────────────────────────────┘
```

---

## Appendix A: Environment Variables

| Variable | Service | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Neon | Yes | PostgreSQL connection string |
| `TWILIO_ACCOUNT_SID` | Twilio | Yes | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio | Yes | Twilio API authentication |
| `TWILIO_API_KEY` | Twilio | No | Alternative to auth token |
| `TWILIO_API_SECRET` | Twilio | No | Companion to API key |
| `STRIPE_SECRET_KEY` | Stripe | Yes | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Yes | Webhook signature verification |
| `BETTER_AUTH_SECRET` | Better-Auth | Yes | Session encryption key |
| `BETTER_AUTH_URL` | Better-Auth | Yes | Auth base URL |
| `GOOGLE_CLIENT_ID` | Google | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google | Yes | Google OAuth secret |
| `MICROSOFT_CLIENT_ID` | Microsoft | No | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft | No | Microsoft OAuth secret |
| `OPENAI_API_KEY` | OpenAI | Yes | GPT-4o API key |
| `DEEPGRAM_API_KEY` | Deepgram | Yes | STT/TTS API key |
| `RESEND_API_KEY` | Resend | Yes | Transactional email API |
| `UPSTASH_REDIS_URL` | Upstash | No | Redis connection for cache/sessions |
| `ENCRYPTION_KEY` | Internal | Yes | AES-256 key for OAuth token encryption |
| `VERCEL_TOKEN` | Vercel | Yes | Deployment token |

## Appendix B: Key Design Decisions

1. **Single Origin (port 3000)** — The entire app (frontend, API, server functions) runs from a single TanStack Start origin. Simplifies CORS, cookies, and deployment.

2. **Hybrid API (RPC + REST)** — Server functions for internal dashboard calls (type-safe, no HTTP boilerplate). REST routes for external webhooks (Twilio, Stripe) that need standard HTTP semantics.

3. **Shared DB + RLS** — One Neon database with Row-Level Security. Simpler than schema-per-tenant, works well with Neon's connection pooling, and Drizzle ORM supports both migration management and RLS.

4. **Background Jobs via Cron** — Vercel Cron Jobs + Upstash QStash for delayed/retry-able tasks. No separate worker tier needed. QStash provides exactly-once delivery semantics.

5. **AI Engine as Service Module** — The AI voice/conversation logic is a service module within the TanStack app, not a separate microservice. Simplifies deployment while still being independently testable.

6. **Encryption at Application Layer** — OAuth tokens encrypted with AES-256-GCM before storage. Adds defense-in-depth beyond database-level encryption.

7. **Bilingual from Day One** — `locale` on orgs, `language` on AI templates and knowledge base. Designed for English/Spanish from the start, architecture supports additional languages.
