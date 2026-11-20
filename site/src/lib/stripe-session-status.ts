/**
 * GET /api/stripe/session-status?session_id=cs_…
 *
 * What the thank-you page asks after Stripe sends the customer back. It answers the one question
 * the page cannot answer by itself: "is there an account and a phone number for this payment yet?"
 *
 * The work happens here, not in the browser: if the session is paid and nothing has been
 * provisioned for it, this call runs the SAME provisioning function the webhook runs. So a late
 * (or never-delivered) webhook can no longer leave a paying customer on the signup form — and a
 * webhook that arrives afterwards finds the account already there.
 *
 * What it must never do: echo the session's metadata back. `metadata.password` is the customer's
 * password; only the five fields below leave this handler.
 */
import { getSql, provisionCheckoutSession, type ProvisionResult } from "./provisioning";

export interface SessionStatus {
  paid: boolean;
  ready: boolean;
  businessName: string | null;
  firstName: string | null;
  email: string | null;
  phoneNumber: string | null;
}

export interface SessionStatusDeps {
  fetchImpl?: typeof fetch;
  provision?: (session: any) => Promise<ProvisionResult | null>;
}

const EMPTY: SessionStatus = {
  paid: false,
  ready: false,
  businessName: null,
  firstName: null,
  email: null,
  phoneNumber: null,
};

function json(body: SessionStatus, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Stripe session ids look like cs_test_a1B2… / cs_live_a1B2… — anything else is not worth a call. */
function looksLikeSessionId(value: string): boolean {
  return /^cs_(test|live)_[A-Za-z0-9_]{8,}$/.test(value);
}

async function retrieveSession(sessionId: string, fetchImpl: typeof fetch): Promise<any | null> {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) {
    console.error("[Stripe session-status] STRIPE_SECRET_KEY is not set — cannot confirm the payment");
    return null;
  }
  try {
    const res = await fetchImpl(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      console.warn(
        `[Stripe session-status] retrieve failed for ${sessionId} (${res.status}): ${String(data?.error?.message || "").slice(0, 160)}`
      );
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`[Stripe session-status] retrieve threw for ${sessionId}:`, String(err).slice(0, 200));
    return null;
  }
}

export async function handleSessionStatus(
  request: Request,
  deps: SessionStatusDeps = {}
): Promise<Response> {
  const sessionId = (new URL(request.url).searchParams.get("session_id") || "").trim();
  if (!sessionId || !looksLikeSessionId(sessionId)) {
    // Not an error page: the page turns this into "your payment is still being confirmed".
    return json(EMPTY, 400);
  }

  const session = await retrieveSession(sessionId, deps.fetchImpl || fetch);
  if (!session) return json(EMPTY, 200);

  // Stripe sets payment_status to "paid" only once the money is actually captured. "no_payment_required"
  // (a 100% promo code) is also a completed purchase, and a paying customer is never left waiting.
  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (!paid) {
    console.log(`[Stripe session-status] ${sessionId}: payment_status=${session.payment_status || "(none)"} — not provisioning yet`);
    return json({ ...EMPTY, email: session.customer_details?.email || null });
  }

  let result: ProvisionResult | null = null;
  try {
    const provision = deps.provision || ((s: any) => provisionCheckoutSession(s));
    result = await provision(session);
  } catch (err) {
    // A transient failure must not become a broken page: answer "not ready yet" so the page keeps
    // polling, and the error is loud in the log for whoever is watching.
    console.error(`[Stripe session-status] provisioning failed for ${sessionId}:`, String(err).slice(0, 400));
    return json({ ...EMPTY, paid: true, email: session.customer_details?.email || null });
  }

  if (!result) {
    return json({ ...EMPTY, paid: true, email: session.customer_details?.email || null });
  }

  const ready = Boolean(result.phoneNumber || result.pendingPort);
  return json({
    paid: true,
    ready,
    businessName: result.businessName || null,
    firstName: result.firstName || null,
    email: result.email || null,
    phoneNumber: result.phoneNumber || null,
  });
}

/** Kept so a caller that only wants the account lookup does not have to import provisioning. */
export { getSql };
