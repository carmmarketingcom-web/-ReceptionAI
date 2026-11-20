/**
 * The after-payment path (owner 2026-11-20): one provisioning function, safe to call twice, and a
 * thank-you page that gets its answers from the server instead of from the signup form.
 *
 * Postgres is a fake tagged-template that keeps real rows, Stripe and Telnyx are stubbed, and the
 * email provider is deliberately absent — so this proves the decisions (one org per session, one
 * welcome email, one recorded delivery row) without touching production or sending anything.
 *
 * Run: bun test --isolate scripts/provisioning-idempotency.test.ts
 */
import { test, expect } from "bun:test";
import { provisionCheckoutSession } from "../src/lib/provisioning";
import { handleSessionStatus } from "../src/lib/stripe-session-status";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const read = (p: string) => Bun.file(`${REPO}/${p}`).text();

// ── A tiny Postgres ─────────────────────────────────────────────────────────
interface Db {
  orgs: any[];
  users: any[];
  phones: any[];
  subs: any[];
  hours: any[];
  deliveries: any[];
  writes: string[];
}

function newDb(): Db {
  return { orgs: [], users: [], phones: [], subs: [], hours: [], deliveries: [], writes: [] };
}

function fakeSql(db: Db) {
  return async (strings: TemplateStringsArray, ...params: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();

    if (/^CREATE (TABLE|INDEX)/i.test(text)) return [];

    // ── reads ────────────────────────────────────────────────────────────
    if (/^SELECT organization_id FROM subscriptions WHERE stripe_subscription_id = \?/.test(text)) {
      return db.subs.filter((s) => s.stripe_subscription_id === params[0]).map((s) => ({ organization_id: s.organization_id }));
    }
    if (/^SELECT organization_id FROM subscriptions WHERE metadata->>'checkout_session_id' = \?/.test(text)) {
      return db.subs.filter((s) => s.metadata?.checkout_session_id === params[0]).map((s) => ({ organization_id: s.organization_id }));
    }
    if (/^SELECT id FROM organizations WHERE stripe_customer_id = \?/.test(text)) {
      return db.orgs.filter((o) => o.stripe_customer_id === params[0]).map((o) => ({ id: o.id }));
    }
    if (/^SELECT organization_id FROM subscriptions WHERE stripe_customer_id = \?/.test(text)) {
      return db.subs.filter((s) => s.stripe_customer_id === params[0]).map((s) => ({ organization_id: s.organization_id }));
    }
    if (/^SELECT o\.id FROM organizations o/.test(text)) {
      return db.orgs
        .filter((o) => o.email === params[0] && db.subs.some((s) => s.organization_id === o.id))
        .map((o) => ({ id: o.id }));
    }
    if (/^SELECT o\.name AS org_name/.test(text)) {
      const org = db.orgs.find((o) => o.id === params[0]);
      if (!org) return [];
      const owner = db.users.find((u) => u.organization_id === org.id && u.role === "owner");
      return [{ org_name: org.name, org_email: org.email, user_name: owner?.name ?? null }];
    }
    if (/^SELECT id FROM subscription_plans WHERE name = \?/.test(text)) {
      return [{ id: `plan-${params[0]}` }];
    }
    if (/^SELECT phone_number, is_active, metadata FROM phone_numbers/.test(text)) {
      return db.phones.filter((p) => p.organization_id === params[0]);
    }
    if (/^SELECT id FROM email_deliveries WHERE org_id = \? AND kind = \?/.test(text)) {
      return db.deliveries
        .filter((d) => d.org_id === params[0] && d.kind === params[1])
        .map((d, i) => ({ id: `delivery-${i}` }));
    }

    // ── writes ───────────────────────────────────────────────────────────
    if (/^INSERT INTO organizations/.test(text)) {
      db.writes.push("insert-org");
      db.orgs.push({
        id: params[0], name: params[1], slug: params[2], email: params[3],
        stripe_customer_id: params[4], timezone: params[5],
      });
      return [];
    }
    if (/^UPDATE organizations SET phone/.test(text)) {
      db.writes.push("update-org-phone");
      const org = db.orgs.find((o) => o.id === params[1]);
      if (org && !org.phone) org.phone = params[0];
      return [];
    }
    if (/^INSERT INTO users/.test(text)) {
      db.writes.push("insert-user");
      db.users.push({ id: params[0], organization_id: params[1], email: params[2], name: params[3], role: "owner" });
      return [];
    }
    if (/^INSERT INTO phone_numbers/.test(text)) {
      db.writes.push("insert-phone");
      // 'telnyx', true and the capability JSON are literals in the SQL, not bound params.
      const pendingPort = /pending_port/.test(text);
      db.phones.push({
        organization_id: params[1],
        phone_number: params[2],
        is_active: !pendingPort,
        metadata: pendingPort ? { status: "pending_port" } : null,
      });
      return [];
    }
    if (/^INSERT INTO subscriptions/.test(text)) {
      db.writes.push("insert-subscription");
      db.subs.push({
        organization_id: params[1], plan_id: params[2], stripe_subscription_id: params[3],
        stripe_customer_id: params[4], status: "active",
        metadata: params[5] ? JSON.parse(String(params[5])) : null,
      });
      return [];
    }
    if (/^INSERT INTO business_hours/.test(text)) {
      db.writes.push("insert-hours");
      db.hours.push({ organization_id: params[1], day_of_week: params[2] });
      return [];
    }
    if (/^INSERT INTO email_deliveries/.test(text)) {
      db.writes.push("insert-delivery");
      db.deliveries.push({
        to_email: params[1], subject: params[2], kind: params[3], org_id: params[4],
        status: params[5], error: params[6],
      });
      return [];
    }

    throw new Error(`unexpected query: ${text.slice(0, 120)}`);
  };
}

