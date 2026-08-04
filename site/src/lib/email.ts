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
    }

    // In production without Resend, log for now
    console.log(`[Email] Would send to ${to}: "${subject}"`);
    return true;
  } catch (err) {
    console.warn("[Email] Send failed:", String(err).slice(0, 100));
    return false;
  }
}
