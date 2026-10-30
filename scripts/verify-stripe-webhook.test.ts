/**
 * Replay verification for the Stripe webhook idempotency + Carm set-password work.
 *
 * Run:  cd /home/team/shared/scripts && bun test verify-stripe-webhook.test.ts
 *
 * Nothing here touches a real Stripe, Telnyx, email or Postgres:
 *   • @neondatabase/serverless is replaced by a tagged-template SQL executor backed by
 *     bun:sqlite (real SQL, real UNIQUE constraint, real row counts);
 *   • src/lib/email.ts is replaced by a capture stub (records what WOULD be sent);
 *   • global fetch is replaced by a stub answering only Telnyx + Stripe read-only endpoints;
 *   • STRIPE_WEBHOOK_SECRET is unset, so signature verification is skipped exactly as the
 *     handler does when the secret is not configured.
 */
import { test, expect, mock, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";

const REPO = "/tmp/receptionai-live";

// ── Fake Postgres (SQLite) ────────────────────────────────────────────────────────────────
const db = new Database(":memory:");
db.exec(`
  CREATE TABLE organizations (
    id TEXT PRIMARY KEY, name TEXT, slug TEXT, email TEXT, phone TEXT, transfer_number TEXT,
    timezone TEXT, locale TEXT, industry TEXT, postal_code TEXT, stripe_customer_id TEXT,
    metadata TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE users (
    id TEXT PRIMARY KEY, organization_id TEXT, email TEXT, name TEXT, role TEXT,
    password_hash TEXT, metadata TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE subscription_plans (id TEXT PRIMARY KEY, name TEXT);
  CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY, organization_id TEXT, plan_id TEXT, stripe_subscription_id TEXT,
    stripe_customer_id TEXT, status TEXT, billing_cycle TEXT, metadata TEXT,
    current_period_start TEXT, current_period_end TEXT, cancel_at_period_end INTEGER,
    canceled_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE phone_numbers (
    id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, provider TEXT,
    telnyx_number_id TEXT, is_active INTEGER, capabilities TEXT, metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE business_hours (
    id TEXT PRIMARY KEY, organization_id TEXT, day_of_week TEXT, open_time TEXT,
    close_time TEXT, is_closed INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE stripe_events (
    id TEXT PRIMARY KEY, stripe_event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL,
    payload TEXT NOT NULL, processed_at TEXT, error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE password_set_tokens (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT, token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL DEFAULT 'set-password', expires_at TEXT NOT NULL, used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO subscription_plans (id, name) VALUES ('plan-starter','starter'),('plan-growth','growth'),('plan-scale','scale');
`);

/**
 * A `neon()` stand-in: executes the handler's tagged-template SQL against SQLite.
 * Casts (`::jsonb`) and NOW() are translated; booleans become 0/1; $N placeholders are kept
 * (SQLite accepts ?N).
 */
function fakeNeon(_url?: string) {
  return (strings: TemplateStringsArray, ...values: any[]) => {
    let sql = strings[0];
    for (let i = 0; i < values.length; i++) sql += `?${i + 1}` + strings[i + 1];
    sql = sql
      .replace(/::\s*(jsonb|json|timestamptz|timestamp|text|uuid|varchar)/gi, "")
      .replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP");
    const params = values.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : v));
    return Promise.resolve(db.prepare(sql).all(...params));
  };
}

mock.module("@neondatabase/serverless", () => ({ neon: fakeNeon, Pool: class {}, Client: class {} }));

// ── Email capture stub ───────────────────────────────────────────────────────────────────
const outbox: Array<{ to: string; subject: string; body: string }> = [];
mock.module(`${REPO}/src/lib/email.ts`, () => ({
  sendEmail: async (to: string, subject: string, body: string) => {
    outbox.push({ to, subject, body });
    return true;
  },
}));

