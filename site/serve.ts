// Production server — AI Receptionist
import handler from "./dist/server/server.js";
import { neon } from "@neondatabase/serverless";

const PORT = 3000;
const HOST = "0.0.0.0";
const CLIENT_DIR = `${import.meta.dir}/dist/client`;

// ── Gemini ───────────────────────────────────────────────────────────────────
async function aiRespond(userText: string): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) return "";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: "You are a professional AI receptionist. Keep responses BRIEF (1-2 sentences). Be friendly." }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
        }),
      }
    );
    const data = await res.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch { return ""; }
}

// ── Telnyx API ───────────────────────────────────────────────────────────────
const TELNYX = "https://api.telnyx.com/v2";
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID || "";
function th() { return { Authorization: `Bearer ${process.env.TELNYX_API_KEY || ""}`, "Content-Type": "application/json" }; }

// ── Database-driven org lookup by phone number ────────────────────────────
async function getOrgByPhoneNumber(phoneNumber: string): Promise<{ name: string; orgId: string } | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT o.name, o.id as org_id
      FROM phone_numbers pn
      JOIN organizations o ON o.id = pn.organization_id
      WHERE pn.phone_number = ${phoneNumber}
        AND pn.is_active = true
      LIMIT 1
    `;
    if (rows[0]) return { name: rows[0].name as string, orgId: rows[0].org_id as string };
    return null;
  } catch (err) {
    console.error("[DB] phone lookup failed:", String(err).slice(0, 100));
    return null;
  }
}

function buildGreeting(orgName: string): string {
  return `Hello, you've reached ${orgName}. Press 1 to book an appointment, press 2 for services and pricing, press 3 to speak with a team member, or just tell me how I can help you.`;
}

function buildShortPrompt(): string {
  return `Press 1 for appointments, 2 for services, 3 for a team member, or tell me how I can help.`;
}

async function cmd(cid: string, action: string, body: any = {}) {
  const res = await fetch(`${TELNYX}/calls/${cid}/actions/${action}`, { method: "POST", headers: th(), body: JSON.stringify(body) });
  const d = await res.json();
  const ok = !d.errors;
  if (!ok) console.log(`${action} ERR:`, JSON.stringify(d.errors).slice(0, 150));
  return ok;
}

async function promptAndWait(cid: string, text: string) {
  return cmd(cid, "gather", {
    type: "dtmf",
    payload: text,
    voice: "female",
    language: "en-US",
    minimum_digits: 1,
    maximum_digits: 1,
    timeout_millis: 8000,
  });
}

async function speakOnly(cid: string, text: string) {
  return cmd(cid, "speak", { payload: text, voice: "female", language: "en-US" });
}

// ── Telnyx outbound dial ──────────────────────────────────────────────────
async function dialOutbound(toNumber: string, fromNumber: string, webhookUrl: string): Promise<string | null> {
  if (!TELNYX_CONNECTION_ID) {
    console.error("TELNYX_CONNECTION_ID not set — cannot dial outbound");
    return null;
  }
  const res = await fetch(`${TELNYX}/calls`, {
    method: "POST", headers: th(),
    body: JSON.stringify({
      connection_id: TELNYX_CONNECTION_ID,
      to: toNumber,
      from: fromNumber,
      webhook_url: webhookUrl,
    }),
  });
  const d = await res.json() as any;
  if (d.errors) { console.error("dialOutbound ERR:", JSON.stringify(d.errors).slice(0, 200)); return null; }
  return d.data?.call_control_id || null;
}

// ── Telnyx number lookup ──────────────────────────────────────────────────
async function lookupNumber(phoneNumber: string) {
  const res = await fetch(`${TELNYX}/phone_numbers/${phoneNumber}`, { headers: th() });
  const d = await res.json() as any;
  return d.data || null;
}

// ── Free PORT ────────────────────────────────────────────────────────────────
const freePort = `for _ in $(seq 1 25); do pids=$(lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true); if [ -z "$pids" ]; then exit 0; fi; kill $pids 2>/dev/null || true; sleep 0.2; done`;