function session(overrides: Record<string, any> = {}) {
  return {
    id: "cs_test_a1B2c3D4e5F6g7H8",
    object: "checkout.session",
    payment_status: "paid",
    customer: "cus_test_owner",
    subscription: "sub_test_owner",
    metadata: {
      companyName: "Acme Plumbing",
      email: "owner@acme.test",
      name: "Dana Reed",
      plan: "growth",
      password: "chosen-at-checkout-9x",
      postalCode: "33701",
      useExistingNumber: "false",
      existingPhoneNumber: "",
    },
    customer_details: {
      email: "owner@acme.test",
      name: "Dana Reed",
      phone: "+17275550123",
      address: { postal_code: "33701" },
    },
    ...overrides,
  };
}

function depsFor(db: Db, extra: Record<string, any> = {}) {
  return {
    sql: fakeSql(db),
    buyNumber: async () => ({ phoneNumber: "+17279101304", telnyxNumberId: "tny_test_1" }),
    alert: async () => {},
    createSetPasswordLink: async () => "https://www.receptionai.store/set-password?token=test",
    ...extra,
  };
}

// The provider is deliberately absent: deliverEmail must record a `failed` row, never claim a send.
delete process.env.RESEND_API_KEY;
// A placeholder key so session-status reaches the injected fetch instead of stopping at the env
// check. No request ever leaves the test — every Stripe call is the stub below.
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder_for_tests";

// ── Tests ──────────────────────────────────────────────────────────────────

test("one paid session creates exactly one org, user, number, subscription and one recorded welcome email", async () => {
  const db = newDb();
  const result = await provisionCheckoutSession(session(), depsFor(db));

  expect(result).not.toBeNull();
  expect(db.orgs.length).toBe(1);
  expect(db.users.length).toBe(1);
  expect(db.phones.length).toBe(1);
  expect(db.subs.length).toBe(1);
  expect(db.hours.length).toBe(7);
  expect(result!.businessName).toBe("Acme Plumbing");
  expect(result!.firstName).toBe("Dana");
  expect(result!.email).toBe("owner@acme.test");
  expect(result!.phoneNumber).toBe("+17279101304");
  expect(result!.alreadyProvisioned).toBe(false);

  // The welcome email left a trail (owner incident 2026-11-20 could prove neither way).
  const welcomes = db.deliveries.filter((d) => d.kind === "welcome");
  expect(welcomes.length).toBe(1);
  expect(welcomes[0].org_id).toBe(result!.orgId);
  expect(welcomes[0].to_email).toBe("owner@acme.test");
  // No RESEND_API_KEY, so nothing was delivered — and it says so rather than claiming success.
  expect(welcomes[0].status).toBe("failed");
  expect(String(welcomes[0].error)).toContain("RESEND_API_KEY");
});

test("a second call for the same session creates nothing and returns the same org", async () => {
  const db = newDb();
  const deps = depsFor(db);

  const first = await provisionCheckoutSession(session(), deps);
  const writesAfterFirst = db.writes.length;

  const second = await provisionCheckoutSession(session(), deps);

  expect(second).not.toBeNull();
  expect(second!.orgId).toBe(first!.orgId);
  expect(second!.alreadyProvisioned).toBe(true);
  // Nothing was written by the second run at all.
  expect(db.writes.length).toBe(writesAfterFirst);
  expect(db.orgs.length).toBe(1);
  expect(db.users.length).toBe(1);
  expect(db.phones.length).toBe(1);
  expect(db.subs.length).toBe(1);
  expect(db.deliveries.filter((d) => d.kind === "welcome").length).toBe(1);
  // And it still answers with the number the customer actually got.
  expect(second!.phoneNumber).toBe("+17279101304");
});

test("two concurrent calls for one session share a single run", async () => {
  const db = newDb();
  const deps = depsFor(db);
  const [a, b] = await Promise.all([
    provisionCheckoutSession(session(), deps),
    provisionCheckoutSession(session(), deps),
  ]);
  expect(db.orgs.length).toBe(1);
  expect(a!.orgId).toBe(b!.orgId);
});