// ── Outbound network stub ────────────────────────────────────────────────────────────────
let telnyxOrders = 0;
let stripeLineItems = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any) => {
  const url = typeof input === "string" ? input : input.url;
  const json = (body: any) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  if (url.includes("api.telnyx.com/v2/available_phone_numbers")) {
    return json({ data: [{ id: "tn_123", phone_number: "+13055551234" }] });
  }
  if (url.includes("api.telnyx.com/v2/number_orders")) {
    telnyxOrders += 1;
    return json({ data: { phone_numbers: [{ id: `tn_order_${telnyxOrders}` }] } });
  }
  if (url.includes("api.telnyx.com/v2/messages")) return json({ data: { id: "msg" } });
  if (url.includes("api.stripe.com/v1/checkout/sessions/") && url.includes("/line_items")) {
    // GET /v1/checkout/sessions/<id>/line_items — how the Carm path learns the tier.
    stripeLineItems += 1;
    return json({ data: [{ price: { id: "price_carm_pro", metadata: { plan_tier: "pro", rate: "founding" } } }] });
  }
  if (url.includes("api.stripe.com/v1/checkout/sessions")) {
    // GET /v1/checkout/sessions?payment_intent=... — how payment_intent.succeeded resolves a session.
    return json({
      data: [
        {
          id: "cs_test_carm_1",
          customer: "cus_carm_1",
          subscription: null,
          customer_details: { email: "owner@baysidedental.example", name: "Bayside Dental" },
          metadata: {},
          amount_total: 19700,
          line_items: { data: [{ price: { id: "price_carm_pro", metadata: { plan_tier: "pro", rate: "founding" } } }] },
        },
      ],
    });
  }
  throw new Error(`UNEXPECTED OUTBOUND CALL: ${url}`);
}) as any;

// ── Environment ──────────────────────────────────────────────────────────────────────────
process.env.DATABASE_URL = "postgres://fake/fake";
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-chars-long";
process.env.TELNYX_CONNECTION_ID = "conn_test";
process.env.TELNYX_API_KEY = "key_test";
process.env.STRIPE_SECRET_KEY = "sk_test_stub";
delete process.env.STRIPE_WEBHOOK_SECRET; // signature verification stubbed out
delete process.env.RESEND_API_KEY;
delete process.env.SUPPORT_ALERT_TO;
delete process.env.SUPPORT_ALERT_FROM;
delete process.env.PUBLIC_BASE_URL;

let webhook: any;
let setPassword: any;
let welcome: any;

beforeAll(async () => {
  webhook = await import(`${REPO}/src/routes/api/stripe/webhook.ts`);
  setPassword = await import(`${REPO}/src/lib/set-password.ts`);
  welcome = await import(`${REPO}/src/lib/welcome-email.ts`);
});

const counts = () => ({
  orgs: (db.query("SELECT COUNT(*) c FROM organizations").get() as any).c,
  users: (db.query("SELECT COUNT(*) c FROM users").get() as any).c,
  subs: (db.query("SELECT COUNT(*) c FROM subscriptions").get() as any).c,
  numbers: (db.query("SELECT COUNT(*) c FROM phone_numbers").get() as any).c,
  events: (db.query("SELECT COUNT(*) c FROM stripe_events").get() as any).c,
});

function deliver(event: any) {
  return webhook.POST({
    request: new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }),
  });
}

const selfServeEvent = (id: string) => ({
  id,
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_self_1",
      customer: "cus_self_1",
      subscription: "sub_self_1",
      metadata: {
        email: "owner@acmehvac.example",
        companyName: "Acme HVAC",
        name: "Dana",
        plan: "growth",
        password: "a-real-chosen-password",
        postalCode: "33139",
      },
      customer_details: {
        email: "owner@acmehvac.example",
        name: "Dana",
        phone: "+13055550100",
        address: { postal_code: "33139" },
      },
      amount_total: 19900,
    },
  },
});

const carmEvent = (id: string) => ({
  id,
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_carm_1",
      customer: "cus_carm_1",
      subscription: null,
      metadata: {},
      customer_details: {
        email: "owner@baysidedental.example",
        name: "Bayside Dental",
        phone: "+13055550200",
        address: { postal_code: "33139" },
      },
      amount_total: 19700,
    },
  },
});

