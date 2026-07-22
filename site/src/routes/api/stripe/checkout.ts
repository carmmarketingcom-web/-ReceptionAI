/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for new customer signup.
 * Passes all customer info as metadata — the webhook handles
 * org creation, user creation, phone provisioning after payment.
 */
const PRICE_IDS: Record<string, string> = {
  starter: "price_1TtXMGDqebBmBAbi165hKXK9",
  growth: "price_1TtXMGDqebBmBAbiqd7ybQzy",
  scale: "price_1TtXMGDqebBmBAbidd4SJgki",
};

function stripeSecret(): string {
  return process.env.STRIPE_SECRET_KEY || "";
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json() as {
      companyName: string;
      email: string;
      name: string;
      plan: string;
      useExistingNumber?: boolean;
      existingPhoneNumber?: string;
    };

    const { companyName, email, name, plan, useExistingNumber, existingPhoneNumber } = body;

    if (!companyName || !email || !name || !plan) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: companyName, email, name, plan" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "Invalid plan. Choose starter, growth, or scale." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build success/cancel URLs from request
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "3dcd1380ab04470e1627f5269b036e3d.ctonew.app";
    const baseUrl = `${proto}://${host}`;

    // Create Stripe Checkout session — webhook does the rest after payment
    const params = new URLSearchParams({
      "customer_email": email,
      "mode": "subscription",
      "success_url": `${baseUrl}/signup/success?plan=${plan}&email=${encodeURIComponent(email)}`,
      "cancel_url": `${baseUrl}/signup`,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "metadata[companyName]": companyName,
      "metadata[email]": email,
      "metadata[name]": name,
      "metadata[plan]": plan,
      "metadata[useExistingNumber]": String(!!useExistingNumber),
      "metadata[existingPhoneNumber]": existingPhoneNumber || "",
      "allow_promotion_codes": "true",
      "subscription_data[metadata][companyName]": companyName,
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json() as any;

    if (session.error) {
      console.error("[Stripe Checkout] Error:", session.error);
      return new Response(
        JSON.stringify({ error: session.error.message || "Stripe checkout failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Stripe Checkout] Error:", String(err).slice(0, 300));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
