/**
 * The one welcome email a paying customer gets.
 *
 * Two audiences, one template:
 *   • Carm Marketing done-for-you buyers — paid by one-time Payment Link, no password, so
 *     they get a single-use set-password link (src/lib/set-password.ts).
 *   • Self-serve buyers — chose their own password at checkout, so they get a login link and
 *     no token at all.
 *
 * What this email is allowed to claim: what they bought, the business name that was
 * provisioned (that is the name their callers will hear), their dashboard link, the phone
 * number if we have one, and the public demo line. Nothing else — no onboarding steps we
 * cannot vouch for, no response-time promises, no feature that is not live.
 */
import { sendEmail } from "./email";

export const DASHBOARD_URL = "https://receptionai.store/login";
export const DEMO_LINE = "(727) 966-7556";

export interface WelcomeEmailInput {
  /** First name if we have one; the greeting degrades to "Hi there". */
  name?: string | null;
  /** The business name provisioned — this is what the receptionist says out loud. */
  businessName: string;
  email: string;
  /** What they bought, in words: "Starter", "Growth", "Scale". */
  planLabel: string;
  /** e.g. " (founding client rate)" — empty for standard pricing. */
  planNote?: string;
  /** The live number, when provisioning bought one. */
  phoneNumber?: string | null;
  /** True when their own number is still being ported to us. */
  pendingPort?: boolean;
  /**
   * Single-use set-password link. Present only for buyers who never chose a password
   * (the Carm one-time path). Self-serve buyers get null and see a login link instead.
   */
  setPasswordUrl?: string | null;
  /** Where the dashboard lives — overridable so links always match the environment. */
  dashboardUrl?: string;
}

export interface WelcomeEmail {
  subject: string;
  body: string;
}

export function buildWelcomeEmail(input: WelcomeEmailInput): WelcomeEmail {
  const dashboardUrl = (input.dashboardUrl || DASHBOARD_URL).replace(/\/+$/, "") || DASHBOARD_URL;
  const greetingName = (input.name || "").trim();
  const businessName = (input.businessName || "").trim() || "your business";
  const planLine = `${input.planLabel}${input.planNote || ""}`;

  const numberLine = input.phoneNumber
    ? `Phone number: ${input.phoneNumber}`
    : input.pendingPort
      ? "Phone number: your existing number is being ported to us — we'll email you the moment it is live."
      : "Phone number: being set up — we'll email it to you as soon as it is live. Nothing for you to do.";

  const wayIn = input.setPasswordUrl
    ? [
        "Set your password (this link works once and expires in 7 days):",
        input.setPasswordUrl,
        "",
        `After that, sign in any time at ${dashboardUrl} with this email address (${input.email}).`,
      ].join("\n")
    : [
        `Sign in at ${dashboardUrl} with this email address (${input.email}) and the password you chose at checkout.`,
      ].join("\n");

  const body = [
    `Hi ${greetingName || "there"},`,
    "",
    `${businessName} is set up on ReceptionAI — your plan is ${planLine}.`,
    "",
    wayIn,
    "",
    "What you have:",
    `• Business name your callers will hear: ${businessName}`,
    `• ${numberLine}`,
    `• Dashboard: ${dashboardUrl}`,
    "",
    `Want to hear what your receptionist sounds like before your line goes live? Call our demo line: ${DEMO_LINE}`,
    "",
    "Questions? Reply to this email.",
    "",
    "— Team ReceptionAI",
  ].join("\n");

  return {
    subject: `${businessName} is set up on ReceptionAI — here's how to sign in`,
    body,
  };
}

/**
 * Build and send. Returns false (and the caller logs it loudly) if nothing was delivered —
 * a paying customer who hears nothing from us must never be a silent failure.
 */
export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<boolean> {
  const { subject, body } = buildWelcomeEmail(input);
  return sendEmail(input.email, subject, body);
}
