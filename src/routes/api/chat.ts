/**
 * POST /api/chat
 *
 * Gemini-powered chat endpoint for the web chat widget.
 * Uses Gemini 3 Flash Preview with generous token budget, full conversation
 * history, and a detailed system prompt so the widget serves as a compelling
 * demo of what the full AI receptionist can do.
 *
 * Body: { message: string, history?: {role:"user"|"model", text:string}[], lang?: "en" | "es" }
 * Response: { reply: string }
 *
 * No auth required — this is for the public-facing demo widget.
 */
import { createFileRoute } from "@tanstack/react-router";
import { logConversation, getReviewedKnowledge, isFallbackResponse } from "~/lib/chat-logs";

export const Route = createFileRoute("/api/chat")({});

const SYSTEM_PROMPT_EN = `You are ReceptionAI, a 24/7 AI receptionist for small businesses (HVAC, plumbing, dental, legal, etc). Keep responses to 2-3 sentences. Be friendly and helpful.

Features: AI answers calls/texts/chats 24/7 in English & Spanish. Auto-schedules appointments. Sends confirmations & reminders. Built-in calendar (no Google OAuth needed). Post-call SMS summaries to owner. Repeat caller recognition. Abandoned booking follow-up.

Pricing: Starter $99/mo, Growth $199/mo, Scale $399/mo. 14-day free trial.

Contact: (727) 966-7556, hello@receptionai.store, signup at receptionai.store/signup.`;

const SYSTEM_PROMPT_ES = `Eres ReceptionAI, un recepcionista IA 24/7 para negocios pequenos (HVAC, plomeria, dental, legal, etc). Respuestas de 2-3 frases. Amigable y util.

Funciones: Responde llamadas/textos/chats 24/7 en ingles y espanol. Programa citas automaticamente. Envia confirmaciones y recordatorios. Calendario incorporado (sin Google OAuth). Resumenes SMS al dueno. Reconoce clientes recurrentes. Seguimiento de reservas abandonadas.

Precios: Starter $99/mes, Growth $199/mes, Scale $399/mes. Prueba gratis 14 dias.

Contacto: (727) 966-7556, hello@receptionai.store, registro en receptionai.store/signup.`;

// Smart keyword-based fallback when Gemini is unavailable
function smartReply(message: string, lang: string): string {
  const msg = message.toLowerCase();
  const isEs = lang === "es";

  if (msg.includes("price") || msg.includes("pricing") || msg.includes("cost") || msg.includes("precio") || msg.includes("costo") || msg.includes("cuanto")) {
    return isEs
      ? "Starter: $99/mes (1 linea, 500 min IA), Growth: $199/mes (2 lineas, 2000 min), Scale: $399/mes (ilimitado). Prueba gratis 14 dias. Quieres registrarte?"
      : "Starter: $99/mo (1 line, 500 AI-min), Growth: $199/mo (2 lines, 2000 min), Scale: $399/mo (unlimited). 14-day free trial. Want to sign up?";
  }
  if (msg.includes("demo") || msg.includes("try") || msg.includes("test") || msg.includes("probar")) {
    return isEs
      ? "Puedes probar ReceptionAI ahora mismo! Llama al (727) 966-7556 y habla con nuestro recepcionista IA. O registrate en receptionai.store/signup para la prueba gratuita de 14 dias."
      : "You can try ReceptionAI right now! Call (727) 966-7556 and talk to our AI receptionist. Or sign up at receptionai.store/signup for a 14-day free trial.";
  }
  if (msg.includes("feature") || msg.includes("do") || msg.includes("what") || msg.includes("que hace") || msg.includes("funcion")) {
    return isEs
      ? "Responde llamadas/textos/chats 24/7 en ingles y espanol. Programa citas, envia recordatorios, calendario incorporado (sin Google OAuth). Resumenes SMS al dueno tras cada llamada."
      : "Answers calls/texts/chats 24/7 in English & Spanish. Auto-schedules appointments, sends reminders, built-in calendar (no Google OAuth). Post-call SMS summaries to the owner.";
  }
  if (msg.includes("signup") || msg.includes("register") || msg.includes("start") || msg.includes("registr") || msg.includes("comenzar")) {
    return isEs
      ? "Registrate en receptionai.store/signup. Elige un plan y comienza tu prueba gratuita de 14 dias. No se requiere tarjeta."
      : "Sign up at receptionai.store/signup. Pick a plan and start your 14-day free trial. No card required.";
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
    ? "Soy el recepcionista IA de ReceptionAI — atiendo llamadas, programo citas y gestiono mensajes 24/7. Precios desde $99/mes con prueba gratis. Preguntame sobre funciones, precios o como empezar!"
    : "I'm ReceptionAI — I handle calls, book appointments, and manage messages 24/7 for service businesses. Plans from $99/mo with a free trial. Ask me about features, pricing, or how to get started!";
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

    // Only attempt Gemini if key looks valid (starts with AIza)
    if (apiKey) {
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
          const reply = rawReply.trim();
          if (reply) {
            logConversation(sessionId, message, reply, lang);
            return new Response(
              JSON.stringify({ reply }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
        }
      } catch {
        // Gemini failed — fall through to keyword responder
      }
    }

    // Use smart keyword fallback
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
