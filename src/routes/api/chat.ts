/**
 * POST /api/chat
 *
 * Gemini-powered chat endpoint for the web chat widget.
 * Uses gemini-flash-latest (same model id as serve.ts) with full conversation
 * history, a detailed system prompt, and the same 300-char sentence-boundary
 * cap production applies, so dev/preview and production answer identically.
 *
 * Body: { message: string, history?: {role:"user"|"model", text:string}[], lang?: "en" | "es" }
 * Response: { reply: string }
 *
 * No auth required — this is for the public-facing demo widget.
 */
import { createFileRoute } from "@tanstack/react-router";
import { logConversation, getReviewedKnowledge, isFallbackResponse } from "~/lib/chat-logs";

export const Route = createFileRoute("/api/chat")({});

// Product facts — EN and ES must carry THE SAME facts (full parity): every English
// fact has a fluent Spanish equivalent below. Never add a fact to one language only,
// and keep every line true today (future features are marked "coming soon").
const FACT_LINES_EN = [
  "- Plans: Starter $99/mo (1 line, 500 AI-min), Growth $199/mo (2 lines, 2,000 AI-min), Scale $399/mo (unlimited lines, 10,000+ AI-min).",
  "- No long-term contracts: every plan is month-to-month. Cancel anytime before the next renewal — it takes effect at the end of the current paid month, with no cancellation fee.",
  "- How to cancel: from your account dashboard (Settings → Billing → cancel) or email hello@receptionai.store.",
  "- Billing: the first month is charged at checkout, then it renews monthly automatically. Founder pricing: 50% off the first 3 months for the first 100 customers.",
  "- Live today: answers calls 24/7 in English and Spanish; books appointments by phone and on the web; sends SMS confirmations and reminders; sends a post-call SMS summary to the owner after every call; recognizes returning callers.",
  "- Live today: catches voicemail and sends missed-call alerts; web chat; SMS messaging; “talk to the owner” call transfer (press 3); built-in calendar with preset business hours (no Google account needed).",
  "- Free live demo line: call (727) 966-7556.",
  "- Support: email hello@receptionai.store.",
  "- Coming soon (NOT live yet — say so honestly if asked): WhatsApp and Facebook messaging, a unified multi-channel inbox, an advanced analytics dashboard, per-member team schedules and routing, call-recording audio playback, custom call scripts, and sentiment-based smart handoff.",
  "- Scale plan: 24/7 priority support with same-day human response; web-chat requests for a human or support are passed to the team.",
];
const FACT_LINES_ES = [
  "- Planes: Starter $99/mes (1 línea, 500 min IA), Growth $199/mes (2 líneas, 2000 min IA), Scale $399/mes (líneas ilimitadas, más de 10,000 min IA).",
  "- Sin contratos a largo plazo: todos los planes son mes a mes. Puedes cancelar cuando quieras antes de la próxima renovación — se hace efectivo al final del mes que ya pagaste, sin cargo por cancelación.",
  "- Cómo cancelar: desde el panel de tu cuenta (Configuración → Facturación → cancelar) o escribiendo a hello@receptionai.store.",
  "- Facturación: el primer mes se cobra al momento de la compra y después se renueva automáticamente cada mes. Precio de fundador: 50% de descuento los primeros 3 meses para los primeros 100 clientes.",
  "- Disponible hoy: contesta llamadas 24/7 en inglés y español; agenda citas por teléfono y en la web; envía confirmaciones y recordatorios por SMS; manda al dueño un resumen por SMS después de cada llamada; reconoce a los clientes que vuelven a llamar.",
  "- Disponible hoy: recibe mensajes de voz y avisa de llamadas perdidas; chat en la web; mensajería por SMS; transferencia “hablar con el dueño” (presione 3); calendario incorporado con el horario de atención ya configurado (sin cuenta de Google).",
  "- Línea de demostración gratuita: llama al (727) 966-7556.",
  "- Soporte: escribe a hello@receptionai.store.",
  "- Próximamente (TODAVÍA no disponible — dilo con honestidad si te preguntan): mensajería por WhatsApp y Facebook, bandeja de entrada unificada multicanal, panel de analíticas avanzadas, horarios y enrutamiento por miembro del equipo, reproducción del audio de las grabaciones de llamadas, guiones de llamada personalizados y traspaso inteligente según el sentimiento del cliente.",
  "- Plan Scale: soporte prioritario 24/7 con respuesta humana el mismo día; las solicitudes de una persona o de soporte por el chat de la web se pasan al equipo.",
];

const GUARDRAIL_EN =
  "Honesty rule: never claim that a text, email, call, or message has been or will be sent unless the system actually sends it. If a visitor leaves a phone number or email for contact, say it has been noted for the team — do not promise specifics or a time. Never announce that you are sending something to the owner; if a visitor asks to be contacted, confirm the note and move on.";

