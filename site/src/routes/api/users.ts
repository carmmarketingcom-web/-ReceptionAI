/**
 * Users (Team) API
 *
 * GET /api/users — List the team members of the authenticated organization.
 *
 * Backed by the `users` table (`organization_id`, `name`, `email`, `role`,
 * `is_active`, `last_login_at`, `created_at`). Rows are real accounts that
 * exist for this org — the dashboard shows exactly these or nothing.
 *
 * There is no presence/online status in the schema. `last_login_at` is the
 * only real activity signal, so the page renders "Active"/"Inactive" from
 * `is_active` and "Last signed in …" from `last_login_at` instead of an
 * invented online dot.
 *
 * IMPORTANT: production traffic is served by the inline handlers in serve.ts /
 * site/serve.ts (see AUDIT_VOICE.md §0). This file and those handlers must stay in sync.
 */
import { authenticate } from "../../lib/middleware";
import { getDb, isMockMode } from "../../db/index";
import { users } from "../../db/schema/index";
import { eq, desc } from "drizzle-orm";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export interface TeamMemberRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  avatarUrl: string | null;
  // is_active is a char column ('1'/'0') in Postgres, so accept both shapes.
  isActive: string | boolean | null;
  lastLoginAt: Date | string | null;
  createdAt: Date | string | null;
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function shapeTeamMember(row: TeamMemberRow) {
  return {
    id: row.id,
    name: row.name || null,
    email: row.email || null,
    role: row.role || null,
    avatarUrl: row.avatarUrl || null,
    // is_active is a char column ('1'/'0') in Postgres; normalize to boolean.
    isActive: row.isActive === true || row.isActive === "1",
    lastLoginAt: iso(row.lastLoginAt),
    createdAt: iso(row.createdAt),
  };
}

export async function GET({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    // No mock/demo rows: an empty list is the honest answer when the org has no users.
    if (isMockMode()) {
      return json({ users: [], total: 0 });
    }

    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.organizationId, authResult.organizationId))
      .orderBy(desc(users.createdAt));

    const team = (rows as TeamMemberRow[]).map(shapeTeamMember);

    return json({ users: team, total: team.length });
  } catch (error) {
    console.error("[Users API] GET error:", error);
    return json({ error: "Failed to fetch team members" }, 500);
  }
}
