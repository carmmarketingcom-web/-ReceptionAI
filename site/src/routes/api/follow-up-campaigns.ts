/**
 * Follow-Up Campaigns API
 *
 * GET /api/follow-up-campaigns — List automated follow-up campaigns for the
 * authenticated organization.
 *
 * Backed by the `follow_up_campaigns` table (name, description, trigger_event,
 * delay_minutes, max_attempts, interval_minutes, channels, message_template,
 * language, is_active, created_at). CONTEXT: nothing writes this table yet —
 * the follow-up engine itself is the Revenue Recovery build — so the list is
 * empty in practice and the dashboard says so instead of showing invented
 * campaign statistics.
 *
 * Deliberately NOT returned: sent/opened/replied/conversion counts. No such data
 * exists anywhere (there is no delivery tracking on follow_up_messages yet), so
 * the page never shows those numbers.
 *
 * IMPORTANT: production traffic is served by the inline handlers in serve.ts /
 * site/serve.ts (see AUDIT_VOICE.md §0). This file and those handlers must stay in sync.
 */
import { authenticate } from "../../lib/middleware";
import { getDb, isMockMode } from "../../db/index";
import { followUpCampaigns } from "../../db/schema/index";
import { eq, desc } from "drizzle-orm";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function channelList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((c): c is string => typeof c === "string");
  return [];
}

export interface CampaignRow {
  id: string;
  name: string | null;
  description: string | null;
  triggerEvent: string | null;
  delayMinutes: number | null;
  maxAttempts: number | null;
  intervalMinutes: number | null;
  channels: unknown;
  language: string | null;
  isActive: boolean | null;
  createdAt: Date | string | null;
}

export function shapeCampaign(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name || null,
    description: row.description || null,
    triggerEvent: row.triggerEvent || null,
    delayMinutes:
      row.delayMinutes === null || row.delayMinutes === undefined
        ? null
        : Number(row.delayMinutes),
    maxAttempts:
      row.maxAttempts === null || row.maxAttempts === undefined
        ? null
        : Number(row.maxAttempts),
    intervalMinutes:
      row.intervalMinutes === null || row.intervalMinutes === undefined
        ? null
        : Number(row.intervalMinutes),
    channels: channelList(row.channels),
    language: row.language || null,
    isActive: row.isActive === true,
    createdAt: iso(row.createdAt),
  };
}

export async function GET({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    // No mock/demo rows: an empty list is the honest answer when no campaign exists.
    if (isMockMode()) {
      return json({ campaigns: [], total: 0 });
    }

    const db = getDb();
    const rows = await db
      .select({
        id: followUpCampaigns.id,
        name: followUpCampaigns.name,
        description: followUpCampaigns.description,
        triggerEvent: followUpCampaigns.triggerEvent,
        delayMinutes: followUpCampaigns.delayMinutes,
        maxAttempts: followUpCampaigns.maxAttempts,
        intervalMinutes: followUpCampaigns.intervalMinutes,
        channels: followUpCampaigns.channels,
        language: followUpCampaigns.language,
        isActive: followUpCampaigns.isActive,
        createdAt: followUpCampaigns.createdAt,
      })
      .from(followUpCampaigns)
      .where(eq(followUpCampaigns.organizationId, authResult.organizationId))
      .orderBy(desc(followUpCampaigns.createdAt));

    const campaigns = (rows as CampaignRow[]).map(shapeCampaign);

    return json({ campaigns, total: campaigns.length });
  } catch (error) {
    console.error("[Follow-Up Campaigns API] GET error:", error);
    return json({ error: "Failed to fetch campaigns" }, 500);
  }
}
