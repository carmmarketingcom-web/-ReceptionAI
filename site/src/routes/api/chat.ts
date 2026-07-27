/**
 * POST /api/chat
 *
 * Gemini-powered chat endpoint for the web chat widget.
 * Uses the same Gemini model + API key as serve.ts (gemini-3-flash-preview).
 *
 * Body: { message: string, lang?: "en" | "es" }
 * Response: { reply: string }
 *
 * No auth required — this is for the public-facing demo widget.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({});


export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as { message?: string; lang?: string };
    const { message = "", lang = "en" } = body;

    if (!message.trim()) {
      return new Response(
        JSON.stringify({ reply: "" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = lang === "es"
      ? "Eres un recepcionista amigable de IA para ReceptionAI, un servicio de recepcionista virtual para pequenas empresas. Responde de forma breve (1-2 frases). Se util con informacion sobre citas, precios, caracteristicas y horarios. Planes: Starter $99/mes, Growth $199/mes, Scale $399/mes. Sitio web: receptionai.store. Telefono: (727) 966-7556. Responde en espanol."
      : "You are a friendly AI receptionist for ReceptionAI, a virtual receptionist service for small businesses. Keep responses brief (1-2 sentences). Be helpful about appointments, pricing, features, and business hours. Plans: Starter $99/mo, Growth $199/mo, Scale $399/mo. Website: receptionai.store. Phone: (727) 966-7556. Respond in the language the user speaks.";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
        }),
      },
    );

    if (!res.ok) {
      console.error("[Chat API] Gemini error:", res.status, await res.text().catch(() => ""));
      return new Response(
        JSON.stringify({ reply: "I'm having trouble connecting. Please try again in a moment." }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = (await res.json()) as any;
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(
      JSON.stringify({ reply: reply.trim() || "I'm not sure how to answer that. Can you rephrase?" }),
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