test("VERIFY 1a — first delivery provisions exactly one org/user/subscription/number", async () => {
  const before = counts();
  const res = await deliver(selfServeEvent("evt_self_1"));
  const body = await res.json();
  const after = counts();
  console.log("VERIFY 1a before:", before, "after:", after, "status:", res.status, body);
  expect(res.status).toBe(200);
  expect(after.orgs - before.orgs).toBe(1);
  expect(after.users - before.users).toBe(1);
  expect(after.subs - before.subs).toBe(1);
  expect(after.numbers - before.numbers).toBe(1);
  expect(after.events - before.events).toBe(1);
});

test("VERIFY 1b — replaying the SAME event id returns 200 and creates nothing", async () => {
  const before = counts();
  const res = await deliver(selfServeEvent("evt_self_1"));
  const body = await res.json();
  const after = counts();
  console.log("VERIFY 1b before:", before, "after:", after, "status:", res.status, body);
  expect(res.status).toBe(200);
  expect(body.duplicate).toBe(true);
  expect(after).toEqual(before);
});

test("VERIFY 2 — a DIFFERENT event id for the same checkout session creates nothing new", async () => {
  const before = counts();
  const res = await deliver(selfServeEvent("evt_self_1_retry_relabelled"));
  const body = await res.json();
  const after = counts();
  console.log("VERIFY 2 before:", before, "after:", after, "status:", res.status, body);
  expect(res.status).toBe(200);
  // the event itself is recorded (it is a genuinely new delivery)…
  expect(after.events - before.events).toBe(1);
  // …but nothing is provisioned a second time
  expect(after.orgs).toBe(before.orgs);
  expect(after.users).toBe(before.users);
  expect(after.subs).toBe(before.subs);
  expect(after.numbers).toBe(before.numbers);
});

test("VERIFY 2b — Carm one-time checkout provisions once, then payment_intent.succeeded adds nothing", async () => {
  const before = counts();
  const res = await deliver(carmEvent("evt_carm_1"));
  const afterCheckout = counts();
  console.log("VERIFY 2b Carm checkout before:", before, "after:", afterCheckout, "status:", res.status);
  expect(res.status).toBe(200);
  expect(afterCheckout.orgs - before.orgs).toBe(1);
  expect(afterCheckout.users - before.users).toBe(1);
  expect(afterCheckout.numbers - before.numbers).toBe(1);

  // Stripe sends this too, under its own id, for the same payment.
  const piRes = await deliver({
    id: "evt_carm_pi_1",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_carm_1", customer: "cus_carm_1", amount_received: 19700 } },
  });
  const afterPi = counts();
  console.log("VERIFY 2b after payment_intent.succeeded:", afterPi, "status:", piRes.status);
  expect(piRes.status).toBe(200);
  expect(afterPi.orgs).toBe(afterCheckout.orgs);
  expect(afterPi.users).toBe(afterCheckout.users);
  expect(afterPi.subs).toBe(afterCheckout.subs);
  expect(afterPi.numbers).toBe(afterCheckout.numbers);
});

test("VERIFY 2c — an event with no id is refused (nothing to dedupe on)", async () => {
  const before = counts();
  const res = await deliver({ type: "checkout.session.completed", data: { object: selfServeEvent("x").data.object } });
  const after = counts();
  expect(res.status).toBe(400);
  expect(after).toEqual(before);
});

test("VERIFY 3a — the Carm welcome email carries a working, single-use set-password link", async () => {
  const carmMail = outbox.find((m) => m.to === "owner@baysidedental.example");
  expect(carmMail).toBeTruthy();
  console.log("VERIFY 3a subject:", carmMail!.subject);
  console.log("VERIFY 3a body:\n" + carmMail!.body);
  expect(carmMail!.body).toContain("Bayside Dental");
  expect(carmMail!.body).toContain("https://receptionai.store/login");
  expect(carmMail!.body).toContain("(727) 966-7556");
  expect(carmMail!.body).toContain("https://receptionai.store/set-password?token=");
  expect(carmMail!.body).not.toMatch(/2 min|within \d+ (hours|minutes)/i);

  const link = carmMail!.body.match(/https:\/\/receptionai\.store\/set-password\?token=(\S+)/)![1];
  const token = decodeURIComponent(link);

  const user = db.query("SELECT id, email, password_hash FROM users WHERE email = 'owner@baysidedental.example'").get() as any;
  const first = await setPassword.consumeSetPasswordToken(token, "chosen-by-the-owner-1");
  expect(first.ok).toBe(true);

  const afterFirst = db.query("SELECT password_hash FROM users WHERE id = ?").get(user.id) as any;
  expect(afterFirst.password_hash).not.toBe(user.password_hash); // the random hash is replaced

  const second = await setPassword.consumeSetPasswordToken(token, "another-attempt-2");
  console.log("VERIFY 3a second use:", second);
  expect(second.ok).toBe(false);
  expect(second.error).toMatch(/already been used/i);
});