for (let attempt = 1; ; attempt++) {
  await Bun.$`sudo sh -c ${freePort}`.quiet().nothrow();
  try {
    Bun.serve({
      port: PORT, hostname: HOST,
      async fetch(req) {
        const { pathname } = new URL(req.url);

        if (pathname === "/api/telnyx/voice" && req.method === "POST") {
          try {
            const p = await req.json();
            const ev = p.data?.event_type || "";
            const cid = p.data?.payload?.call_control_id || "";

            // ── New call: answer → speak greeting → gather ───────
            if (ev === "call.initiated" || ev === "call_initiated") {
              const toNumber = p.data?.payload?.to || "";
              const org = await getOrgByPhoneNumber(toNumber);
              const companyName = org?.name || process.env.COMPANY_NAME || "ReceptionAI";
              const greeting = buildGreeting(companyName);
              await cmd(cid, "answer");
              setTimeout(async () => {
                await speakOnly(cid, greeting);
              }, 600);
            }

            // ── Speak ended → gather DTMF ─────────────────────────
            else if (ev === "call.speak.ended") {
              setTimeout(() => cmd(cid, "gather", {
                type: "dtmf",
                minimum_digits: 1,
                maximum_digits: 1,
                timeout_millis: 8000,
              }), 300);
            }

            // ── DTMF pressed ───────────────────────────────────────
            else if (ev === "call.dtmf.received" || ev === "dtmf.received") {
              const digit = p.data?.payload?.digit || "";
              console.log(`DTMF: ${digit} — call ${cid.slice(-8)}`);

              if (digit === "1") {
                const ai = await aiRespond("A caller wants to book an appointment. Ask what service they need and when. Keep it to 1-2 sentences.");
                const reply = ai || "I can help you book an appointment. What type of service do you need and what date works best?";
                await speakOnly(cid, reply);
                // speak.ended will re-gather automatically
              }

              else if (digit === "2") {
                const ai = await aiRespond("A caller is asking about services and pricing. Explain we're a 24/7 AI receptionist with plans starting at $99/month. Keep it brief.");
                const reply = ai || "We're a 24/7 AI virtual receptionist. Plans start at $99 per month for Starter. Would you like more details?";
                await speakOnly(cid, reply);
                // speak.ended will re-gather automatically
              }

              else if (digit === "3") {
                await speakOnly(cid, "Let me transfer you to a team member now. Thank you for calling. Goodbye.");
                setTimeout(() => cmd(cid, "hangup"), 3000);
              }

              else {
                await speakOnly(cid, "I didn't get that. " + buildShortPrompt());
              }
            }

            // ── Gather ended (timeout, no DTMF) ─────────────────────
            else if (ev === "call.gather.ended") {
              setTimeout(() => speakOnly(cid, "I didn't get a response. " + buildShortPrompt()), 500);
            }

            // ── Hangup ──────────────────────────────────────────────
            else if (ev === "call.hangup" || ev === "call.hungup") {
              console.log(`Hangup: ${cid}`);
            }

            return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }

        // SMS — Telnyx Messaging
        if (pathname === "/api/telnyx/sms" && req.method === "POST") {
          try {
            const p = await req.json();
            const from = p.data?.payload?.from?.phone_number || "";
            const to = p.data?.payload?.to?.[0]?.phone_number || "";
            const text = p.data?.payload?.text || "";

            console.log(`[Telnyx SMS] From: ${from}, Text: "${text.slice(0, 80)}"`);

            const ai = await aiRespond(
              `You are an AI receptionist. A caller sent this SMS: "${text}". Your number is ${to}. Reply helpfully in 1-2 sentences.`
            );
            const reply = ai || "Thanks for reaching out! A team member will reply shortly.";

            // Send reply via Telnyx Messaging API
            await fetch(`${TELNYX}/messages`, {
              method: "POST", headers: th(),
              body: JSON.stringify({
                from: to,
                to: from,
                text: reply,
                ...(TELNYX_CONNECTION_ID ? { messaging_profile_id: TELNYX_CONNECTION_ID } : {}),
              }),
            });

            return new Response(JSON.stringify({ status: "replied" }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err) {
            return new Response(JSON.stringify({ status: "error" }),
              { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }

        // ── BYON: Bring Your Own Number ─────────────────────────
        if (pathname === "/api/phone-numbers/bring-your-own" && req.method === "POST") {
          try {
            const body = await req.json() as {
              phoneNumber?: string;
              organizationId?: string;
              label?: string;
            };
            const { phoneNumber, organizationId, label } = body;

            if (!phoneNumber || !organizationId) {
              return new Response(JSON.stringify({ error: "phoneNumber and organizationId required" }),
                { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Verify the number exists in Telnyx
            const tnData = await lookupNumber(phoneNumber);
            if (!tnData) {
              return new Response(JSON.stringify({ error: "Phone number not found in Telnyx account" }),
                { status: 404, headers: { "Content-Type": "application/json" } });
            }

            // Store in database
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl) {
              const sql = neon(dbUrl);
              await sql`
                INSERT INTO phone_numbers (id, organization_id, phone_number, label, provider, telnyx_number_id, is_active, capabilities)
                VALUES (gen_random_uuid(), ${organizationId}, ${phoneNumber}, ${label || 'BYON'}, 'telnyx', ${tnData.id || null}, true, '{"voice":true,"sms":true,"mms":false}'::jsonb)
              `;
            } else {
              console.log(`[BYON] No DATABASE_URL — would store: ${phoneNumber} → org ${organizationId}`);
            }

            // Configure Telnyx webhook for this number
            if (TELNYX_CONNECTION_ID) {
              const webhookUrl = `https://${req.headers.get("host") || "localhost:3000"}/api/telnyx/voice`;
              await fetch(`${TELNYX}/phone_numbers/${tnData.id}/voice`, {
                method: "PATCH", headers: th(),
                body: JSON.stringify({
                  connection_id: TELNYX_CONNECTION_ID,
                  webhook_url: webhookUrl,
                }),
              });
            }

            return new Response(JSON.stringify({
              success: true,
              phoneNumber,
              telnyxNumberId: tnData.id,
              message: "Phone number registered. Voice and SMS webhooks configured.",
            }), { status: 201, headers: { "Content-Type": "application/json" } });

          } catch (err) {
            console.error("[BYON] Error:", String(err).slice(0, 200));
            return new Response(JSON.stringify({ error: "Failed to register phone number" }),
              { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        // Static + SSR
        if (pathname !== "/") {
          const file = Bun.file(CLIENT_DIR + pathname);
          if (await file.exists()) return new Response(file);
        }
        return (handler as any).fetch(req);
      },
    });
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

console.log(`team-site serving on http://${HOST}:${String(PORT)}`);