const GUARDRAIL_ES =
  "Regla de honestidad: nunca afirmes que se envió o se enviará un texto, correo, llamada o mensaje a menos que el sistema realmente lo envíe. Si alguien deja un teléfono o correo para contacto, di que quedó anotado para nuestro equipo — no prometas detalles ni un horario. Nunca anuncies que le vas a enviar algo al dueño; si te piden que los contacten, confirma la nota y sigue adelante.";

const SYSTEM_PROMPT_EN = `You are ReceptionAI, a 24/7 AI receptionist for small businesses (HVAC, plumbing, dental, legal, etc). Keep responses to 2-3 sentences. Be friendly and helpful.

Product facts (use ONLY these; do not invent prices or features):
${FACT_LINES_EN.join("\n")}

${GUARDRAIL_EN}`;

const SYSTEM_PROMPT_ES = `Eres ReceptionAI, un recepcionista IA 24/7 para negocios pequenos (HVAC, plomeria, dental, legal, etc). Respuestas de 2-3 frases. Amigable y util.

Datos del producto (usa SOLO estos; no inventes precios ni funciones):
${FACT_LINES_ES.join("\n")}

${GUARDRAIL_ES}`;

// Reply-length cap, identical to serve.ts: cut at a real sentence end when one
// sits in the first 300 chars (preferring >=150 so the answer stays useful),
// otherwise cut at a word boundary and mark it with an ellipsis. Never cuts
// mid-word, and never appends "..." after a genuine sentence end.
const REPLY_MAX_CHARS = 300;
const REPLY_MIN_SENTENCE = 150;
function capReply(raw: string): string {
  const text = raw.trim();
  if (text.length <= REPLY_MAX_CHARS) return text;
  const head = text.slice(0, REPLY_MAX_CHARS);
  let sentenceEnd = -1;
  for (let i = head.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "." || ch === "!" || ch === "?" || ch === "\u2026") {
      const next = text[i + 1];
      if (next === undefined || /\s/.test(next)) { sentenceEnd = i; break; }
    }
  }
  if (sentenceEnd >= REPLY_MIN_SENTENCE - 1) return text.slice(0, sentenceEnd + 1).trim();
  const space = text.lastIndexOf(" ", REPLY_MAX_CHARS - 1);
  const cutAt = space > 0 ? space : REPLY_MAX_CHARS - 1;
  return text.slice(0, cutAt).trim().replace(/[.,;:!?]+$/, "") + "\u2026";
}

