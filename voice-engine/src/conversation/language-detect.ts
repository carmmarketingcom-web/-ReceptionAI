// ─── Language Detection ──────────────────────────────────────────────────────
// Detects whether the user is speaking English or Spanish.

import type { Language } from "../types/index.ts";

/**
 * Detect the language of the given text.
 * Uses a simple keyword-based approach for fast detection.
 * Falls back to the current language if uncertain.
 */
export async function detectLanguage(
  text: string,
  currentLanguage: Language,
): Promise<Language> {
  const cleaned = text.toLowerCase().trim();
  if (!cleaned) return currentLanguage;

  const spanishIndicators = [
    "hola", "buenos", "días", "tardes", "noches", "gracias", "por favor",
    "quiero", "necesito", "podría", "ayuda", "cita", "hora", "día", "mes",
    "año", "sí", "no", "señor", "señora", "don", "doña", "usted", "tu",
    "hablar", " español", "inglés", "entiendo", "comprendo", "favor",
    "llamar", "llamada", "teléfono", "número", "dirección", "precio",
    "cuánto", "cuándo", "dónde", "cómo", "qué", "cuál", "quién",
    "mi", "su", "nuestro", "estoy", "está", "están", "somos",
    "puedo", "puede", "pueden", "tengo", "tiene", "tienen",
    "quiero", "quiere", "quieren", "vamos", "va", "van",
    "arreglar", "reparar", "instalar", "mantenimiento", "servicio",
    "agendar", "cancelar", "reprogramar", "confirmar",
    "emergencia", "urgencia", "problema", "avería", "daño",
  ];

  const englishIndicators = [
    "hello", "hi", "hey", "thanks", "thank you", "please", "help",
    "i want", "i need", "i would like", "can i", "could you",
    "appointment", "booking", "schedule", "reservation", "date",
    "time", "today", "tomorrow", "yes", "no", "mister", "miss",
    "you", "your", "speak", "english", "spanish", "understand",
    "call", "phone", "number", "address", "price", "cost",
    "how much", "when", "where", "how", "what", "which", "who",
    "my", "our", "i am", "it is", "we are", "they are",
    "i can", "you can", "i have", "you have", "they have",
    "i want", "you want", "we go", "service", "repair",
    "fix", "install", "maintenance", "emergency", "urgent",
    "problem", "issue", "damage", "broken", "not working",
    "schedule", "cancel", "reschedule", "confirm", "book",
  ];

  // Count matching indicators
  let spanishScore = 0;
  let englishScore = 0;

  for (const word of spanishIndicators) {
    if (cleaned.includes(word)) spanishScore++;
  }
  for (const word of englishIndicators) {
    if (cleaned.includes(word)) englishScore++;
  }

  // If there's a clear winner, use it
  if (spanishScore > englishScore && spanishScore >= 2) return "es";
  if (englishScore > spanishScore && englishScore >= 2) return "en";

  // If detected text is different from current, but we're uncertain
  if (spanishScore > englishScore && currentLanguage === "en") {
    // Could be a switch — check confidence
    if (spanishScore >= 3) return "es";
  }
  if (englishScore > spanishScore && currentLanguage === "es") {
    if (englishScore >= 3) return "en";
  }

  // Default to current language
  return currentLanguage;
}

/**
 * Check if the given text contains a language switch request.
 */
export function isExplicitLanguageSwitch(text: string): "en" | "es" | null {
  const cleaned = text.toLowerCase().trim();

  const switchToSpanish = [
    "habla español", "en español", "quiero español", "español por favor",
    "puede hablar español", "hable español", "cambiar a español",
    "spanish please", "i speak spanish", "hablo español",
  ];

  const switchToEnglish = [
    "speak english", "in english", "i want english", "english please",
    "can you speak english", "hable inglés", "cambiar a inglés",
    "english", "i speak english", "hablo inglés",
  ];

  for (const phrase of switchToSpanish) {
    if (cleaned.includes(phrase)) return "es";
  }
  for (const phrase of switchToEnglish) {
    if (cleaned.includes(phrase)) return "en";
  }

  return null;
}