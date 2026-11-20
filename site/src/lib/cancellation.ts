/**
 * Cancellation flow (owner-approved 2026-11-20, `cancellation-flow-spec.md`).
 *
 * One question in the dashboard — "where should calls go?" — and two plain answers. Everything
 * after the button is decided here, so `serve.ts`, `site/serve.ts` and the vite-dev route files
 * all behave identically:
 *
 *   • the plan runs to the END of the paid month (`cancel_at_period_end`), never earlier;
 *   • from that date the AI stops answering, the booking page goes offline and reminders,
 *     reminder calls and missed-call callbacks stop for that org;
 *   • "nowhere": callers hear a short out-of-service message for 14 days, then the number is
 *     released at Telnyx and the row is marked released;
 *   • "forward": calls ring the number the customer gave us for 30 days after the period end,
 *     then fall back to the out-of-service message for 14 days, then release;
 *   • the owner is emailed when service ends, when a number is released, and when a customer's
 *     data is due for deletion (90 days).
 *
 * Hard rules enforced here: a ported number (`metadata.status = 'pending_port'`) is NEVER
 * auto-released, release is claimed before the Telnyx call and is idempotent, and nothing is
 * ever released for an org whose service has not ended (or has since been resumed).
 */

export type CancelDisposition = "nowhere" | "forward";

/** The one-tap chips the dialog offers. `reason` is optional, so a customer may pick none. */
export const CANCEL_CHIPS = ["Too expensive", "Closing", "Switched service", "Other"] as const;

/** The six reasons 0017 shipped with. Still accepted, so an old client never gets a 400. */
export const LEGACY_CANCEL_REASONS = [
  "Too expensive",
  "Not enough calls",
  "Missing a feature",
  "Closing the business",
  "Going elsewhere",
  "Other",
] as const;

/** Stored when the customer taps "Cancel subscription" without picking a chip. */
export const REASON_NOT_GIVEN = "Not given";

export const OUT_OF_SERVICE_DAYS = 14;
export const FORWARD_DAYS = 30;
export const DATA_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What a caller hears once the paid month is over and the number is not being forwarded.
 * Deliberately says nothing about the business's AI receptionist and nothing untrue.
 */
export const OUT_OF_SERVICE_EN = "This number is no longer in service. Please contact the business directly. Goodbye.";
export const OUT_OF_SERVICE_ES = "Este número ya no está en servicio. Por favor comuníquese directamente con la empresa. Adiós.";

export type SqlTag = (strings: TemplateStringsArray, ...params: any[]) => Promise<any>;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Small pure helpers ─────────────────────────────────────────────────────

/** The chip or legacy reason this org sent, or `Not given`. Never throws on an unknown value. */
export function normalizeReason(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return REASON_NOT_GIVEN;
  const all = [...CANCEL_CHIPS, ...LEGACY_CANCEL_REASONS] as readonly string[];
  return all.includes(value) ? value : REASON_NOT_GIVEN;
}

/** `nowhere` unless the customer explicitly asked to forward calls somewhere. */
export function normalizeDisposition(raw: unknown): CancelDisposition {
  return String(raw ?? "").trim().toLowerCase() === "forward" ? "forward" : "nowhere";
}

/**
 * A number we are willing to forward calls to: 10 digits (US) or 11 with a leading 1, or a full
 * `+` number. Anything else is refused rather than stored — a typo must not silently swallow a
 * customer's calls.
 */
