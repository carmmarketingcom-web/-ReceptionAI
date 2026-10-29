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

  // Accent-insensitive whole-word matching: "qué hacen" must match "que hacen" and
  // "facturación" must match "facturacion". Substring matching answered the wrong
  // question (e.g. "do" inside "window", "plan" inside "planning").
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const nmsg = norm(msg);
  const has = (...words: string[]) => words.some((w) => new RegExp(`\\b${norm(w)}\\b`, "i").test(nmsg));
  // Branch ORDER matters: contract/cancellation sit above pricing ("plan"/"planes" is a
  // pricing keyword), trial sits above demo ("prueba" is a demo keyword), and coming-soon
  // sits above services ("funciones"/"features" is a services keyword). Every answer below
  // uses ONLY facts the model path is given, and fits the 300-char reply cap.
  if (has("contract", "contracts", "commitment", "binding", "long-term", "contrato", "contratos", "compromiso", "obligacion", "a plazo")) {
    return isEs
      ? "Sin contratos — todos los planes son mensuales y puedes cancelar cuando quieras."
      : "No contracts — every plan is month-to-month and you can cancel anytime.";
  }
  if (has("cancel", "cancellation", "cancelar", "cancela", "cancelo", "cancelas", "cancelan", "cancelacion", "darse de baja", "darme de baja", "dar de baja")) {
    return isEs
      ? "Puedes cancelar cuando quieras desde tu panel (Facturación → cancelar) o escribiendo a hello@receptionai.store — sin cargos."
      : "Cancel anytime from your dashboard (Billing → cancel) or email hello@receptionai.store — no cancellation fees.";
  }
  if (has("price", "prices", "pricing", "cost", "costs", "precio", "precios", "costo", "costos", "tarifa", "tarifas", "plan", "plans", "planes", "how much", "cuanto")) {
    return isEs
      ? "Planes: Starter $99/mes (1 linea, 500 min IA), Growth $199/mes (2 lineas, 2000 min IA), Scale $399/mes (ilimitado)."
      : "Plans: Starter $99/mo (1 line, 500 AI-min), Growth $199/mo (2 lines, 2,000 AI-min), Scale $399/mo (unlimited).";
  }
  // Trial sits ABOVE demo: "prueba" is also a demo keyword, and there is no free trial.
  if (has("trial", "free trial", "free version", "free month", "prueba gratis", "prueba gratuita", "mes gratis", "version gratuita")) {
    return isEs
      ? "No hay prueba gratis — los planes son suscripciones mensuales y el primer mes se cobra al momento de la compra. Puedes probar la demo en vivo llamando al (727) 966-7556."
      : "There's no free trial — plans are monthly subscriptions and the first month is charged at checkout. You can try the live demo first: call (727) 966-7556.";
  }
  if (has("billing", "billed", "bill", "invoice", "invoices", "charged", "charge", "charges", "facturacion", "factura", "facturas", "cobran", "cobro", "cobrar", "pago", "pagos")) {
    return isEs
      ? "El primer mes se cobra al momento de la compra y después se renueva automáticamente cada mes hasta que canceles. Precio de fundador: 50% de descuento los primeros 3 meses para los primeros 100 clientes."
      : "The first month is charged at checkout, then it renews automatically each month until you cancel. Founder pricing: 50% off the first 3 months for the first 100 customers.";
  }
  if (has("hours", "hour", "business hours", "open", "abierto", "abren", "horario", "horarios", "24/7", "24-7", "what time", "a que hora")) {
    return isEs
      ? "La recepcionista IA contesta 24/7, sin horario de oficina: llamadas, chat web y textos de día y de noche en inglés y español. Las citas siguen el horario que configures en el calendario."
      : "The AI receptionist answers 24/7 — there are no business hours. Calls, web chat and texts are handled day and night in English and Spanish, and bookings follow the hours you set.";
  }
  // Coming-soon sits ABOVE services: "funciones"/"features" is a services keyword.
  if (has("coming soon", "roadmap", "upcoming", "future", "not yet available", "proximamente", "por venir", "futuro", "planean", "van a agregar", "todavia no", "que sigue")) {
    return isEs
      ? "Disponible hoy: llamadas 24/7 en inglés y español, citas por teléfono y web, confirmaciones y recordatorios por SMS, buzón de voz, avisos de llamadas perdidas, chat web, transferencia al dueño y calendario. Próximamente: WhatsApp, Facebook, bandeja unificada, horarios por miembro."
      : "Live today: 24/7 calls in English and Spanish, booking by phone and web, SMS confirmations and reminders, voicemail, missed-call alerts, web chat, owner transfer, built-in calendar. Coming soon: WhatsApp, Facebook, unified inbox, team schedules.";
  }
  // Services: the same capabilities the model path is given as facts.
  if (has("services", "service", "servicios", "servicio", "features", "feature", "funciones", "funcion", "what do you do", "what do you offer", "que hace", "que hacen", "que ofrece", "que ofrecen", "ofrece", "ofrecen")) {
    return isEs
      ? "ReceptionAI contesta llamadas 24/7 en inglés y español, agenda citas por teléfono y en la web, envía confirmaciones y recordatorios por SMS y te manda un resumen después de cada llamada. También recibe mensajes de voz, avisa de llamadas perdidas, tiene chat web y SMS y transfiere llamadas al dueño."
      : "ReceptionAI answers calls 24/7 in English and Spanish, books appointments by phone and web, sends SMS confirmations and reminders, and texts you a summary after every call. It also catches voicemail, alerts you to missed calls, runs web chat and SMS, and can transfer callers to you.";
  }
  if (has("book", "booking", "appointment", "appointments", "reserva", "reservas", "reservar", "cita", "citas")) {
    return isEs
      ? "Reserva una demo llamando al (727) 966-7556, o registrate en receptionai.store/signup. Los planes empiezan en $99 al mes."
      : "Book a demo by calling (727) 966-7556, or sign up at receptionai.store/signup. Plans start at $99/month.";
  }
  if (has("demo", "try", "probar", "prueba", "test")) {
    return isEs
      ? "Prueba la demo llamando al (727) 966-7556, o registrate en receptionai.store/signup. Los planes empiezan en $99 al mes."
      : "Try the live demo by calling (727) 966-7556, or sign up at receptionai.store/signup. Plans start at $99/month.";
  }
  if (has("signup", "sign up", "register", "start", "registrate", "registrarme", "registro", "empezar")) {
    return isEs
      ? "Registrate en receptionai.store/signup. Los planes empiezan en $99 al mes."
      : "Sign up at receptionai.store/signup. Plans start at $99/month.";
  }
  if (has("calendar", "schedule", "calendario", "agenda", "agendar")) {
    return isEs
      ? "Calendario incorporado con horario de atencion preconfigurado, sin Google. Tus clientes reservan por telefono, chat o SMS y reciben confirmacion por SMS."
      : "Built-in calendar with business hours preset - no Google setup. Clients book by phone, chat, or SMS and get SMS confirmations.";
  }
  if (has("support", "soporte", "talk to a person", "hablar con una persona", "hablar con alguien", "atencion al cliente", "customer service", "servicio al cliente", "help desk")) {
    return isEs
      ? "Para hablar con una persona, escribe a hello@receptionai.store o llama a nuestra demo en vivo al (727) 966-7556. El plan Scale incluye soporte prioritario 24/7 con respuesta humana el mismo día."
      : "For a person, email hello@receptionai.store or call our live demo line at (727) 966-7556. The Scale plan includes 24/7 priority support with a same-day human response.";
  }
  if (has("callback", "call back", "call me", "contact me", "reach me", "llamame", "llamarme", "que me llamen", "contactenme", "que me contacten", "escribeme", "escribirme")) {
    return isEs
      ? "Deja tu teléfono o correo en este chat y lo anoto para nuestro equipo. Para hablar con una persona ahora, llama a nuestra demo en vivo al (727) 966-7556."
      : "Leave your phone or email in this chat and I'll note it for our team. For a human right now, call our live demo line at (727) 966-7556.";
  }
  if (/\b(hi|hello|hey|hola|buenas|saludos)\b/.test(nmsg)) {
    return isEs
      ? "Hola! Como puedo ayudarte? Puedo contarte sobre planes, funciones o como reservar una demo."
      : "Hi! How can I help? I can tell you about plans, features, or how to book a demo.";
  }
  // No keyword matched: say so honestly instead of guessing.
  return isEs
    ? "No estoy segura de eso — lo dejaré anotado para nuestro equipo. También puedes escribir a hello@receptionai.store o llamar a nuestra demo en vivo al (727) 966-7556."
    : "I'm not sure about that — I'll flag it for our team. You can also email hello@receptionai.store or call our live demo at (727) 966-7556.";
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

    // Attempt Gemini if key is set
    let failReason = apiKey ? "" : "no gemini api key";
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