// Smart keyword-based fallback when Gemini is unavailable
function smartReply(message: string, lang: string): string {
  const msg = message.toLowerCase();
  const isEs = lang === "es";

  // Contract + cancellation first: "plan"/"planes" is a pricing keyword, so a
  // contract question would otherwise be answered with prices.
  if (msg.includes("contract") || msg.includes("contrato") || msg.includes("commitment") || msg.includes("binding") || msg.includes("compromiso") || msg.includes("a plazo")) {
    return isEs
      ? "Sin contratos — todos los planes son mensuales y puedes cancelar cuando quieras."
      : "No contracts — every plan is month-to-month and you can cancel anytime.";
  }
  if (msg.includes("cancel") || msg.includes("darse de baja")) {
    return isEs
      ? "Puedes cancelar cuando quieras desde tu panel (Facturación → cancelar) o escribiendo a hello@receptionai.store — sin cargos."
      : "Cancel anytime from your dashboard (Billing → cancel) or email hello@receptionai.store — no cancellation fees.";
  }
  if (msg.includes("price") || msg.includes("pricing") || msg.includes("cost") || msg.includes("precio") || msg.includes("costo") || msg.includes("cuanto")) {
    return isEs
      ? "Starter: $99/mes (1 linea, 500 min IA), Growth: $199/mes (2 lineas, 2000 min), Scale: $399/mes (ilimitado). Quieres registrarte?"
      : "Starter: $99/mo (1 line, 500 AI-min), Growth: $199/mo (2 lines, 2000 min), Scale: $399/mo (unlimited). Founders get 50% off their first 3 months (limited to the first 100 customers). Want to sign up?";
  }
  if (msg.includes("demo") || msg.includes("try") || msg.includes("test") || msg.includes("probar")) {
    return isEs
      ? "Puedes probar ReceptionAI ahora mismo! Llama al (727) 966-7556 y habla con nuestro recepcionista IA. O registrate en receptionai.store/signup — los fundadores obtienen 50% de descuento los primeros 3 meses."
      : "You can try ReceptionAI right now! Call (727) 966-7556 and talk to our AI receptionist. Or sign up at receptionai.store/signup — founders get 50% off their first 3 months.";
  }
  if (msg.includes("feature") || msg.includes("do") || msg.includes("what") || msg.includes("que hace") || msg.includes("funcion")) {
    return isEs
      ? "Responde llamadas/textos/chats 24/7 en ingles y espanol. Programa citas, envia recordatorios, calendario incorporado (sin Google OAuth). Resumenes SMS al dueno tras cada llamada."
      : "Answers calls/texts/chats 24/7 in English & Spanish. Auto-schedules appointments, sends reminders, built-in calendar (no Google OAuth). Post-call SMS summaries to the owner.";
  }
  if (msg.includes("signup") || msg.includes("register") || msg.includes("start") || msg.includes("registr") || msg.includes("comenzar")) {
    return isEs
      ? "Registrate en receptionai.store/signup. Elige un plan y comienza hoy — los fundadores ahorran 50% los primeros 3 meses."
      : "Sign up at receptionai.store/signup. Pick a plan and get started — founders save 50% on their first 3 months.";
  }
  if (msg.includes("contact") || msg.includes("phone") || msg.includes("email") || msg.includes("contacto") || msg.includes("telefono")) {
    return "Call us at (727) 966-7556 or email hello@receptionai.store. We'd love to help!";
  }
  if (msg.includes("hi") || msg.includes("hello") || msg.includes("hey") || msg.includes("hola")) {
    return isEs
      ? "Hola! Soy el recepcionista IA de ReceptionAI. Respondo llamadas y programo citas 24/7. Como puedo ayudarte? Quieres conocer nuestros precios o probar una demo?"
      : "Hi there! I'm ReceptionAI — I answer calls and book appointments 24/7 for small businesses. How can I help? Want to hear about pricing or try a demo?";
  }
  if (msg.includes("calendar") || msg.includes("schedule") || msg.includes("booking") || msg.includes("cita") || msg.includes("calendario")) {
    return isEs
      ? "Nuestro calendario incorporado no necesita Google OAuth. Configura tu horario y listo. Los clientes reservan por telefono, web chat o SMS. Con confirmaciones y recordatorios automaticos."
      : "Our built-in calendar needs no Google OAuth. Set your business hours once and you're done. Customers book via phone, web chat, or SMS. Auto confirmations and reminders included.";
  }

  // Default response
  return isEs
    ? "Soy el recepcionista IA de ReceptionAI — atiendo llamadas, programo citas y gestiono mensajes 24/7. Precios desde $99/mes. Preguntame sobre funciones, precios o como empezar!"
    : "I'm ReceptionAI — I handle calls, book appointments, and manage messages 24/7 for service businesses. Plans from $99/mo with founder pricing. Ask me about features, pricing, or how to get started!";
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as {
      message?: string;
      history?: { role: "user" | "model"; text: string }[];
      lang?: string;
      sessionId?: string;
    };
    const { message = "", history = [], lang = "en", sessionId = "anonymous" } = body;

    if (!message.trim()) {
      return new Response(
        JSON.stringify({ reply: "" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Try Gemini, fall back to smart keyword responses
    const apiKey = process.env.GEMINI_API_KEY || "";

    let failReason = apiKey ? "" : "no gemini api key";
    // Only attempt Gemini if key looks valid (starts with AIza)
    if (apiKey) {
      const startedAt = Date.now();
      try {
        const systemPrompt = lang === "es" ? SYSTEM_PROMPT_ES : SYSTEM_PROMPT_EN;
        const contents: { role: string; parts: { text: string }[] }[] = [];
        for (const h of history) {
          contents.push({ role: h.role, parts: [{ text: h.text }] });
        }
        contents.push({ role: "user", parts: [{ text: message }] });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents,
              generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
            }),
            signal: controller.signal,
          },
        );

        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as any;
          const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const reply = capReply(rawReply);
          if (reply) {
            logConversation(sessionId, message, reply, lang);
            return new Response(
              JSON.stringify({ reply }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          failReason = "gemini returned an empty reply";
        } else {
          failReason = "gemini status=" + res.status;
          console.error("[chat] gemini error: status=" + res.status + " ms=" + (Date.now() - startedAt));
        }
      } catch {
        failReason = "gemini network/abort";
        console.error("[chat] gemini error: status=network/abort ms=" + (Date.now() - startedAt));
      }
    }
    // Fallback keyword responder (only when the model did not answer)
    if (failReason) console.warn("[chat] fallback: " + failReason);
    const reply = smartReply(message, lang);
    logConversation(sessionId, message, reply, lang);
    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[Chat API]", String(err).slice(0, 200));
    return new Response(
      JSON.stringify({ reply: "Something went wrong. Please try again." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
}