test("a session the webhook already provisioned is returned, not provisioned again", async () => {
  const db = newDb();
  // The webhook got there first: the org carries the Stripe customer and has a subscription.
  db.orgs.push({ id: "org-from-webhook", name: "Acme Plumbing", email: "owner@acme.test", stripe_customer_id: "cus_test_owner" });
  db.users.push({ id: "user-1", organization_id: "org-from-webhook", email: "owner@acme.test", name: "Dana Reed", role: "owner" });
  db.subs.push({ organization_id: "org-from-webhook", stripe_subscription_id: "sub_test_owner", stripe_customer_id: "cus_test_owner" });
  db.phones.push({ organization_id: "org-from-webhook", phone_number: "+17279101304", is_active: true, metadata: null });

  const result = await provisionCheckoutSession(session(), depsFor(db));

  expect(result!.orgId).toBe("org-from-webhook");
  expect(result!.alreadyProvisioned).toBe(true);
  expect(db.orgs.length).toBe(1);
  expect(db.writes.length).toBe(0);
});

test("session-status never echoes the session metadata (it carries the password)", async () => {
  const payload = session();
  const seen: any[] = [];
  const res = await handleSessionStatus(
    new Request("https://www.receptionai.store/api/stripe/session-status?session_id=cs_test_a1B2c3D4e5F6g7H8"),
    {
      fetchImpl: (async () => ({ ok: true, status: 200, json: async () => payload })) as any,
      provision: async () => {
        seen.push("provisioned");
        return {
          orgId: "org-1", businessName: "Acme Plumbing", firstName: "Dana",
          email: "owner@acme.test", phoneNumber: "+17279101304", pendingPort: false,
          alreadyProvisioned: false,
        };
      },
    }
  );
  const body = await res.json() as any;
  expect(seen.length).toBe(1);
  expect(Object.keys(body).sort()).toEqual(
    ["businessName", "email", "firstName", "paid", "phoneNumber", "ready"].sort()
  );
  expect(body.ready).toBe(true);
  expect(body.phoneNumber).toBe("+17279101304");
  const raw = JSON.stringify(body);
  expect(raw).not.toContain("chosen-at-checkout");
  expect(raw).not.toContain("metadata");
});

test("session-status does not provision an unpaid session", async () => {
  let provisioned = false;
  const res = await handleSessionStatus(
    new Request("https://www.receptionai.store/api/stripe/session-status?session_id=cs_test_a1B2c3D4e5F6g7H8"),
    {
      fetchImpl: (async () => ({ ok: true, status: 200, json: async () => session({ payment_status: "unpaid" }) })) as any,
      provision: async () => { provisioned = true; return null; },
    }
  );
  const body = await res.json() as any;
  expect(provisioned).toBe(false);
  expect(body.paid).toBe(false);
  expect(body.ready).toBe(false);
});

test("session-status answers calmly for a missing or malformed session id", async () => {
  const res = await handleSessionStatus(new Request("https://www.receptionai.store/api/stripe/session-status"));
  expect(res.status).toBe(400);
  const body = await res.json() as any;
  expect(body).toEqual({ paid: false, ready: false, businessName: null, firstName: null, email: null, phoneNumber: null });
});

test("every checkout carries the session id back to the thank-you page, in both trees", async () => {
  for (const f of [
    "src/routes/api/stripe/checkout.ts",
    "site/src/routes/api/stripe/checkout.ts",
    "serve.ts",
    "site/serve.ts",
  ]) {
    const src = await read(f);
    expect(src).toContain("/signup/success?plan=${plan}&email=${encodeURIComponent(email)}&session_id={CHECKOUT_SESSION_ID}");
  }
});

test("both servers serve /api/stripe/session-status, and the page polls it", async () => {
  for (const f of ["serve.ts", "site/serve.ts"]) {
    const src = await read(f);
    expect(src).toContain('pathname === "/api/stripe/session-status"');
    expect(src).toContain("./src/lib/stripe-session-status");
  }
  for (const f of ["src/routes/signup/success.tsx", "site/src/routes/signup/success.tsx"]) {
    const src = await read(f);
    expect(src).toContain("/api/stripe/session-status?session_id=");
    expect(src).toContain("session_id");
    // Never the signup form.
    expect(src).not.toContain("Start Today");
  }
});

test("the thank-you page is bilingual — every success.* key exists in EN and ES in both trees", async () => {
  for (const f of ["src/lib/i18n.tsx", "site/src/lib/i18n.tsx"]) {
    const src = await read(f);
    const block = src.slice(src.indexOf('"success.waiting.title"'), src.indexOf("/* ─── Runtime locale"));
    const keys = [...block.matchAll(/"(success\.[a-zA-Z.]+)":\s*\{([^}]*)\}/g)];
    expect(keys.length).toBeGreaterThan(10);
    for (const [, key, body] of keys) {
      expect({ key, hasEn: /\ben:/.test(body) }).toEqual({ key, hasEn: true });
      expect({ key, hasEs: /\bes:/.test(body) }).toEqual({ key, hasEs: true });
    }
    expect(block).toContain("success.confirming.title");
    expect(block).toContain("success.ready.callIt");
  }
});
