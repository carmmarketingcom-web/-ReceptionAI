// ─── Calendar Connect API Route ───────────────────────────────────────────────
// POST /api/calendar/connect
// Initiates Google Calendar OAuth2 flow for an organization.

import { getAuthUrl } from "../../../../voice-engine/src/calendar/calendar.ts";

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json() as { orgId?: string; redirectUri?: string } || {};
    const orgId = body.orgId || "";
    const redirectUri = body.redirectUri || `${new URL(request.url).origin}/api/calendar/callback`;

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "orgId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const authUrl = getAuthUrl(orgId, redirectUri);

    return new Response(
      JSON.stringify({ authUrl, orgId, redirectUri }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Calendar Connect] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate auth URL" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// GET handler for OAuth2 callback
export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // orgId
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(
      JSON.stringify({ error: `OAuth error: ${error}` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!code || !state) {
    return new Response(
      JSON.stringify({ error: "Missing code or state parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const { exchangeCode, storeCredentials } = await import("../../../../voice-engine/src/calendar/calendar.ts");
    const redirectUri = `${url.origin}/api/calendar/connect`;
    const credentials = await exchangeCode(code, redirectUri);
    await storeCredentials(state, credentials);

    return new Response(
      JSON.stringify({ success: true, orgId: state, message: "Calendar connected successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Calendar Callback] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to complete OAuth flow" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}