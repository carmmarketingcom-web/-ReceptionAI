/**
 * /api/auth/set-password
 *
 * The way in for owners who never chose a password (Carm Marketing one-time buyers).
 *
 *   GET  ?token=…  → is this link still good? (read-only, does not consume it)
 *   POST { token, password } → consume the link and set the password
 *
 * The token itself is minted and validated in src/lib/set-password.ts. Everything here is
 * a thin HTTP shell: no token logic lives in this file, so the same rules apply wherever a
 * link is checked.
 */
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/auth/set-password")({});

import { checkSetPasswordToken, consumeSetPasswordToken } from "../../../lib/set-password";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function GET({ request }: { request: Request }) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const result = await checkSetPasswordToken(token);
    if (!result.ok) return json({ valid: false, error: result.error }, 400);
    return json({ valid: true, email: result.email || null });
  } catch (err) {
    console.error("[Set Password] GET failed:", String(err).slice(0, 300));
    return json({ valid: false, error: "We couldn't check that link. Please try again." }, 500);
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: string; password?: string };
    const token = (body.token || "").trim();
    const password = body.password || "";

    if (!token) return json({ error: "This link is missing its token. Use the link from your email." }, 400);
    if (password.length < 8) {
      return json({ error: "Choose a password with at least 8 characters." }, 400);
    }

    const result = await consumeSetPasswordToken(token, password);
    if (!result.ok) return json({ error: result.error || "That link can't be used." }, 400);

    console.log(`[Set Password] Password set for user ${result.userId}`);
    return json({ message: "Password set. You can sign in now." });
  } catch (err) {
    console.error("[Set Password] POST failed:", String(err).slice(0, 300));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
