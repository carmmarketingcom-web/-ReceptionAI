/**
 * GET /api/contacts — List contacts with search and pagination
 *
 * Query params:
 *   - q      — Search query (name, email, phone)
 *   - limit  — Results per page (default 20)
 *   - offset — Pagination offset (default 0)
 *   - tag    — Filter by tag
 */

import { authenticate } from "../../../lib/middleware";
import { getDb, isMockMode } from "../../../db/index";
import { contacts } from "../../../db/schema/index";
import { eq, or, like, and, desc } from "drizzle-orm";

export async function GET({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const tag = url.searchParams.get("tag") || "";

    const usingMock = isMockMode();
    if (usingMock) {
      return new Response(
        JSON.stringify({
          contacts: [],
          total: 0,
          limit,
          offset,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();
    const conditions = [eq(contacts.organizationId, authResult.organizationId)];

    if (q) {
      const searchPattern = `%${q}%`;
      conditions.push(
        or(
          like(contacts.firstName, searchPattern),
          like(contacts.lastName, searchPattern),
          like(contacts.email, searchPattern),
          like(contacts.phone, searchPattern)
        )!
      );
    }

    const rows = await db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.updatedAt))
      .limit(limit)
      .offset(offset);

    return new Response(
      JSON.stringify({
        contacts: rows,
        total: rows.length,
        limit,
        offset,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Contacts] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch contacts" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