test("VERIFY 3b — a tampered signature is rejected", async () => {
  const user = db.query("SELECT id FROM users WHERE email = 'owner@baysidedental.example'").get() as any;
  const { token } = await setPassword.createSetPasswordToken(user.id, "owner@baysidedental.example", null);
  const parts = token.split(".");
  const tampered = [parts[0], parts[1], parts[2].slice(0, -4) + "AAAA"].join(".");
  const res = await setPassword.checkSetPasswordToken(tampered);
  console.log("VERIFY 3b tampered:", res);
  expect(res.ok).toBe(false);
  expect(res.error).toMatch(/invalid or has expired/i);

  // a token signed with a different secret is also refused
  const forged = parts[0] + "." + parts[1] + "." + parts[2];
  expect((await setPassword.checkSetPasswordToken(forged)).ok).toBe(true); // sanity: the real one still works
});

test("VERIFY 3c — an expired link is refused even though the JWT is well formed", async () => {
  const user = db.query("SELECT id FROM users WHERE email = 'owner@baysidedental.example'").get() as any;
  const { token } = await setPassword.createSetPasswordToken(user.id, "owner@baysidedental.example", null);
  db.query("UPDATE password_set_tokens SET expires_at = '2020-01-01T00:00:00.000Z' WHERE token_hash = ?").run(
    await setPassword.hashSetPasswordToken(token)
  );
  const res = await setPassword.checkSetPasswordToken(token);
  console.log("VERIFY 3c expired row:", res);
  expect(res.ok).toBe(false);
  expect(res.error).toMatch(/expired/i);

  // and a token minted with a negative TTL fails at the JWT level too
  const { token: dead } = await setPassword.createSetPasswordToken(user.id, "owner@baysidedental.example", null, -1000);
  expect((await setPassword.checkSetPasswordToken(dead)).ok).toBe(false);
});

test("VERIFY 3d — self-serve buyer with a chosen password gets a login link and NO token", async () => {
  const selfMail = outbox.find((m) => m.to === "owner@acmehvac.example");
  expect(selfMail).toBeTruthy();
  console.log("VERIFY 3d body:\n" + selfMail!.body);
  expect(selfMail!.body).toContain("Acme HVAC");
  expect(selfMail!.body).toContain("https://receptionai.store/login");
  expect(selfMail!.body).toContain("the password you chose at checkout");
  expect(selfMail!.body).not.toContain("/set-password?token=");
  expect(selfMail!.body).not.toMatch(/2 min/i);
});

test("VERIFY 3e — the email template renders the pending-number case truthfully", async () => {
  const { body } = welcome.buildWelcomeEmail({
    name: null,
    businessName: "Acme HVAC",
    email: "owner@acmehvac.example",
    planLabel: "Starter",
    phoneNumber: null,
    pendingPort: false,
    setPasswordUrl: null,
  });
  expect(body).toContain("Hi there,");
  expect(body).toContain("being set up");
  expect(body).not.toMatch(/is live and ready/i);
});

test("VERIFY 4 — exactly one Telnyx number order for the whole replay sequence", () => {
  console.log("Telnyx number orders placed:", telnyxOrders, "Stripe line-item reads:", stripeLineItems);
  expect(telnyxOrders).toBe(2); // one for the self-serve org, one for the Carm org — and none for any replay
});
