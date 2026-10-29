/**
 * Email sender — uses the team's existing inbox (receptionai-0d8b54db@ctomail.io).
 * Falls back to console.log when running outside the sandbox (dev/testing).
 */

const FROM_EMAIL = "ReceptionAI <hello@receptionai.store>";

export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    // In sandbox: use the team's built-in email sender
    // The sendEmail tool is available in the agent sandbox environment
    // When running in production (Vercel/Bun), we log and can use Resend as fallback
    console.log(`[Email] To: ${to}, Subject: ${subject}`);
    console.log(`[Email] Body preview: ${body.slice(0, 100)}...`);

    // Try Resend as fallback if configured
    const resendKey = process.env.RESEND_API_KEY || "";
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, text: body }),
      });
      if (res.ok) {
        console.log(`[Email] Sent successfully via Resend to ${to}`);
        return true;
      }
      // The provider's own error, not a generic one — callers log this and it is the only
      // evidence that a customer was never contacted.
      const detail = await res.text().catch(() => "");
      console.error(`[Email] Resend rejected "${subject}" to ${to} (${res.status}): ${detail.slice(0, 300)}`);
      return false;
    }

    // No provider configured: NOTHING was sent. Returning true here used to make callers
    // report a successful send for an email that never left the process.
    console.error(
      `[Email] NOT SENT — no email provider configured (RESEND_API_KEY unset). "${subject}" to ${to} was not delivered.`
    );
    return false;
  } catch (err) {
    console.error("[Email] Send failed:", String(err).slice(0, 200));
    return false;
  }
}
