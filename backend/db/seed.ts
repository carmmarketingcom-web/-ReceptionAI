/**
 * Database seed script.
 *
 * Seeds the database with default data:
 *  - Subscription plans (Starter, Growth, Scale)
 *  - Default AI response templates
 *
 * Usage: bun run db/seed.ts
 */

import { getDb } from "./index";
import { subscriptionPlans } from "./schema/billing";
import { aiResponseTemplates } from "./schema/ai";
import { eq } from "drizzle-orm";

async function seed() {
  const db = getDb();
  console.log("🌱 Seeding database...");

  // ─── Subscription Plans ──────────────────────────────────────────────

  const plans = [
    {
      name: "starter",
      displayName: "Starter",
      description:
        "Perfect for solo businesses. One phone line with AI-powered call handling, SMS, and web chat.",
      priceMonthlyCents: 9900,
      priceAnnualCents: 95040, // 20% discount
      includedPhoneLines: 1,
      includedAiMinutes: 500,
      includedSmsMessages: 200,
      features: [
        "1 phone line",
        "500 AI minutes/month",
        "SMS & web chat",
        "Basic calendar sync",
        "Email notifications",
        "English & Spanish",
      ],
      limits: {
        maxUsers: 3,
        maxContacts: 500,
        recordingRetentionDays: 30,
      },
      sortOrder: 1,
    },
    {
      name: "growth",
      displayName: "Growth",
      description:
        "For growing teams. Two phone lines, advanced analytics, WhatsApp & Facebook integration.",
      priceMonthlyCents: 24900,
      priceAnnualCents: 239040,
      includedPhoneLines: 2,
      includedAiMinutes: 2000,
      includedSmsMessages: 1000,
      features: [
        "2 phone lines",
        "2,000 AI minutes/month",
        "SMS, web chat, WhatsApp & Facebook",
        "Advanced analytics dashboard",
        "Team management",
        "Calendar sync (Google & Microsoft)",
        "Custom AI responses",
        "Call recording & transcription",
        "Follow-up campaigns",
      ],
      limits: {
        maxUsers: 15,
        maxContacts: 5000,
        recordingRetentionDays: 90,
      },
      sortOrder: 2,
    },
    {
      name: "scale",
      displayName: "Scale",
      description:
        "For established businesses. Unlimited phone lines, custom AI, priority support.",
      priceMonthlyCents: 39900,
      priceAnnualCents: 383040,
      includedPhoneLines: 5,
      includedAiMinutes: 10000,
      includedSmsMessages: 5000,
      features: [
        "Unlimited phone lines (up to 5 included)",
        "10,000+ AI minutes/month",
        "All messaging channels",
        "Custom AI responses & voice",
        "Priority support (SLA)",
        "Advanced analytics & reporting",
        "Full calendar & CRM sync",
        "API access",
        "Dedicated account manager",
        "Custom integrations",
      ],
      limits: {
        maxUsers: 50,
        maxContacts: 50000,
        recordingRetentionDays: 365,
      },
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    const existing = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, plan.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(subscriptionPlans).values(plan);
      console.log(`  ✅ Created plan: ${plan.displayName}`);
    } else {
      console.log(`  ⏭️  Plan already exists: ${plan.displayName}`);
    }
  }

  // ─── Default AI Response Templates ───────────────────────────────────

  const defaultTemplates = [
    {
      name: "Default Greeting (EN)",
      triggerType: "greeting" as const,
      language: "en" as const,
      responseText:
        "Hello! Thank you for calling {{business_name}}. This is ReceptionAI, how can I help you today?",
      isDefault: true,
      sortOrder: "1",
    },
    {
      name: "Default Greeting (ES)",
      triggerType: "greeting" as const,
      language: "es" as const,
      responseText:
        "¡Hola! Gracias por llamar a {{business_name}}. Soy ReceptionAI, ¿cómo puedo ayudarle hoy?",
      isDefault: true,
      sortOrder: "2",
    },
    {
      name: "Default Voicemail (EN)",
      triggerType: "voicemail" as const,
      language: "en" as const,
      responseText:
        "We're unable to take your call right now, but please leave a message after the tone and we'll get back to you shortly.",
      isDefault: true,
      sortOrder: "3",
    },
    {
      name: "Default Voicemail (ES)",
      triggerType: "voicemail" as const,
      language: "es" as const,
      responseText:
        "No podemos atender su llamada en este momento, pero por favor deje un mensaje después del tono y le responderemos pronto.",
      isDefault: true,
      sortOrder: "4",
    },
    {
      name: "After Hours (EN)",
      triggerType: "after_hours" as const,
      language: "en" as const,
      responseText:
        "You've reached {{business_name}} outside of our business hours. Our hours are {{business_hours}}. Please leave a message or call back during business hours.",
      isDefault: true,
      sortOrder: "5",
    },
    {
      name: "Appointment Booking Prompt (EN)",
      triggerType: "appointment_booking" as const,
      language: "en" as const,
      responseText:
        "I'd be happy to help you schedule an appointment! What day and time works best for you?",
      isDefault: true,
      sortOrder: "6",
    },
    {
      name: "Transfer to Human (EN)",
      triggerType: "transfer" as const,
      language: "en" as const,
      responseText:
        "Let me transfer you to a team member who can help with that. Please hold for just a moment.",
      isDefault: true,
      sortOrder: "7",
    },
    {
      name: "Fallback (EN)",
      triggerType: "fallback" as const,
      language: "en" as const,
      responseText:
        "I apologize, I didn't quite catch that. Could you please rephrase, or would you like me to transfer you to a team member?",
      isDefault: true,
      sortOrder: "8",
    },
  ];

  let templateCount = 0;
  for (const template of defaultTemplates) {
    // Default templates have null org (system templates)
    await db.insert(aiResponseTemplates).values({
      ...template,
      organizationId: "00000000-0000-0000-0000-000000000000" as any, // system placeholder
      description: `System default template for ${template.triggerType} in ${template.language}`,
    } as any);
    templateCount++;
  }
  console.log(`  ✅ Created ${templateCount} default AI templates`);

  console.log("✅ Seed complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
