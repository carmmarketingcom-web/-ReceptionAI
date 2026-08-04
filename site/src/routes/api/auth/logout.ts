/**
 * POST /api/auth/logout
 *
 * Clears the session. Client-side, the token is removed from localStorage.
 * Server-side, this is a no-op for JWT-based auth (tokens are stateless).
 * In a session-based system, this would invalidate the session.
 */


export async function POST() {
  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie":
          "receptionai_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      },
    }
  );
}