export function normalizeForwardNumber(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

export interface LifecyclePlanInput {
  mode: CancelDisposition;
  forwardTo?: string | null;
  /** The end of the paid month — the moment the AI stops answering. */
  serviceEndsAt: string | Date;
  numbers: string[];
}

export interface LifecyclePlanRow {
  phoneE164: string;
  mode: CancelDisposition;
  forwardTo: string | null;
  serviceEndsAt: string;
  forwardUntil: string | null;
  outOfServiceUntil: string;
  releaseAt: string;
}

/**
 * The whole schedule for one org, computed once and stored. Pure: same input, same dates.
 * Forwarding runs for 30 days after the period end, then 14 days of the out-of-service
 * message, then release. "Nowhere" skips the first 30 days entirely.
 */
export function planNumberLifecycle(input: LifecyclePlanInput): LifecyclePlanRow[] {
  const end = new Date(input.serviceEndsAt);
  if (Number.isNaN(end.getTime())) return [];
  const mode = normalizeDisposition(input.mode);
  const forwardTo = mode === "forward" ? normalizeForwardNumber(input.forwardTo) : null;
  const forwardUntilMs = mode === "forward" && forwardTo ? end.getTime() + FORWARD_DAYS * DAY_MS : null;
  const outOfServiceUntilMs = (forwardUntilMs ?? end.getTime()) + OUT_OF_SERVICE_DAYS * DAY_MS;
  return (input.numbers || []).filter(Boolean).map((phoneE164) => ({
    phoneE164,
    // A "forward" choice without a usable number falls back to the out-of-service message
    // rather than pretending calls are being forwarded.
    mode: forwardTo ? mode : "nowhere",
    forwardTo,
    serviceEndsAt: end.toISOString(),
    forwardUntil: forwardUntilMs ? new Date(forwardUntilMs).toISOString() : null,
    outOfServiceUntil: new Date(outOfServiceUntilMs).toISOString(),
    releaseAt: new Date(outOfServiceUntilMs).toISOString(),
  }));
}

/** The last day of the paid month, spelled the way the dialog and the email spell it. */
export function lastPaidDay(iso: string | Date | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ─── Tables (self-creating, like 0008/0010/0013) ────────────────────────────

let lifecycleTablesReady: Promise<boolean> | null = null;

/** CREATE TABLE / ALTER TABLE IF NOT EXISTS for everything 0019 adds. Safe to call every time. */
export async function ensureLifecycleTables(sql: SqlTag): Promise<boolean> {
  if (!lifecycleTablesReady) {
    lifecycleTablesReady = (async () => {
      try {
        await sql`ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS disposition text`;
        await sql`ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS forward_to text`;
        await sql`ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS service_ended_at timestamptz`;
        await sql`ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS data_delete_after timestamptz`;
        await sql`ALTER TABLE subscription_cancellations ADD COLUMN IF NOT EXISTS data_delete_alerted_at timestamptz`;
        await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS service_ended_at timestamptz`;
        await sql`
          CREATE TABLE IF NOT EXISTS number_lifecycle (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id uuid NOT NULL,
            phone_number_id uuid NULL,
            phone_e164 text NOT NULL,
            telnyx_number_id text NULL,
            mode text NOT NULL,
            forward_to text NULL,
            service_ends_at timestamptz NOT NULL,
            forward_until timestamptz NULL,
            out_of_service_until timestamptz NOT NULL,
            release_at timestamptz NOT NULL,
            release_status text NOT NULL DEFAULT 'scheduled',
            release_note text NULL,
            released_at timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS number_lifecycle_number_key ON number_lifecycle (phone_e164)`;
        await sql`CREATE INDEX IF NOT EXISTS number_lifecycle_release_idx ON number_lifecycle (release_at) WHERE released_at IS NULL`;
        return true;
      } catch (err) {
        console.error("[Cancellation] could not ensure lifecycle tables:", messageOf(err).slice(0, 200));
        lifecycleTablesReady = null; // retry on the next tick
        return false;
      }
    })();
  }
  return lifecycleTablesReady;
}

/** Test seam: forget the "tables exist" cache. */
export function resetLifecycleTableCache(): void {
  lifecycleTablesReady = null;
}

// ─── Numbers ────────────────────────────────────────────────────────────────

export interface OrgNumber {
  id: string;
  phoneNumber: string;
  telnyxNumberId: string | null;
}

/** The org's active numbers, E.164-normalised. This is what the dialog names. */
export async function listOrgNumbers(sql: SqlTag, organizationId: string): Promise<OrgNumber[]> {
  try {
    const rows = (await sql`
      SELECT id, phone_number, telnyx_number_id
      FROM phone_numbers
      WHERE organization_id = ${organizationId} AND is_active = true
      ORDER BY created_at
    `) as any[];
    return rows.map((r) => ({
      id: String(r.id),
      phoneNumber: String(r.phone_number || ""),
      telnyxNumberId: r.telnyx_number_id ? String(r.telnyx_number_id) : null,
    }));
  } catch (err) {
    console.error("[Cancellation] could not list numbers:", messageOf(err).slice(0, 160));
    return [];
  }
}

// ─── What the call path asks ────────────────────────────────────────────────

export type NumberDisposition =
  | { action: "forward"; forwardTo: string; until: string }
  | { action: "out_of_service"; until: string | null };

/**
 * The single question the voice path asks about a dialled number. `null` means "nothing to see
 * here, let the AI answer". Any read failure answers `null` too: a missing migration must never
 * stop a live business's phone from working.
 */
export async function readNumberDisposition(
  sql: SqlTag,
  phoneE164: string,
  now: Date = new Date()
): Promise<NumberDisposition | null> {
  const dialed = normalizeForwardNumber(phoneE164);
  if (!dialed) return null;
  let row: any = null;
  try {
    const rows = (await sql`
      SELECT mode, forward_to, forward_until, out_of_service_until, released_at
      FROM number_lifecycle
      WHERE phone_e164 = ${dialed}
      LIMIT 1
    `) as any[];
    row = rows[0] || null;
  } catch {
    return null;
  }
  if (!row) return null;
  if (row.released_at) return { action: "out_of_service", until: null };
  const t = now.getTime();
  const forwardUntil = row.forward_until ? new Date(row.forward_until).getTime() : NaN;
  if (row.mode === "forward" && row.forward_to && Number.isFinite(forwardUntil) && forwardUntil > t) {
    return { action: "forward", forwardTo: String(row.forward_to), until: new Date(forwardUntil).toISOString() };
  }
  return {
    action: "out_of_service",
    until: row.out_of_service_until ? new Date(row.out_of_service_until).toISOString() : null,
  };
}

/** True once this org's service has ended — reminders, callbacks and the booking page stop. */
export async function orgServiceEnded(sql: SqlTag, organizationId: string): Promise<boolean> {
  try {
    const rows = (await sql`SELECT service_ended_at FROM organizations WHERE id = ${organizationId} LIMIT 1`) as any[];
    return Boolean(rows[0]?.service_ended_at);
  } catch {
    return false;
  }
}

// ─── The sweep ──────────────────────────────────────────────────────────────

export interface ReleaseResult {
  ok: boolean;
  note?: string;
}

export interface LifecycleDeps {
  sql: SqlTag;
  now?: Date;
  /** Releases one number at the carrier. Injected so the sweep is testable without Telnyx. */
  releaseNumber?: (number: { phoneE164: string; telnyxNumberId: string | null }) => Promise<ReleaseResult>;
  /** One email to the owner about one org. Injected so nothing here knows how mail is sent. */
  notify?: (orgId: string, subject: string, body: string) => Promise<boolean> | boolean;
  /**
   * Numbers that must never be scheduled or released, whatever the org's subscription says —
   * the public demo line belongs to our own org and is not a customer's number.
   */
  skipNumbers?: string[];
}

export interface LifecycleResult {
  ended: number;
  released: number;
  blocked: number;
  failed: number;
  dueForDeletion: number;
  error?: string;
}

/**
 * Runs on the existing in-process 5-minute timer. Three passes, each idempotent:
 *   1. end service for orgs whose paid month is over (or whose Stripe subscription was deleted);
 *   2. release numbers whose out-of-service window has closed;
 *   3. tell the owner which cancelled customers' data is now past 90 days.
 *
 * Step 3 does NOT delete anything. Deleting a business's calls and bookings is irreversible and
 * there is no backup, so the sweep reports it and a human confirms — the data is still readable
 * exactly as the spec promises, and nothing is destroyed by a timer.
 */
export async function processCancellationLifecycle(deps: LifecycleDeps): Promise<LifecycleResult> {
  const result: LifecycleResult = { ended: 0, released: 0, blocked: 0, failed: 0, dueForDeletion: 0 };
  const now = deps.now || new Date();
  const nowIso = now.toISOString();
  const notify = deps.notify || (() => false);
  const skipped = (deps.skipNumbers || []).map((n) => normalizeForwardNumber(n) || n);

  if (!(await ensureLifecycleTables(deps.sql))) {
    return { ...result, error: "lifecycle tables unavailable" };
  }

  // ── 1. End service ───────────────────────────────────────────────────────
  let due: any[] = [];
  try {
    due = (await deps.sql`
      SELECT c.id, c.organization_id, c.effective_at, c.disposition, c.forward_to
      FROM subscription_cancellations c
      JOIN organizations o ON o.id = c.organization_id
      WHERE c.resumed_at IS NULL
        AND c.service_ended_at IS NULL
        AND c.effective_at IS NOT NULL
        AND c.effective_at <= ${nowIso}::timestamptz
        AND o.service_ended_at IS NULL
      LIMIT 50
    `) as any[];
  } catch (err) {
    console.error("[Cancellation] end-service read failed:", messageOf(err).slice(0, 160));
  }

  // A Stripe subscription deleted with no cancellation row of ours (cancelled in the Stripe
  // portal, a Carm account, an old row): service ends at the period end, calls go nowhere.
  let orphaned: any[] = [];
  try {
    orphaned = (await deps.sql`
      SELECT s.organization_id,
             COALESCE(s.current_period_end, s.canceled_at, s.updated_at) AS effective_at
      FROM subscriptions s
      JOIN organizations o ON o.id = s.organization_id
      WHERE s.status = 'canceled'
        AND COALESCE(s.current_period_end, s.canceled_at, s.updated_at) <= ${nowIso}::timestamptz
        AND o.service_ended_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM subscription_cancellations c
          WHERE c.organization_id = s.organization_id AND c.resumed_at IS NULL
        )
      LIMIT 50
    `) as any[];
  } catch (err) {
    console.error("[Cancellation] cancelled-subscription read failed:", messageOf(err).slice(0, 160));
  }

  const endings = [
    ...due.map((r) => ({
      cancellationId: String(r.id),
      organizationId: String(r.organization_id),
      effectiveAt: r.effective_at,
      disposition: normalizeDisposition(r.disposition),
      forwardTo: r.forward_to ? String(r.forward_to) : null,
    })),
    ...orphaned.map((r) => ({
      cancellationId: null as string | null,
      organizationId: String(r.organization_id),
      effectiveAt: r.effective_at,
      disposition: "nowhere" as CancelDisposition,
      forwardTo: null as string | null,
    })),
  ];

  for (const ending of endings) {
    try {
      // Claim the org first: one UPDATE, so two ticks (or two servers) cannot both end it.
      const claimed = (await deps.sql`
        UPDATE organizations
        SET service_ended_at = ${ending.effectiveAt}, updated_at = NOW()
        WHERE id = ${ending.organizationId} AND service_ended_at IS NULL
        RETURNING id
      `) as any[];
      if (!claimed || claimed.length === 0) continue;

      const numbers = (await listOrgNumbers(deps.sql, ending.organizationId)).filter(
        (n) => !skipped.includes(normalizeForwardNumber(n.phoneNumber) || n.phoneNumber)
      );
      const plan = planNumberLifecycle({
        mode: ending.disposition,
        forwardTo: ending.forwardTo,
        serviceEndsAt: ending.effectiveAt,
        numbers: numbers.map((n) => n.phoneNumber),
      });
      for (const row of plan) {
        const match = numbers.find((n) => n.phoneNumber === row.phoneE164);
        await deps.sql`
          INSERT INTO number_lifecycle
            (organization_id, phone_number_id, phone_e164, telnyx_number_id, mode, forward_to,
             service_ends_at, forward_until, out_of_service_until, release_at)
          VALUES (${ending.organizationId}, ${match?.id || null}, ${row.phoneE164},
                  ${match?.telnyxNumberId || null}, ${row.mode}, ${row.forwardTo},
                  ${row.serviceEndsAt}, ${row.forwardUntil}, ${row.outOfServiceUntil}, ${row.releaseAt})
          ON CONFLICT (phone_e164) DO NOTHING
        `;
      }
      const deleteAfter = new Date(new Date(ending.effectiveAt).getTime() + DATA_RETENTION_DAYS * DAY_MS).toISOString();
      if (ending.cancellationId) {
        await deps.sql`
          UPDATE subscription_cancellations
          SET service_ended_at = ${nowIso}::timestamptz, data_delete_after = ${deleteAfter}, updated_at = NOW()
          WHERE id = ${ending.cancellationId}
        `;
      }

      const list = numbers.map((n) => n.phoneNumber).join(", ") || "(no numbers)";
      const forwardLine =
        plan[0] && plan[0].mode === "forward" && plan[0].forwardTo
          ? `Calls to ${list} now forward to ${plan[0].forwardTo} until ${lastPaidDay(plan[0].forwardUntil || "")}, then the out-of-service message.`
          : `Calls to ${list} now hear the out-of-service message.`;
      await notify(
        ending.organizationId,
        `Service ended: ${list}`,
        [
          `Service for this business ended on ${lastPaidDay(ending.effectiveAt)}.`,
          forwardLine,
          `The number is released on ${lastPaidDay(plan[0]?.releaseAt || deleteAfter)} unless it is a ported number, which is never released automatically.`,
          `Booking page, reminders, reminder calls and missed-call callbacks are off for this business.`,
          `Their data stays readable until ${lastPaidDay(deleteAfter)}.`,
        ].join("\n")
      );
      result.ended++;
    } catch (err) {
      result.failed++;
      console.error(`[Cancellation] could not end service for org ${ending.organizationId}:`, messageOf(err).slice(0, 200));
    }
  }

  // ── 2. Release ───────────────────────────────────────────────────────────
  let releasable: any[] = [];
  try {
    releasable = (await deps.sql`
      SELECT id, organization_id, phone_e164, telnyx_number_id, release_status
      FROM number_lifecycle
      WHERE released_at IS NULL
        AND release_at <= ${nowIso}::timestamptz
        AND release_status IN ('scheduled', 'failed')
      LIMIT 50
    `) as any[];
  } catch (err) {
    console.error("[Cancellation] release read failed:", messageOf(err).slice(0, 160));
  }

  for (const row of releasable) {
    const numberId = String(row.id);
    const phoneE164 = String(row.phone_e164);
    try {
      // NEVER release a number for an org that is still being served (a resumed cancellation).
      const orgRows = (await deps.sql`
        SELECT o.service_ended_at
        FROM organizations o
        WHERE o.id = ${String(row.organization_id)}
        LIMIT 1
      `) as any[];
      if (!orgRows[0]?.service_ended_at) continue;
      // A number we never release: our own demo line, or anything else the caller told us to skip.
      if (skipped.includes(phoneE164)) continue;
      // Belt and braces with the resume path: an org with a live subscription is still active and
      // its number is never taken away.
      const liveRows = (await deps.sql`
        SELECT 1 AS one FROM subscriptions
        WHERE organization_id = ${String(row.organization_id)}
          AND status = 'active'
        LIMIT 1
      `) as any[];
      if (liveRows.length > 0) continue;

      // A ported number belongs to the customer. It is never released automatically.
      const pnRows = (await deps.sql`
        SELECT metadata FROM phone_numbers WHERE phone_number = ${phoneE164} LIMIT 1
      `) as any[];
      const meta = (pnRows[0]?.metadata || {}) as any;
      if (String(meta.status || "") === "pending_port") {
        const note = "ported number — never auto-released, the team handles it by hand";
        const changed = (await deps.sql`
          UPDATE number_lifecycle
          SET release_status = 'blocked_pending_port', release_note = ${note}, updated_at = NOW()
          WHERE id = ${numberId} AND release_status <> 'blocked_pending_port'
          RETURNING id
        `) as any[];
        if (changed && changed.length) {
          result.blocked++;
          await notify(
            String(row.organization_id),
            `Number not released (ported): ${phoneE164}`,
            `This number was ported in by the customer, so it was NOT released. Nothing else is needed until the customer asks for the port.`
          );
        }
        continue;
      }

      // Claim before the carrier call: a second tick steps over a row already being released.
      const claimed = (await deps.sql`
        UPDATE number_lifecycle
        SET release_status = 'releasing', updated_at = NOW()
        WHERE id = ${numberId} AND released_at IS NULL AND release_status IN ('scheduled', 'failed')
        RETURNING id
      `) as any[];
      if (!claimed || claimed.length === 0) continue;

      const released = deps.releaseNumber
        ? await deps.releaseNumber({ phoneE164, telnyxNumberId: row.telnyx_number_id ? String(row.telnyx_number_id) : null })
        : { ok: false, note: "no carrier configured" };

      if (!released.ok) {
        await deps.sql`
          UPDATE number_lifecycle
          SET release_status = 'failed', release_note = ${String(released.note || "release failed").slice(0, 400)}, updated_at = NOW()
          WHERE id = ${numberId}
        `;
        result.failed++;
        continue;
      }

      await deps.sql`
        UPDATE number_lifecycle
        SET release_status = 'released', released_at = NOW(), release_note = ${String(released.note || "released at the carrier").slice(0, 400)}, updated_at = NOW()
        WHERE id = ${numberId}
      `;
      try {
        await deps.sql`
          UPDATE phone_numbers
          SET is_active = false,
              metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('status', 'released', 'released_at', NOW()),
              updated_at = NOW()
          WHERE phone_number = ${phoneE164}
        `;
      } catch (err) {
        console.error("[Cancellation] number released but the row was not marked:", messageOf(err).slice(0, 160));
      }
      result.released++;
      await notify(
        String(row.organization_id),
        `Number released: ${phoneE164}`,
        [
          `The number ${phoneE164} was released at Telnyx on ${lastPaidDay(new Date())}.`,
          `Organization: ${String(row.organization_id)}`,
          `It stopped answering on ${lastPaidDay(row.service_ends_at || nowIso)}.`,
        ].join("\n")
      );
    } catch (err) {
      result.failed++;
      console.error(`[Cancellation] release of ${phoneE164} failed:`, messageOf(err).slice(0, 200));
    }
  }

  // ── 3. Data past the 90-day mark (reported, never deleted by a timer) ─────
  try {
    const dueRows = (await deps.sql`
      SELECT c.organization_id, c.data_delete_after
      FROM subscription_cancellations c
      WHERE c.data_delete_after IS NOT NULL
        AND c.data_delete_after <= ${nowIso}::timestamptz
        AND c.data_delete_alerted_at IS NULL
      LIMIT 50
    `) as any[];
    for (const row of dueRows) {
      const claimed = (await deps.sql`
        UPDATE subscription_cancellations
        SET data_delete_alerted_at = NOW(), updated_at = NOW()
        WHERE organization_id = ${String(row.organization_id)}
          AND data_delete_alerted_at IS NULL
          AND data_delete_after IS NOT NULL
          AND data_delete_after <= ${nowIso}::timestamptz
        RETURNING id
      `) as any[];
      if (!claimed || claimed.length === 0) continue;
      result.dueForDeletion++;
      await notify(
        String(row.organization_id),
        `Data deletion due: ${String(row.organization_id)}`,
        `This cancelled customer's data has been readable for 90 days (since ${lastPaidDay(row.data_delete_after)}). Export it for them if they ask, then delete it by hand.`
      );
    }
  } catch (err) {
    console.error("[Cancellation] retention read failed:", messageOf(err).slice(0, 160));
  }

  return result;
}

// ─── The customer email ─────────────────────────────────────────────────────

/**
 * What the customer is told when they cancel. Same words as the dialog, so nothing in the email
 * can contradict the screen they just used, plus the one line that offers to keep the number
 * somewhere else (porting is handled by hand — it is not built).
 */
export function cancellationEmail(input: {
  businessName: string;
  numbers: string[];
  paidUntil: string | null;
  disposition: CancelDisposition;
  forwardTo: string | null;
  forwardUntil: string | null;
  releaseOn: string | null;
}): { subject: string; body: string } {
  const numbers = input.numbers.length ? input.numbers.join(", ") : "your number";
  const until = lastPaidDay(input.paidUntil) || "the last day of the month you have paid for";
  const lines = [
    `Your subscription is cancelled. ${input.businessName} stays on until ${until} — nothing is charged after that.`,
    "",
  ];
  if (input.disposition === "forward" && input.forwardTo) {
    lines.push(`After ${until}, calls to ${numbers} forward to ${input.forwardTo} until ${lastPaidDay(input.forwardUntil)}.`);
    lines.push(`After that they hear a short "this number is no longer in service" message for two weeks, then the number is released.`);
  } else {
    lines.push(`After ${until}, calls to ${numbers} hear a short "this number is no longer in service" message for two weeks.`);
    lines.push(`Then the number is released.`);
  }
  lines.push("");
  lines.push(`If you want to keep ${input.numbers.length > 1 ? "one of these numbers" : "this number"} somewhere else, reply to this email and we will arrange it.`);
  lines.push("");
  lines.push(`Your data stays readable until 90 days after ${until}; ask us for an export any time before then.`);
  return {
    subject: `Your ${input.businessName} subscription is cancelled`,
    body: lines.join("\n"),
  };
}
