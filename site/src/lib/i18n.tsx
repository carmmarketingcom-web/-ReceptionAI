/**
 * Simple i18n for English and Spanish.
 * Usage: import { t, useLocale } from "~/lib/i18n";
 *
 * Wrap your tree in <LocaleProvider> to get a reactive language toggle.
 * The `t(key)` function reads the current locale from a module-level variable
 * that the provider updates on mount and on toggle, so existing `t("…")`
 * call sites become reactive with no extra work.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Locale = "en" | "es";

export const translations: Record<string, { en: string; es: string }> = {
  /* ─── Navigation ─── */
  "nav.home": { en: "Home", es: "Inicio" },
  "nav.features": { en: "Features", es: "Características" },
  "nav.pricing": { en: "Pricing", es: "Precios" },
  "nav.demo": { en: "Get a Demo", es: "Solicitar Demo" },
  "nav.dashboard": { en: "Dashboard", es: "Panel" },
  "nav.login": { en: "Log In", es: "Iniciar Sesión" },
  "nav.getStarted": { en: "Get Started", es: "Comenzar" },
  "nav.book": { en: "Book Now", es: "Reservar Ahora" },
  "nav.faq": { en: "FAQ", es: "Preguntas Frecuentes" },
  "nav.about": { en: "About", es: "Nosotros" },
  "nav.contact": { en: "Contact", es: "Contacto" },
  "nav.signup": { en: "Sign Up", es: "Registrarse" },

  /* ─── Header ─── */
  "header.tagline": {
    en: "Never Miss a Call. Never Miss a Customer.",
    es: "Nunca pierdas una llamada. Nunca pierdas un cliente.",
  },

  /* ─── Language toggle ─── */
  "lang.switchTo": { en: "Ver en español", es: "Switch to English" },
  "lang.label.en": { en: "EN", es: "EN" },
  "lang.label.es": { en: "ES", es: "ES" },
  "Live": { en: "Live", es: "Activa" },
  "Partial": { en: "Partial", es: "Parcial" },
  "Coming Soon": { en: "Coming Soon", es: "Próximamente" },

  /* ─── Home — Hero ─── */
  /* Mirrors _marketing.index.tsx HeroSection verbatim. Nothing here promises a
     feature the live page does not show. */
  "home.badge": { en: "AI Receptionist — Now Available", es: "Recepcionista IA — Ya Disponible" },
  "home.hero.line1": { en: "Never miss", es: "Nunca pierdas" },
  "home.hero.highlight": { en: "another customer call.", es: "otra llamada de cliente." },
  "home.hero.subtitle": {
    en: "Every call answered. Every appointment booked. Every owner notified by email — in English and Spanish, at 2am on a Sunday.",
    es: "Cada llamada contestada. Cada cita agendada. Cada dueño avisado por correo — en inglés y español, a las 2 de la mañana un domingo.",
  },
  "home.hero.price": { en: "$99 a month.", es: "$99 al mes." },
  "home.hero.cta": { en: "Hear the live demo", es: "Escucha la demo en vivo" },
  "home.hero.secondary": { en: "See pricing", es: "Ver precios" },
  /* The demo line number itself is never translated or localized. */
  "home.hero.demoPrefix": { en: "The demo line is", es: "La línea de demostración es" },
  "home.hero.demoSuffix": {
    en: "— a real call to the AI, answered exactly as your callers would hear it.",
    es: "— una llamada real a la IA, contestada tal como la escucharían tus clientes.",
  },
  /* What the AI actually does on a call — shipped behaviour only, one line each. */
  "home.value.1": { en: "Answers after hours and while you're on a job", es: "Contesta fuera de horario y mientras estás en un trabajo" },
  "home.value.2": { en: "Takes the caller's name and number", es: "Toma el nombre y el número de quien llama" },
  "home.value.3": { en: "Books straight into your calendar", es: "Agenda directo en tu calendario" },
  "home.value.4": { en: "Emails web bookings a confirmation and reminders", es: "Le manda a quien reserva en la web una confirmación y recordatorios por correo" },
  "home.value.5": { en: "Emails you a summary after every call", es: "Te manda un resumen por correo después de cada llamada" },
  "home.value.6": { en: "English and Spanish", es: "Inglés y español" },
  "home.value.7": { en: "Transfers to you when it matters", es: "Te transfiere la llamada cuando hace falta" },
  /* The only figure on the page that is not ours. The source and its date travel
     with the number in both languages — a translated statistic without its
     attribution would be a fabricated statistic. */
  "home.bls.pre": {
    en: "For comparison: the median US wage for a receptionist is",
    es: "Para comparar: el salario medio en EE. UU. de un recepcionista es de",
  },
  "home.bls.amount": { en: "$38,010 a year", es: "$38,010 al año" },
  "home.bls.mid": {
    en: "— before benefits, and before anyone covers a lunch break.",
    es: "— antes de beneficios y antes de que alguien cubra la pausa del almuerzo.",
  },
  "home.bls.source": {
    en: "(U.S. Bureau of Labor Statistics, May 2025.)",
    es: "(Oficina de Estadísticas Laborales de EE. UU., mayo de 2025.)",
  },

  /* ─── Industries ─── */
  "ind.hvac": { en: "HVAC", es: "HVAC" },
  "ind.plumbing": { en: "Plumbing", es: "Plomería" },
  "ind.electrical": { en: "Electrical", es: "Electricidad" },
  "ind.dental": { en: "Dental", es: "Dental" },
  "ind.veterinary": { en: "Veterinary", es: "Veterinaria" },
  "ind.law": { en: "Law", es: "Legal" },
  "ind.medspa": { en: "Med Spa", es: "Med Spa" },
  "ind.homeservices": { en: "Home Services", es: "Servicios para el Hogar" },
  /* The trades card lists "Legal" where the marquee lists "Law" — same word in Spanish. */
  "ind.legal": { en: "Legal", es: "Legal" },

  /* ─── Home — Logo marquee ─── */
  "home.marquee.title": { en: "Built for every service industry", es: "Hecho para cada industria de servicios" },

  /* ─── Home — How it works (first) ─── */
  "home.how.badge": { en: "How it works", es: "Cómo funciona" },
  "home.how.title1": { en: "Your AI receptionist", es: "Tu recepcionista IA" },
  "home.how.title2": { en: "in 3 simple steps", es: "en 3 pasos simples" },
  "home.how.step1.title": { en: "We answer your calls 24/7", es: "Respondemos tus llamadas 24/7" },
  "home.how.step1.desc": {
    en: "In English or Spanish. Every call, every time — no missed leads.",
    es: "En inglés o español. Cada llamada, siempre — sin clientes perdidos.",
  },
  "home.how.step2.title": { en: "We book appointments automatically", es: "Agendamos citas automáticamente" },
  "home.how.step2.desc": {
    en: "On your built-in calendar. No Google account needed. Just set your hours.",
    es: "En tu calendario integrado. No necesitas cuenta de Google. Solo configura tus horarios.",
  },
  "home.how.step3.title": { en: "You get an email summary after every call", es: "Recibes un resumen por correo después de cada llamada" },
  "home.how.step3.desc": {
    en: "Caller info, duration, and outcome — straight to your inbox. No dashboard required.",
    es: "Datos del llamante, duración y resultado — directo a tu correo. No necesitas abrir el panel.",
  },

  /* ─── Home — Built for trades ─── */
  "home.trades.title": { en: "Built for trades — no integrations needed", es: "Hecho para oficios — sin integraciones necesarias" },
  "home.trades.desc": {
    en: "Your calendar is built right in. No ServiceTitan. No Housecall Pro. Nothing to connect. Nothing to sync. Just set your hours and go.",
    es: "Tu calendario está integrado. Sin ServiceTitan. Sin Housecall Pro. Nada que conectar. Nada que sincronizar. Solo configura tus horarios y listo.",
  },
  "home.trades.worksFor": { en: "Works great for:", es: "Funciona muy bien para:" },

  /* ─── Home — Features overview ─── */
  "home.features.badge": { en: "Features", es: "Características" },
  "home.features.title": { en: "Everything your business needs", es: "Todo lo que tu negocio necesita" },
  "home.features.subtitle": {
    en: "One platform. Calls, messages, scheduling — so you can focus on the work.",
    es: "Una plataforma. Llamadas, mensajes, citas — para que te enfoques en el trabajo.",
  },

  /* ─── Features (shared) ─── */
  "feature.247.title": { en: "24/7 Call Answering", es: "Respuesta de Llamadas 24/7" },
  "feature.247.desc": {
    en: "Never miss a business opportunity. AI answers every call instantly, day or night, weekends and holidays included.",
    es: "Nunca pierdas una oportunidad de negocio. La IA responde cada llamada al instante, de día o de noche, fines de semana y feriados incluidos.",
  },
  "feature.multilingual.title": { en: "Bilingual (English & Spanish)", es: "Bilingüe (Inglés y Español)" },
  "feature.multilingual.desc": {
    en: "Serve your customers in the language they're most comfortable with. Seamless switching between English and Spanish.",
    es: "Atiende a tus clientes en el idioma con el que se sientan más cómodos. Cambio sin esfuerzo entre inglés y español.",
  },
  "feature.scheduling.title": { en: "Smart Appointment Scheduling", es: "Agendamiento Inteligente de Citas" },
  "feature.scheduling.desc": {
    en: "AI reads your calendar and books appointments automatically. Emails web bookings a confirmation, reminders, and follow-ups.",
    es: "La IA lee tu calendario y agenda citas automáticamente. Manda por correo a quien reserva en la web la confirmación, los recordatorios y el seguimiento.",
  },
  "feature.multichannel.title": { en: "Calls, Web Chat & Email", es: "Llamadas, Chat Web y Correo" },
  "feature.multichannel.desc": {
    en: "Calls and web chat handled in one place, and every call emailed to you. The unified inbox for WhatsApp and Facebook messages is in development.",
    es: "Llamadas y chat web atendidos en un solo lugar, y cada llamada te llega por correo. La bandeja de entrada unificada para mensajes de WhatsApp y Facebook está en desarrollo.",
  },
  "feature.human.title": { en: "Human Handoff When Needed", es: "Transferencia a Humanos Cuando Sea Necesario" },
  "feature.human.desc": {
    en: "Callers press 3 to reach you on a live call, and web-chat requests for a person email you right away. Sentiment-based escalation is coming.",
    es: "Los llamantes presionan 3 para comunicarse contigo en una llamada en vivo, y las solicitudes de una persona en el chat web te llegan por correo de inmediato. La escalación automática según el sentimiento aún está en desarrollo.",
  },
  "feature.analytics.title": { en: "Call Outcomes & Missed Calls", es: "Resultados de Llamadas y Llamadas Perdidas" },
  "feature.analytics.desc": {
    en: "See call activity, missed calls and real outcomes in your dashboard — the analytics dashboard is live in your account.",
    es: "Mira la actividad de llamadas, las llamadas perdidas y los resultados reales en tu panel — el panel de analíticas ya está disponible en tu cuenta.",
  },

  /* ─── Home — Numbered setup ─── */
  "home.setup.badge": { en: "Simple Setup", es: "Configuración Simple" },
  "home.setup.title": { en: "Up and running in minutes", es: "En funcionamiento en minutos" },
  "home.setup.step1.title": { en: "Get Your Number", es: "Obtén tu Número" },
  "home.setup.step1.desc": {
    en: "You're live in minutes with a new number — or keep your old number by forwarding calls to it. Set your business hours and your AI receptionist is ready.",
    es: "Estás en funcionamiento en minutos con un número nuevo — o conserva tu número actual reenviando las llamadas. Configura tus horarios y tu recepcionista IA estará listo.",
  },
  "home.setup.step2.title": { en: "AI Takes the Calls", es: "La IA Recibe las Llamadas" },
  "home.setup.step2.desc": {
    en: "Your AI receptionist answers every call, asks the right questions, and books appointments — in English or Spanish.",
    es: "Tu recepcionista IA responde cada llamada, hace las preguntas correctas y agenda citas — en inglés o español.",
  },
  "home.setup.step3.title": { en: "You Focus on Work", es: "Tú te Enfocas en el Trabajo" },
  "home.setup.step3.desc": {
    en: "Get an email summary after every call. See everything in your dashboard. Only step in when you want to.",
    es: "Recibe un resumen por correo después de cada llamada. Ve todo en tu panel. Interviene solo cuando quieras.",
  },

  /* ─── Home — What actually happens (no testimonials exist — see index.tsx) ─── */
  "home.social.badge": { en: "Live in the product today", es: "En vivo en el producto hoy" },
  "home.social.title1": { en: "No borrowed reviews.", es: "Sin reseñas prestadas." },
  "home.social.title2": { en: "This is what actually happens.", es: "Esto es lo que realmente pasa." },

  /* ─── Home — Stats bar ─── */
  "home.stats.1": { en: "24/7 Call Answering", es: "Respuesta de Llamadas 24/7" },
  "home.stats.2": { en: "English & Spanish", es: "Inglés y Español" },
  "home.stats.3": { en: "Built-in Calendar", es: "Calendario Integrado" },
  "home.stats.4": { en: "Smart Follow-ups", es: "Seguimientos Inteligentes" },

  /* ─── Home — Honest FAQ ─── */
  "home.faq.badge": { en: "You've got questions. Fair ones.", es: "Tienes preguntas. Y son justas." },
  "home.faq.title1": { en: "Honest answers from a team", es: "Respuestas honestas de un equipo" },
  "home.faq.title2": { en: "that builds for trades", es: "que construye para oficios" },
  "home.faq.q1": { en: "Will my customers know it's AI?", es: "¿Mis clientes sabrán que es IA?" },
  "home.faq.a1": {
    en: "They hear a warm, natural voice and a real conversation — not a phone tree. If they ever ask whether it's an AI, it says so plainly, and it can connect them to a real person at any point in the call.",
    es: "Escuchan una voz cálida y natural y una conversación real — no un árbol telefónico. Si preguntan si es una IA, lo dice con claridad, y puede conectarlos con una persona real en cualquier momento de la llamada.",
  },
  "home.faq.q2": { en: "What about emergencies? Burst pipe. No heat.", es: "¿Y las emergencias? Tubería rota. Sin calefacción." },
  "home.faq.a2": {
    en: "Press 3 at any time and the call is bridged straight to you or your team. If nobody picks up, the caller can leave a voicemail and you get it by email — so an urgent call never just ends.",
    es: "Presiona 3 en cualquier momento y la llamada se conecta directamente contigo o con tu equipo. Si nadie contesta, el llamante puede dejar un mensaje de voz y a ti te llega por correo — así una llamada urgente nunca se queda sin respuesta.",
  },
  "home.faq.q3": { en: "What if it gets something wrong?", es: "¿Qué pasa si se equivoca?" },
  "home.faq.a3": {
    en: "You get an email after every call with the caller's number, what they asked, and what happened. If something needs your attention, you'll know within seconds. And we're always improving the AI — your feedback makes it smarter.",
    es: "Recibes un correo después de cada llamada con el número del llamante, lo que pidió y lo que sucedió. Si algo necesita tu atención, lo sabrás en segundos. Y siempre estamos mejorando la IA — tus comentarios la hacen más inteligente.",
  },

  /* ─── Home — Final CTA ─── */
  "home.final.title": { en: "Ready to never miss a lead again?", es: "¿Listo para no perder clientes nunca más?" },
  "home.final.subtitle": {
    en: "Call the demo line and hear it answer — then see what it costs. 50% off your first 3 months with founder pricing.",
    es: "Llama a la línea de demostración y escúchala responder — luego mira cuánto cuesta. 50% de descuento en tus primeros 3 meses con el precio de fundador.",
  },
  "home.final.cta": { en: "Hear the live demo", es: "Escucha la demo en vivo" },
  "home.final.pricing": { en: "See pricing", es: "Ver precios" },
  "home.final.note": {
    en: "Demo line: (727) 966-7556. Founder pricing: 50% off your first 3 months. Cancel anytime.",
    es: "Línea de demostración: (727) 966-7556. Precio de fundador: 50% de descuento en tus primeros 3 meses. Cancela cuando quieras.",
  },
  "home.final.ready": { en: "Ready to start?", es: "¿Listo para comenzar?" },
  "home.final.createAccount": { en: "Create your account", es: "Crea tu cuenta" },

  /* ─── Home — Missed-call calculator ─── */
  /* The maths, the 1-in-3 assumption and the "estimate only" disclaimer are
     identical in both languages. Only the words change. */
  "home.calc.badge": { en: "Missed-call calculator", es: "Calculadora de llamadas perdidas" },
  "home.calc.headline": { en: "How much are missed calls costing you?", es: "¿Cuánto te cuestan las llamadas perdidas?" },
  "home.calc.subtitle": {
    en: "Put a number on the opportunities that disappear when the phone rings while your team is busy.",
    es: "Ponle número a las oportunidades que se pierden cuando suena el teléfono y tu equipo está ocupado.",
  },
  "home.calc.callsLabel": { en: "Calls you miss per week", es: "Llamadas que pierdes por semana" },
  "home.calc.jobLabel": { en: "Average job value", es: "Valor promedio del trabajo" },
  "home.calc.assumption": {
    en: "Assumes 1 in 3 missed callers would have become a paying job.",
    es: "Asume que 1 de cada 3 llamantes perdidos se habría convertido en un trabajo pagado.",
  },
  "home.calc.outputLabel": { en: "REVENUE_LOST / YEAR", es: "INGRESOS PERDIDOS / AÑO" },
  "home.calc.monthlyPre": { en: "That's about", es: "Eso es cerca de" },
  "home.calc.monthlyPost": {
    en: "a month — far more than the cost of never missing a call again.",
    es: "al mes — mucho más de lo que cuesta no volver a perder una llamada.",
  },
  "home.calc.cta": { en: "Stop the leak — get started", es: "Detén la fuga — comienza ahora" },
  "home.calc.disclaimer": { en: "Estimate only — your results will vary.", es: "Solo un estimado — tus resultados pueden variar." },
  "home.calc.decrease": { en: "Decrease missed calls", es: "Reducir las llamadas perdidas" },
  "home.calc.increase": { en: "Increase missed calls", es: "Aumentar las llamadas perdidas" },

  /* ─── Home — See it working ─── */
  /* The quoted scripts and messages stay in the language the product actually
     sends them in: the wording inside the quotation marks is verbatim product
     output, not marketing copy. The Spanish email sample sits right beside it. */
  "home.see.badge": { en: "See it working", es: "Míralo funcionando" },
  "home.see.title1": { en: "See it working — what your", es: "Míralo funcionando — lo que" },
  "home.see.title2": { en: "customers experience", es: "viven tus clientes" },
  "home.see.subtitle": {
    en: "Real call scripts and real email messages. The wording below is what our receptionist actually says on the phone and sends by email — sample names and times are placeholders.",
    es: "Guiones de llamada y mensajes de correo reales. El texto de abajo es lo que nuestra recepcionista dice de verdad en el teléfono y envía por correo — los nombres y las horas son ejemplos.",
  },
  "home.see.call.label": { en: "On the phone", es: "En el teléfono" },
  "home.see.call.title": { en: "A call lands at 7 PM on a Saturday", es: "Entra una llamada un sábado a las 7 PM" },
  "home.see.pill1": { en: "Inbound call", es: "Llamada entrante" },
  "home.see.pill2": { en: "Press 1 to book", es: "Presiona 1 para agendar" },
  "home.see.pill3": { en: "Slots offered", es: "Horarios ofrecidos" },
  "home.see.pill4": { en: "Confirmed ✓", es: "Confirmada ✓" },
  "home.see.pill5": { en: "Email sent", es: "Correo enviado" },
  "home.see.step.answered": { en: "Answered", es: "Contestada" },
  "home.see.step.menu": { en: "Menu", es: "Menú" },
  "home.see.step.availability": { en: "Availability", es: "Disponibilidad" },
  "home.see.step.booked": { en: "Booked", es: "Agendada" },
  "home.see.email.label": { en: "By email", es: "Por correo" },
  "home.see.email.title": { en: "What your customer's inbox shows", es: "Lo que ve el buzón de tu cliente" },
  "home.see.email.booking": { en: "Booking confirmation", es: "Confirmación de la cita" },
  "home.see.email.reminder": { en: "Reminder — 24 hours before", es: "Recordatorio — 24 horas antes" },
  "home.see.email.abandoned": { en: "Call ended with interest but no booking", es: "La llamada terminó con interés pero sin cita" },
  "home.see.email.spanish": { en: "Same emails in Spanish", es: "Los mismos correos en español" },
  "home.see.owner.label": { en: "To your inbox", es: "A tu correo" },
  "home.see.owner.title": { en: "The summary after every call", es: "El resumen después de cada llamada" },
  "home.see.chip.caller": { en: "Caller", es: "Llamante" },
  "home.see.chip.duration": { en: "Duration", es: "Duración" },
  "home.see.chip.outcome": { en: "Outcome", es: "Resultado" },
  "home.see.chip.dtmf": { en: "DTMF", es: "DTMF" },
  "home.see.owner.note": {
    en: "Emailed to the owner's address on file — no dashboard needed to know what happened.",
    es: "Se envía al correo del dueño que está registrado — no necesitas abrir el panel para saber qué pasó.",
  },
  "home.see.owner.link": { en: "See what each plan includes", es: "Mira qué incluye cada plan" },

  /* ─── Home — Features overview link ─── */
  "home.features.statusLink": {
    en: "See the honest status of every feature — Live, Partial, or Coming Soon",
    es: "Mira el estado honesto de cada función — Activa, Parcial o Próximamente",
  },

  /* ─── Home — What actually happens (no customer quotes exist) ─── */
  "home.social.body": {
    en: "ReceptionAI is new, so there are no customer quotes on this page to show you. Instead, here is exactly what the software does on a call — all of it built and running today.",
    es: "ReceptionAI es nuevo, así que no hay opiniones de clientes que mostrarte en esta página. En su lugar, esto es exactamente lo que el software hace en una llamada — todo construido y funcionando hoy.",
  },
  "home.social.card1.title": { en: "Answers every call, day or night", es: "Contesta cada llamada, de día o de noche" },
  "home.social.card1.body": {
    en: "A real conversation, not a phone tree — in English or Spanish. Nights, weekends and holidays included. Callers choose English or Spanish before the menu.",
    es: "Una conversación real, no un menú automático — en inglés o español. Noches, fines de semana y feriados incluidos. El llamante elige inglés o español antes del menú.",
  },
  "home.social.card2.title": { en: "Books the appointment on the call", es: "Agenda la cita durante la llamada" },
  "home.social.card2.body": {
    en: "It checks your real availability — your hours, your holidays, appointments already on the books and a 15-minute buffer — books the slot, then emails a booking made on the web a confirmation and reminders 24 hours and 2 hours ahead.",
    es: "Revisa tu disponibilidad real — tus horarios, tus feriados, las citas que ya tienes y un margen de 15 minutos — agenda el horario y luego le manda por correo a quien reserva en la web la confirmación y los recordatorios 24 horas y 2 horas antes.",
  },
  "home.social.card3.title": { en: "Emails you a summary after every call", es: "Te manda un resumen por correo después de cada llamada" },
  "home.social.card3.body": {
    en: "Who called, how long it ran, what the outcome was and what they asked for. It arrives in your inbox, so you don't have to open the dashboard to know what happened.",
    es: "Quién llamó, cuánto duró, cuál fue el resultado y qué pidió. Llega a tu correo, así no tienes que abrir el panel para saber qué pasó.",
  },
  "home.social.example": { en: "Example", es: "Ejemplo" },
  "home.social.exampleTitle": { en: "What lands in your inbox after a call", es: "Lo que llega a tu correo después de una llamada" },
  "home.social.exampleBody": {
    en: "The owner's summary email, in the format ReceptionAI sends it. The message shown here is a sample of that format — it is not a real customer's call.",
    es: "El correo de resumen del dueño, en el formato en que ReceptionAI lo envía. El mensaje que ves aquí es una muestra de ese formato — no es la llamada de un cliente real.",
  },
  "home.social.emailToOwner": { en: "Email · to the business owner", es: "Correo · al dueño del negocio" },

  /* ─── Pricing ─── */
  "pricing.badge": { en: "Pricing", es: "Precios" },
  "pricing.title": { en: "Simple, transparent pricing", es: "Precios simples y transparentes" },
  "pricing.subtitle": {
    en: "No hidden fees, no surprise charges. Start small and scale as you grow.",
    es: "Sin cargos ocultos, sin sorpresas. Comienza pequeño y crece a tu ritmo.",
  },
  "pricing.monthly": { en: "Monthly", es: "Mensual" },
  "pricing.perMonth": { en: "/month", es: "/mes" },
  "pricing.popular": { en: "Most Popular", es: "Más Popular" },
  "pricing.cta": { en: "Start Today", es: "Comenzar Hoy" },
  "pricing.notifications.title": {
    en: "Included in every plan: email notifications",
    es: "Incluido en todos los planes: notificaciones por correo",
  },
  "pricing.notifications.body": {
    en: "Every call and web chat emails you automatically, in the caller's language (English or Spanish): the post-call summary, missed-call alerts, voicemail alerts with the recording, and web-chat callback requests. No extra charge.",
    es: "Cada llamada y cada chat web te llegan por correo automáticamente, en el idioma del cliente (inglés o español): el resumen después de la llamada, los avisos de llamadas perdidas, los avisos de mensajes de voz con la grabación y las solicitudes de devolución de llamada del chat web. Sin costo adicional.",
  },
  "pricing.notifications.textNote": {
    en: "Text (SMS) alerts are an optional add-on for any plan — pricing on request.",
    es: "Los avisos por mensaje de texto (SMS) son un complemento opcional para cualquier plan — precio a consultar.",
  },
  "pricing.billingNote": {
    en: "Simple monthly pricing. You're charged for your first month at checkout and billed monthly after that. Cancel anytime.",
    es: "Precios mensuales simples. Se te cobra el primer mes al finalizar la compra y se te factura mensualmente después. Cancela cuando quieras.",
  },
  /* Honest caveats — own the gap between the plan bullets and what is built today */
  "pricing.caveat1": {
    en: "Good to know: WhatsApp + Facebook messaging and the unified inbox are in development — you'll get them the moment they launch.",
    es: "Ten en cuenta: la mensajería de WhatsApp + Facebook y la bandeja de entrada unificada están en desarrollo — las tendrás en cuanto se lancen.",
  },
  "pricing.caveatLink": {
    en: "See the status of every feature",
    es: "Consulta el estado de cada función",
  },

  "pricing.starter.name": { en: "Starter", es: "Starter" },
  "pricing.starter.price": { en: "$99", es: "$99" },
  "pricing.starter.desc": {
    en: "Perfect for solopreneurs and small shops just getting started.",
    es: "Perfecto para emprendedores y pequeños negocios que están comenzando.",
  },
  "pricing.starter.feature1": { en: "1 phone line", es: "1 línea telefónica" },
  "pricing.starter.feature2": { en: "500 AI-minutes/month", es: "500 minutos de IA/mes" },
  "pricing.starter.feature3": { en: "Email notifications & web chat", es: "Notificaciones por correo y chat web" },
  "pricing.starter.feature4": { en: "Basic calendar sync", es: "Sincronización básica de calendario" },
  "pricing.starter.feature5": { en: "English & Spanish support", es: "Soporte en inglés y español" },
  "pricing.starter.feature6": { en: "Email support", es: "Soporte por correo electrónico" },

  "pricing.growth.name": { en: "Growth", es: "Growth" },
  "pricing.growth.price": { en: "$199", es: "$199" },
  "pricing.growth.desc": {
    en: "Ideal for growing teams that need more coverage and channels.",
    es: "Ideal para equipos en crecimiento que necesitan más cobertura y canales.",
  },
  "pricing.growth.feature1": { en: "2 phone lines", es: "2 líneas telefónicas" },
  "pricing.growth.feature2": { en: "2,000 AI-minutes/month", es: "2,000 minutos de IA/mes" },
  "pricing.growth.feature3": { en: "Everything in Starter", es: "Todo lo de Starter" },
  "pricing.growth.feature4": { en: "Advanced analytics dashboard", es: "Panel de analíticas avanzadas" },
  "pricing.growth.feature5": { en: "Priority email & chat support", es: "Soporte prioritario por correo y chat" },
  "pricing.growth.feature6": { en: "Voicemail with playable recordings", es: "Buzón de voz con grabaciones reproducibles" },

  "pricing.scale.name": { en: "Scale", es: "Scale" },
  "pricing.scale.price": { en: "$399", es: "$399" },
  "pricing.scale.desc": {
    en: "For high-volume businesses that need unlimited capacity and custom AI.",
    es: "Para negocios de alto volumen que necesitan capacidad ilimitada e IA personalizada.",
  },
  "pricing.scale.feature1": { en: "Unlimited phone lines (5+ add-on)", es: "Líneas telefónicas ilimitadas (complemento 5+)" },
  "pricing.scale.feature2": { en: "10,000+ AI-minutes/month", es: "10,000+ minutos de IA/mes" },
  "pricing.scale.feature3": { en: "Custom AI response training", es: "Entrenamiento personalizado de respuestas IA" },
  "pricing.scale.feature4": { en: "All channels included", es: "Todos los canales incluidos" },
  "pricing.scale.feature5": { en: "Dedicated account manager", es: "Gerente de cuenta dedicado" },
  "pricing.scale.feature6": { en: "24/7 priority support — same-day human response", es: "Soporte prioritario 24/7 — respuesta humana el mismo día" },

  /* ─── Pricing — Scale premium block ─── */
  "pricing.scaleBlock.title": { en: "What changes at Scale — and why", es: "Qué cambia en Scale — y por qué" },
  "pricing.scaleBlock.subtitle": {
    en: "Scale isn't a bigger minute allowance — it's a different operating level: capacity, customization, and service you can't run a high-volume business without.",
    es: "Scale no es solo más minutos de IA — es un nivel operativo diferente: capacidad, personalización y servicio sin los cuales no puedes manejar un negocio de alto volumen.",
  },
  "pricing.scaleBlock.capacity": { en: "Capacity", es: "Capacidad" },
  "pricing.scaleBlock.capacityDesc": {
    en: "Unlimited phone lines for every location and department, and 10,000+ AI-minutes so peak season never hits a ceiling.",
    es: "Líneas telefónicas ilimitadas para cada ubicación y departamento, y más de 10,000 minutos de IA para que la temporada alta nunca toque un techo.",
  },
  "pricing.scaleBlock.customization": { en: "Customization", es: "Personalización" },
  "pricing.scaleBlock.customizationDesc": {
    en: "Your AI is trained on your services, pricing, and FAQs — callers hear your business, not a generic receptionist.",
    es: "Tu IA se entrena con tus servicios, precios y preguntas frecuentes — los llamantes escuchan tu negocio, no una recepcionista genérica.",
  },
  "pricing.scaleBlock.service": { en: "Service", es: "Servicio" },
  "pricing.scaleBlock.serviceDesc": {
    en: "A dedicated account manager, and priority support with a same-day human response — when you can't afford to wait.",
    es: "Un gerente de cuenta dedicado y soporte prioritario con respuesta humana el mismo día — para cuando no puedes darte el lujo de esperar.",
  },

  /* ─── Pricing — plan cards: who it's for + the real limits ─── */
  "pricing.starter.who": {
    en: "For solo operators and one-person shops that just need the phone covered.",
    es: "Para operadores independientes y negocios de una sola persona que solo necesitan que alguien conteste el teléfono.",
  },
  "pricing.starter.limits": { en: "1 phone line · 500 AI minutes a month", es: "1 línea telefónica · 500 minutos de IA al mes" },
  "pricing.growth.who": {
    en: "For growing teams that need a second line and more call volume.",
    es: "Para equipos en crecimiento que necesitan una segunda línea y más volumen de llamadas.",
  },
  "pricing.growth.limits": { en: "2 phone lines · 2,000 AI minutes a month", es: "2 líneas telefónicas · 2,000 minutos de IA al mes" },
  "pricing.scale.who": {
    en: "For high-volume businesses that need unlimited lines and a custom-trained AI.",
    es: "Para negocios de alto volumen que necesitan líneas ilimitadas y una IA entrenada a la medida.",
  },
  "pricing.scale.limits": { en: "Unlimited phone lines · 10,000+ AI minutes a month", es: "Líneas telefónicas ilimitadas · más de 10,000 minutos de IA al mes" },
  /* Inline chip on a plan bullet that describes something not shipped yet. */
  "pricing.comingSoonChip": { en: "Coming soon", es: "Próximamente" },

  /* ─── Pricing — billing note under the plan buttons ─── */
  "pricing.billing.title": { en: "Billed monthly", es: "Facturación mensual" },
  "pricing.billing.line1": {
    en: "your card is charged today for the first month, then monthly ·",
    es: "hoy se cobra el primer mes a tu tarjeta y luego cada mes ·",
  },
  "pricing.billing.cancel": { en: "cancel anytime", es: "cancela cuando quieras" },
  "pricing.billing.line2": {
    en: "= 50% off your first 3 months (first 100 customers).",
    es: "= 50% de descuento en tus primeros 3 meses (primeros 100 clientes).",
  },
  "pricing.billing.sub": {
    en: "No free trial and no contract — the first payment is today.",
    es: "Sin prueba gratis y sin contrato — el primer pago es hoy.",
  },

  /* ─── Pricing — what is genuinely not shipped (no dates, no promises) ─── */
  "pricing.soon.chip": { en: "Coming soon", es: "Próximamente" },
  "pricing.soon.title": { en: "Not included today", es: "No incluido hoy" },
  "pricing.soon.body": {
    en: "These three are being built. They are not part of any plan yet, and we are not promising a date.",
    es: "Estas tres funciones se están construyendo. Todavía no forman parte de ningún plan y no estamos prometiendo una fecha.",
  },
  "pricing.soon.whatsapp.name": { en: "WhatsApp messaging", es: "Mensajería por WhatsApp" },
  "pricing.soon.whatsapp.body": {
    en: "The AI answers WhatsApp messages the same way it answers calls and web chats.",
    es: "La IA responde los mensajes de WhatsApp igual que responde las llamadas y los chats web.",
  },
  "pricing.soon.facebook.name": { en: "Facebook Messenger", es: "Facebook Messenger" },
  "pricing.soon.facebook.body": {
    en: "Messenger conversations answered by the same AI, in the same dashboard.",
    es: "Conversaciones de Messenger respondidas por la misma IA, en el mismo panel.",
  },
  "pricing.soon.calendar.name": { en: "Google / Outlook calendar sync", es: "Sincronización con calendario de Google / Outlook" },
  "pricing.soon.calendar.body": {
    en: "Two-way sync with the calendar you already use. Today ReceptionAI books into its own built-in calendar.",
    es: "Sincronización en dos direcciones con el calendario que ya usas. Hoy ReceptionAI agenda en su propio calendario integrado.",
  },

  /* ─── Pricing — Add-ons ─── */
  "pricing.addons.title": { en: "Optional Add-ons", es: "Complementos Opcionales" },
  "pricing.addons.subtitle": {
    en: "Customize your plan with these extras. Text alerts are an add-on, not part of any plan.",
    es: "Personaliza tu plan con estos extras. Los avisos por texto son un complemento, no forman parte de ningún plan.",
  },
  "pricing.addon1.name": { en: "Extra phone number", es: "Número telefónico adicional" },
  "pricing.addon1.price": { en: "$15/mo", es: "$15/mes" },
  "pricing.addon2.name": { en: "Additional AI-minutes (500)", es: "Minutos de IA adicionales (500)" },
  "pricing.addon2.price": { en: "$25/mo", es: "$25/mes" },
  "pricing.addon3.name": { en: "Custom integration setup", es: "Configuración de integración personalizada" },
  "pricing.addon3.price": { en: "$500 one-time", es: "$500 pago único" },
  "pricing.addon4.name": { en: "HIPAA compliance add-on", es: "Complemento de cumplimiento HIPAA" },
  "pricing.addon4.price": { en: "$50/mo", es: "$50/mes" },
  /* Texting is built but off by default and unpriced — shown as an add-on, never as included */
  "pricing.addon5.name": {
    en: "Text (SMS) alerts — optional add-on",
    es: "Avisos por mensaje de texto (SMS) — complemento opcional",
  },
  "pricing.addon5.price": { en: "Pricing on request", es: "Precio a consultar" },

  /* ─── Pricing / FAQ — shared number Q&As ─── */
  "faq.number.q": { en: "Can I use my existing phone number?", es: "¿Puedo usar mi número de teléfono actual?" },
  "faq.number.a": {
    en: "Yes, but our honest recommendation is to start with a new ReceptionAI number. You're live in minutes, every call is recorded and summarized straight to your inbox, and your existing number keeps working for outbound calls, existing customers, and emergencies. Porting your number to us is possible, but we don't recommend it: it typically takes 1–4 weeks with your current carrier, can briefly interrupt service if anything slips, and adds friction you don't need on day one. If you still want to port, we'll handle it with you directly — you send a recent bill and sign a letter of authorization, we submit the port, and we update you at every step. Talk to our team and we'll guide you through it.",
    es: "Sí, pero nuestra recomendación honesta es empezar con un número nuevo de ReceptionAI. Estás en funcionamiento en minutos, cada llamada se graba y se resume directo a tu correo, y tu número actual sigue funcionando para llamadas salientes, clientes existentes y emergencias. Portar tu número a nosotros es posible, pero no lo recomendamos: normalmente toma de 1 a 4 semanas con tu operador actual, puede interrumpir brevemente el servicio si algo falla, y agrega fricción que no necesitas el primer día. Si aun así quieres portar, lo manejamos contigo directamente: nos envías una factura reciente y firmas una carta de autorización, nosotros enviamos la solicitud de portabilidad y te actualizamos en cada paso. Habla con nuestro equipo y te guiaremos.",
  },
  "faq.forward.q": { en: "Can I keep my old number without porting?", es: "¿Puedo conservar mi número anterior sin portarlo?" },
  "faq.forward.a": {
    en: "Yes — and this is what most of our customers do. Ask your current carrier to forward calls from your existing number to your new ReceptionAI number. Your old number keeps ringing, callers never notice a change, and your AI receptionist answers every call. No porting delays, no downtime, no risk. We'll give you the exact forwarding instructions for your carrier.",
    es: "Sí — y esto es lo que hacen la mayoría de nuestros clientes. Pide a tu operador actual que reenvíe las llamadas de tu número existente a tu nuevo número de ReceptionAI. Tu número anterior sigue sonando, los llamantes no notan ningún cambio y tu recepcionista IA responde cada llamada. Sin demoras de portabilidad, sin tiempo de inactividad, sin riesgo. Te daremos las instrucciones de reenvío exactas para tu operador.",
  },

  /* ─── Pricing — FAQ list ─── */
  "pricing.faq.title": { en: "Frequently Asked Questions", es: "Preguntas Frecuentes" },
  "pricing.faq1.q": { en: "Can I switch plans later?", es: "¿Puedo cambiar de plan más adelante?" },
  "pricing.faq1.a": {
    en: "Yes. Once your first month is behind you, Billing shows a Manage subscription block where you can move to a bigger plan; Stripe changes the subscription you already have rather than starting a second one. The month you have already paid for is charged in full and is not prorated — nothing changes until you confirm it.",
    es: "Sí. Cuando ya pasó tu primer mes, Facturación muestra un bloque de Gestionar suscripción donde puedes pasar a un plan mayor; Stripe cambia la suscripción que ya tienes en lugar de abrir una segunda. El mes que ya pagaste se cobra completo y no se prorratea — nada cambia hasta que lo confirmes.",
  },
  "pricing.faq2.q": { en: "What happens if I run out of AI-minutes?", es: "¿Qué pasa si se me acaban los minutos de IA?" },
  "pricing.faq2.a": {
    en: "Nothing is charged automatically for extra minutes today — there are no overage fees. If your call volume outgrows your plan, contact us and we'll help you move to a larger one: Growth includes 2,000 AI-minutes a month, Scale includes 10,000+.",
    es: "Hoy no se cobra automáticamente por minutos adicionales: no hay cargos por exceso. Si tu volumen de llamadas supera lo que incluye tu plan, contáctanos y te ayudamos a pasar a uno mayor: Growth incluye 2,000 minutos de IA al mes y Scale incluye 10,000+.",
  },
  "pricing.faq3.q": { en: "Is there a long-term contract?", es: "¿Hay un contrato a largo plazo?" },
  "pricing.faq3.a": {
    en: "No. All plans are month-to-month. You can cancel anytime — no penalties, no hidden fees.",
    es: "No. Todos los planes son mes a mes. Puedes cancelar cuando quieras — sin penalizaciones, sin cargos ocultos.",
  },
  "pricing.faq4.q": { en: "How does billing work?", es: "¿Cómo funciona la facturación?" },
  "pricing.faq4.a": {
    en: "You're charged at checkout for your first month; the plan renews monthly at the same price until you cancel. Cancel anytime.",
    es: "Se te cobra el primer mes al finalizar la compra; el plan se renueva mensualmente al mismo precio hasta que canceles. Cancela cuando quieras.",
  },

  /* ─── Pricing — CTA ─── */
  "pricing.cta.title": { en: "Still have questions?", es: "¿Aún tienes preguntas?" },
  "pricing.cta.subtitle": {
    en: "Talk to our team. We'll help you find the perfect plan for your business.",
    es: "Habla con nuestro equipo. Te ayudaremos a encontrar el plan perfecto para tu negocio.",
  },
  /* The secondary button is the real demo line, not a sales team that doesn't exist. */
  "pricing.cta.demo": {
    en: "Hear the live demo — (727) 966-7556",
    es: "Escucha la demo en vivo — (727) 966-7556",
  },

  /* ─── FAQ page — hero ─── */
  "faq.hero.title": { en: "Getting Started with ReceptionAI", es: "Cómo Empezar con ReceptionAI" },
  "faq.hero.subtitle": {
    en: "Everything you need to know to sign up, log in, and start using your AI receptionist.",
    es: "Todo lo que necesitas saber para registrarte, iniciar sesión y comenzar a usar tu recepcionista IA.",
  },

  /* ─── FAQ page — Signup SOP ─── */
  "faq.signup.title": { en: "Sign Up for Your Plan", es: "Regístrate para tu Plan" },
  "faq.signup.stepsTitle": { en: "Step-by-Step", es: "Paso a Paso" },
  "faq.signup.step1": {
    en: "Go to the signup page — visit receptionai.store/signup or click Start Today from the homepage.",
    es: "Ve a la página de registro — visita receptionai.store/signup o haz clic en Comenzar Hoy desde la página principal.",
  },
  "faq.signup.step2": {
    en: "Enter your full name. This will appear on your account and in communications.",
    es: "Ingresa tu nombre completo. Aparecerá en tu cuenta y en las comunicaciones.",
  },
  "faq.signup.step3": {
    en: "Enter your email address. Use your business email — this is where login links and notifications will be sent.",
    es: "Ingresa tu correo electrónico. Usa tu correo de negocio — ahí se enviarán los enlaces de inicio de sesión y las notificaciones.",
  },
  "faq.signup.step4": {
    en: "Choose your plan. Select Starter ($99/mo), Growth ($199/mo), or Scale ($399/mo) from the dropdown. Your first month is charged at checkout, then renews monthly. Cancel anytime.",
    es: "Elige tu plan. Selecciona Starter ($99/mes), Growth ($199/mes) o Scale ($399/mes) del menú desplegable. Tu primer mes se cobra al finalizar la compra y luego se renueva mensualmente. Cancela cuando quieras.",
  },
  "faq.signup.step5": { en: "Create a password. Must be at least 8 characters.", es: "Crea una contraseña. Debe tener al menos 8 caracteres." },
  "faq.signup.step6": { en: "Check the terms box and click Start Today.", es: "Marca la casilla de términos y haz clic en Comenzar Hoy." },
  "faq.signup.step7": {
    en: "Complete payment. You'll be redirected to Stripe's secure checkout. Enter your card details. You'll be charged for your first month. No hidden fees — your plan renews monthly and you can cancel anytime.",
    es: "Completa el pago. Serás redirigido al checkout seguro de Stripe. Ingresa los datos de tu tarjeta. Se te cobrará el primer mes. Sin cargos ocultos — tu plan se renueva mensualmente y puedes cancelar cuando quieras.",
  },
  "faq.signup.step8": {
    en: "Done! After payment, your account is created automatically — your phone number is provisioned and your dashboard is ready.",
    es: "¡Listo! Después del pago, tu cuenta se crea automáticamente — tu número de teléfono se aprovisiona y tu panel está listo.",
  },
  "faq.signup.caption": {
    en: "The signup form — fill in your details, pick a plan, and start.",
    es: "El formulario de registro — completa tus datos, elige un plan y comienza.",
  },
  "faq.signup.founderNote": {
    en: "FOUNDER50 Discount: Use code FOUNDER50 at checkout for 50% off your first 3 months. This is automatically applied during signup.",
    es: "Descuento FOUNDER50: Usa el código FOUNDER50 al pagar para obtener 50% de descuento en tus primeros 3 meses. Se aplica automáticamente durante el registro.",
  },

  /* ─── FAQ page — Login SOP ─── */
  "faq.login.title": { en: "Log In to Your Dashboard", es: "Inicia Sesión en tu Panel" },
  "faq.login.step1": { en: "Go to the login page — visit receptionai.store/login.", es: "Ve a la página de inicio de sesión — visita receptionai.store/login." },
  "faq.login.step2": {
    en: "Enter your email and password — the same ones you used during signup.",
    es: "Ingresa tu correo y contraseña — los mismos que usaste durante el registro.",
  },
  "faq.login.step3": { en: "Click Sign In. You'll be taken to your dashboard immediately.", es: "Haz clic en Iniciar Sesión. Serás llevado a tu panel de inmediato." },
  "faq.login.step4": {
    en: "Forgot your password? Click the Forgot password? link on the login page. Enter your email and we'll send you a reset link.",
    es: "¿Olvidaste tu contraseña? Haz clic en el enlace ¿Olvidaste tu contraseña? en la página de inicio de sesión. Ingresa tu correo y te enviaremos un enlace de restablecimiento.",
  },
  "faq.login.caption": {
    en: "The login page — use the email and password you created during signup.",
    es: "La página de inicio de sesión — usa el correo y la contraseña que creaste durante el registro.",
  },

  /* ─── FAQ page — FAQ list ─── */
  "faq.list.title": { en: "Frequently Asked Questions", es: "Preguntas Frecuentes" },
  "faq.list.q1": { en: "How does billing work?", es: "¿Cómo funciona la facturación?" },
  "faq.list.a1": {
    en: "You're charged at checkout for your first month; the plan renews monthly at the same price until you cancel. Cancel anytime.",
    es: "Se te cobra el primer mes al finalizar la compra; el plan se renueva mensualmente al mismo precio hasta que canceles. Cancela cuando quieras.",
  },
  "faq.list.q2": { en: "What happens after I sign up?", es: "¿Qué pasa después de registrarme?" },
  "faq.list.a2": {
    en: "Your account is created automatically. A phone number is provisioned for your business, and your dashboard is ready immediately. You can start receiving calls right away.",
    es: "Tu cuenta se crea automáticamente. Se aprovisiona un número de teléfono para tu negocio y tu panel está listo de inmediato. Puedes empezar a recibir llamadas enseguida.",
  },
  "faq.list.q3": { en: "How do I cancel?", es: "¿Cómo cancelo?" },
  "faq.list.a3": {
    en: "Go to your dashboard Settings page and click Cancel Subscription. No phone calls, no hassle. You'll retain access until the end of your billing period.",
    es: "Ve a la página de Configuración de tu panel y haz clic en Cancelar Suscripción. Sin llamadas, sin complicaciones. Conservarás el acceso hasta el final de tu período de facturación.",
  },
  "faq.list.q4": { en: "What if I need help?", es: "¿Qué hago si necesito ayuda?" },
  "faq.list.a4": {
    en: "Your dashboard includes a help widget in the bottom-right corner. You can also email us at support@receptionai.store.",
    es: "Tu panel incluye un widget de ayuda en la esquina inferior derecha. También puedes escribirnos a support@receptionai.store.",
  },
  "faq.list.q5": { en: "Does the AI speak Spanish?", es: "¿La IA habla español?" },
  "faq.list.a5": {
    en: "Yes! ReceptionAI handles calls and web chats in both English and Spanish, and the owner notifications go out in the caller's language. Callers can switch languages at any time.",
    es: "¡Sí! ReceptionAI maneja llamadas y chats web tanto en inglés como en español, y las notificaciones al dueño llegan en el idioma del cliente. Los llamantes pueden cambiar de idioma en cualquier momento.",
  },
  "faq.list.q6": { en: "What happens if the AI can't handle a call?", es: "¿Qué pasa si la IA no puede manejar una llamada?" },
  "faq.list.a6": {
    en: "The system automatically transfers to a human. You can set your forwarding number in the dashboard Settings. Our target is to handle 85%+ of calls without escalation.",
    es: "El sistema transfiere automáticamente a un humano. Puedes configurar tu número de reenvío en la Configuración del panel. Nuestro objetivo es manejar más del 85% de las llamadas sin escalamiento.",
  },
  "faq.list.q7": { en: "Can I change my plan later?", es: "¿Puedo cambiar mi plan más adelante?" },
  "faq.list.a7": {
    en: "Absolutely. Upgrade or downgrade anytime from your dashboard. Changes take effect at the start of your next billing period.",
    es: "Por supuesto. Sube o baja de plan en cualquier momento desde tu panel. Los cambios se aplican al inicio de tu siguiente período de facturación.",
  },
  "faq.list.q8": { en: "Is my data secure?", es: "¿Mis datos están seguros?" },
  "faq.list.a8": {
    en: "Yes. All data is encrypted in transit and at rest. We use Stripe for payment processing — we never store your credit card details. See our Privacy Policy for full details.",
    es: "Sí. Todos los datos están encriptados en tránsito y en reposo. Usamos Stripe para el procesamiento de pagos — nunca almacenamos los datos de tu tarjeta. Consulta nuestra Política de Privacidad para más detalles.",
  },
  "faq.list.q9": { en: "Do I need to install anything?", es: "¿Necesito instalar algo?" },
  "faq.list.a9": {
    en: "No. Everything runs in the cloud. You access your dashboard through any web browser. No apps to install, no hardware to buy.",
    es: "No. Todo funciona en la nube. Accedes a tu panel desde cualquier navegador web. Sin aplicaciones que instalar, sin hardware que comprar.",
  },

  /* ─── FAQ page — CTA ─── */
  "faq.cta.title": { en: "Ready to get started?", es: "¿Listo para comenzar?" },
  "faq.cta.subtitle": {
    en: "Start today and see how ReceptionAI handles your inbound calls and messages.",
    es: "Comienza hoy y descubre cómo ReceptionAI maneja tus llamadas y mensajes entrantes.",
  },
  "faq.cta.button": { en: "Start Today", es: "Comenzar Hoy" },

  /* ─── FAQ page — the nine plain answers ─── */
  /* Every sentence here is a fact about the product as it ships today. If a capability is
     missing, the answer says it is missing — the page never describes self-serve setup we do
     not have (number provisioning, Google/Outlook sync, carrier-approved texting). */
  "faq.hero.title2": { en: "Questions, answered plainly", es: "Preguntas, respondidas con claridad" },
  "faq.hero.subtitle2": {
    en: "Nine plain answers about the phone number, what happens after you pay, and what the AI can and cannot do.",
    es: "Nueve respuestas claras sobre el número de teléfono, lo que pasa después de pagar y lo que la IA puede y no puede hacer.",
  },
  "faq.n1.q": { en: "Do I get my own phone number?", es: "¿Recibo mi propio número de teléfono?" },
  "faq.n1.a": {
    en: "Yes. Your plan includes a phone number for your business — Starter one line, Growth two — and extra numbers are $15 a month each. Your receptionist answers on that number, and we set it up with you during onboarding. If you would rather keep the number your customers already dial, ask your carrier to forward it to your ReceptionAI number.",
    es: "Sí. Tu plan incluye un número de teléfono para tu negocio — Starter una línea, Growth dos — y cada número extra cuesta $15 al mes. Tu recepcionista contesta en ese número y lo configuramos contigo durante la puesta en marcha. Si prefieres conservar el número que tus clientes ya marcan, pide a tu operador que lo reenvíe a tu número de ReceptionAI.",
  },
  "faq.n2.q": {
    en: "How do I know it works before I trust it with customers?",
    es: "¿Cómo sé que funciona antes de confiárselo a mis clientes?",
  },
  "faq.n2.a": {
    en: "Call it and book something. The three steps are in “Test it yourself” on your Getting Started page. The appointment appears on your Schedule screen and the “New booking” alert lands in your inbox — the same path a real customer's booking takes.",
    es: "Llama y agenda algo. Los tres pasos están en “Pruébalo tú mismo” en tu página de primeros pasos. La cita aparece en tu pantalla de Agenda y el aviso de “Nueva reserva” llega a tu correo — el mismo camino que toma la reserva de un cliente real.",
  },
  "faq.n3.q": { en: "What happens after I pay?", es: "¿Qué pasa después de pagar?" },
  "faq.n3.a": {
    en: "Four steps, all in your dashboard: (1) Tell us about your business — name, type, hours and services, about five minutes in Setup. (2) Test your line — call it, book something, and see it on Schedule. (3) Add your team's transfer number — where a caller goes when they press 3. (4) Go live — we confirm everything with you before you point customers at it. You land on that screen when your setup finishes, and the same four steps are in your welcome email.",
    es: "Cuatro pasos, todos en tu panel: (1) Cuéntanos de tu negocio — nombre, tipo, horarios y servicios, unos cinco minutos en Configuración. (2) Prueba tu línea — llama, agenda algo y míralo en Agenda. (3) Agrega el número de transferencia de tu equipo — a dónde va quien llama cuando presiona 3. (4) Sal en vivo — confirmamos todo contigo antes de que dirijas clientes hacia ella. Llegas a esa pantalla al terminar tu configuración, y los mismos cuatro pasos están en tu correo de bienvenida.",
  },
  "faq.n4.q": { en: "Can I upgrade?", es: "¿Puedo subir de plan?" },
  "faq.n4.a": {
    en: "Yes. Once your first month is behind you, Billing shows a small Manage subscription block with an Upgrade button. It opens the Stripe billing portal, where you choose the bigger plan — Stripe changes the subscription you already have rather than starting a second one, so you are never billed twice. Nothing changes until you press it.",
    es: "Sí. Cuando ya pasó tu primer mes, Facturación muestra un bloque pequeño de Gestionar suscripción con un botón para subir de plan. Abre el portal de Stripe, donde eliges el plan mayor — Stripe cambia la suscripción que ya tienes en lugar de abrir una segunda, así que nunca se te cobra dos veces. Nada cambia hasta que lo pulsas.",
  },
  "faq.n5.q": { en: "Can I cancel?", es: "¿Puedo cancelar?" },
  "faq.n5.a": {
    en: "Yes. After your first month, Billing shows a small Manage subscription block with a Cancel subscription option. It asks one required question about why you are leaving, with room for a comment, and then cancels at the end of the month you have already paid for — you keep working service to the last day of that month, the page names the exact date, and you can undo it from the same block until then. The first month is not refundable and nothing is prorated back.",
    es: "Sí. Después de tu primer mes, Facturación muestra un bloque pequeño de Gestionar suscripción con la opción de cancelar. Hace una pregunta obligatoria sobre por qué te vas, con espacio para un comentario, y luego cancela al final del mes que ya pagaste — sigues con el servicio hasta el último día de ese mes, la página indica la fecha exacta, y puedes deshacerlo desde el mismo bloque hasta entonces. El primer mes no es reembolsable y no se devuelve nada a prorrata.",
  },
  "faq.n6.q": { en: "What does it cost per call, or per minute?", es: "¿Cuánto cuesta por llamada o por minuto?" },
  "faq.n6.a": {
    en: "Nothing per call. Each plan includes a monthly allowance of AI minutes — Starter 500, Growth 2,000, Scale 10,000+ — and the dashboard meters the minutes your calls actually use. There are no overage charges today: if your volume outgrows your plan, message us and we will move you to a bigger one.",
    es: "Nada por llamada. Cada plan incluye una asignación mensual de minutos de IA — Starter 500, Growth 2,000, Scale 10,000+ — y el panel mide los minutos que tus llamadas usan de verdad. Hoy no hay cargos por exceso: si tu volumen supera tu plan, escríbenos y te pasamos a uno mayor.",
  },
  "faq.n7.q": {
    en: "Is my customer data safe? Are you HIPAA compliant?",
    es: "¿Están seguros los datos de mis clientes? ¿Cumplen con HIPAA?",
  },
  "faq.n7.a": {
    en: "We are not HIPAA compliant, and we do not sell to anyone who needs that — please do not use ReceptionAI for protected health information. Your card details never reach our servers; Stripe handles the payment. Call records, transcripts and recordings stay inside your own account: only you and the people you add to your team can see them, plus our support team when you ask us to look into a problem.",
    es: "No cumplimos con HIPAA, y no vendemos a quien lo necesite — por favor no uses ReceptionAI para información de salud protegida. Los datos de tu tarjeta nunca llegan a nuestros servidores; Stripe procesa el pago. Las llamadas, transcripciones y grabaciones quedan dentro de tu propia cuenta: solo tú y las personas que agregues a tu equipo pueden verlas, y nuestro equipo de soporte cuando nos pides revisar un problema.",
  },
  "faq.n8.q": { en: "Does it speak Spanish?", es: "¿Habla español?" },
  "faq.n8.a": {
    en: "Yes. Callers choose English or Spanish before the menu, and the greeting and the menu are spoken in the language they picked. A Spanish-speaking caller books an appointment the same way an English-speaking one does.",
    es: "Sí. Quien llama elige inglés o español antes del menú, y el saludo y el menú se dicen en el idioma que eligió. Un cliente que habla español agenda una cita igual que uno que habla inglés.",
  },
  "faq.n9.q": { en: "What if the AI cannot answer?", es: "¿Y si la IA no puede responder?" },
  "faq.n9.a": {
    en: "Press 3 at any time and it dials your number and bridges the call the moment you answer. If you do not pick up, the caller is told someone will call back and you are alerted. A caller can also leave a voicemail, which you can play from your dashboard.",
    es: "Presiona 3 en cualquier momento y marca tu número y conecta la llamada en cuanto contestes. Si no contestas, a quien llama se le dice que alguien devolverá la llamada y a ti te llega un aviso. También puede dejar un mensaje de voz, que puedes escuchar desde tu panel.",
  },
  "faq.selfserve.testLink": {
    en: "Test it yourself — call the line and book something",
    es: "Pruébalo tú mismo — llama a la línea y agenda algo",
  },

  /* ─── Footer ─── */
  "footer.tagline": {
    en: "AI-powered receptionist for modern small businesses.",
    es: "Recepcionista con IA para pequeños negocios modernos.",
  },
  "footer.product": { en: "Product", es: "Producto" },
  "footer.company": { en: "Company", es: "Empresa" },
  "footer.support": { en: "Support", es: "Soporte" },
  "footer.privacy": { en: "Privacy Policy", es: "Política de Privacidad" },
  "footer.terms": { en: "Terms of Service", es: "Términos del Servicio" },
  "footer.contact": { en: "Contact", es: "Contacto" },
  "footer.about": { en: "About", es: "Acerca de" },
  "footer.email": { en: "Email us", es: "Escríbenos" },
  "footer.demoNote": {
    en: "Live demo line — you'll hear the AI, not a person.",
    es: "Línea de demostración en vivo — escucharás a la IA, no a una persona.",
  },
  "footer.operator": {
    en: "ReceptionAI is operated by Carm Marketing LLC.",
    es: "ReceptionAI es operado por Carm Marketing LLC.",
  },
  "footer.copyright": {
    en: "© 2026 ReceptionAI. All rights reserved.",
    es: "© 2026 ReceptionAI. Todos los derechos reservados.",
  },


  /* ─── Page bodies: features, demo, about, contact, book, hvac, privacy, terms ─── */
  /* Keyed by the English source text so a missing entry falls back to English
     instead of a blank space. Nothing here says more than the English does. */
  "\"AS IS\" and \"AS AVAILABLE\"": { en: "\"AS IS\" and \"AS AVAILABLE\"", es: "«TAL CUAL» y «SEGÚN DISPONIBILIDAD»" },
  "1. Acceptance of Terms": { en: "1. Acceptance of Terms", es: "1. Aceptación de los Términos" },
  "1. Information We Collect": { en: "1. Information We Collect", es: "1. Información que recopilamos" },
  "10. Indemnification": { en: "10. Indemnification", es: "10. Indemnización" },
  "11. Changes to Terms": { en: "11. Changes to Terms", es: "11. Cambios a los Términos" },
  "12. Governing Law": { en: "12. Governing Law", es: "12. Ley aplicable" },
  "13. Contact": { en: "13. Contact", es: "13. Contacto" },
  "2. How We Use Your Information": { en: "2. How We Use Your Information", es: "2. Cómo usamos tu información" },
  "2. Service Description": { en: "2. Service Description", es: "2. Descripción del Servicio" },
  "3. Data Sharing": { en: "3. Data Sharing", es: "3. Cómo compartimos los datos" },
  "3. No Guarantee of Availability": { en: "3. No Guarantee of Availability", es: "3. Sin garantía de disponibilidad" },
  "4. Data Retention": { en: "4. Data Retention", es: "4. Conservación de los datos" },
  "4. Limitation of Liability": { en: "4. Limitation of Liability", es: "4. Limitación de responsabilidad" },
  "4a. No Liability": { en: "4a. No Liability", es: "4a. Sin responsabilidad" },
  "5. AI Limitations": { en: "5. AI Limitations", es: "5. Limitaciones de la IA" },
  "5. Security": { en: "5. Security", es: "5. Seguridad" },
  "6. Third-Party Services": { en: "6. Third-Party Services", es: "6. Servicios de terceros" },
  "6. Your Rights": { en: "6. Your Rights", es: "6. Tus derechos" },
  "7. Customer Responsibilities": { en: "7. Customer Responsibilities", es: "7. Responsabilidades del cliente" },
  "7. Text Messaging (SMS)": { en: "7. Text Messaging (SMS)", es: "7. Mensajes de texto (SMS)" },
  "8. Call Recording and Privacy": { en: "8. Call Recording and Privacy", es: "8. Grabación de llamadas y privacidad" },
  "8. Contact": { en: "8. Contact", es: "8. Contacto" },
  "9. Termination": { en: "9. Termination", es: "9. Terminación" },
  "A features page is easy to fill with things that are not finished. We would rather show you six features marked Partial than six marked Live that fall apart on your first call. If something you need is not ready, tell us — it is how the roadmap gets prioritized.": { en: "A features page is easy to fill with things that are not finished. We would rather show you six features marked Partial than six marked Live that fall apart on your first call. If something you need is not ready, tell us — it is how the roadmap gets prioritized.", es: "Una página de funciones es fácil de llenar con cosas que no están terminadas. Preferimos mostrarte seis funciones marcadas como Parciales que seis marcadas como Activas que se caen en tu primera llamada. Si algo que necesitas no está listo, dínoslo — así es como se prioriza el plan de trabajo." },
  "A receptionist that never": { en: "A receptionist that never", es: "Una recepcionista que nunca" },
  "A small service business runs on the phone. The problem is that the phone rings at the worst possible moment — while you are under a sink, on a roof, in an exam room, or driving between jobs.": { en: "A small service business runs on the phone. The problem is that the phone rings at the worst possible moment — while you are under a sink, on a roof, in an exam room, or driving between jobs.", es: "Un pequeño negocio de servicios vive del teléfono. El problema es que el teléfono suena en el peor momento — mientras estás debajo de un fregadero, en un techo, en un consultorio o manejando entre trabajos." },
  "Anything we should know...": { en: "Anything we should know...", es: "Algo que debamos saber..." },
  "ReceptionAI dashboard calendar showing booked appointments": { en: "ReceptionAI dashboard calendar showing booked appointments", es: "Panel de ReceptionAI con el calendario de citas reservadas" },
  "Your name": { en: "Your name", es: "Tu nombre" },
  "About ReceptionAI": { en: "About ReceptionAI", es: "Acerca de ReceptionAI" },
  "Akoni Cooling &amp; Heating — Powered by ReceptionAI": { en: "Akoni Cooling &amp; Heating — Powered by ReceptionAI", es: "Akoni Cooling &amp; Heating — Con la tecnología de ReceptionAI" },
  "All slots are booked for this date. Try another day.": { en: "All slots are booked for this date. Try another day.", es: "Todos los horarios de esta fecha están reservados. Prueba otro día." },
  "Also useful, if you have it: your current business hours, and the services you want the AI to be able to book.": { en: "Also useful, if you have it: your current business hours, and the services you want the AI to be able to book.", es: "También nos sirve, si lo tienes: tu horario actual y los servicios que quieres que la IA pueda reservar." },
  "Ask the chat widget": { en: "Ask the chat widget", es: "Pregunta en el chat" },
  "Auto-Confirmations": { en: "Auto-Confirmations", es: "Confirmaciones automáticas" },
  "Automatic reminders at 24h and 2h before each appointment": { en: "Automatic reminders at 24h and 2h before each appointment", es: "Recordatorios automáticos 24 h y 2 h antes de cada cita" },
  "Available": { en: "Available", es: "Disponible" },
  "Available in English & Spanish": { en: "Available in English & Spanish", es: "Disponible en inglés y español" },
  "Before you email": { en: "Before you email", es: "Antes de escribirnos" },
  "Book a Demo": { en: "Book a Demo", es: "Reservar una demo" },
  "Book a time with us": { en: "Book a time with us", es: "Reserva un horario con nosotros" },
  "Built-in Calendar": { en: "Built-in Calendar", es: "Calendario integrado" },
  "By using ReceptionAI (\"the Service\"), you agree to these Terms. If you do not agree, do not use the Service.": { en: "By using ReceptionAI (\"the Service\"), you agree to these Terms. If you do not agree, do not use the Service.", es: "Al usar ReceptionAI («el Servicio»), aceptas estos Términos. Si no estás de acuerdo, no uses el Servicio." },
  "Call": { en: "Call", es: "Llamar" },
  "Call answering, real bookings, reminders and post-call summaries are live on every plan today. The rest arrives as it is finished.": { en: "Call answering, real bookings, reminders and post-call summaries are live on every plan today. The rest arrives as it is finished.", es: "La contestación de llamadas, las reservas reales, los recordatorios y los resúmenes posteriores a la llamada están activos hoy en todos los planes. Lo demás llega a medida que se termina." },
  "Call recordings and transcriptions are retained for the duration of your account plus 90 days after termination. You may request deletion of your data by contacting us.": { en: "Call recordings and transcriptions are retained for the duration of your account plus 90 days after termination. You may request deletion of your data by contacting us.", es: "Las grabaciones y transcripciones de llamadas se conservan mientras dure tu cuenta y 90 días después de la cancelación. Puedes pedir la eliminación de tus datos escribiéndonos." },
  "Call the AI receptionist right now — it's live": { en: "Call the AI receptionist right now — it's live", es: "Llama ahora a la recepcionista de IA — está en vivo" },
  "Call the demo line": { en: "Call the demo line", es: "Llama a la línea de demostración" },
  "Call the demo line and hear it answer, or read the plans and what each one includes.": { en: "Call the demo line and hear it answer, or read the plans and what each one includes.", es: "Llama a la línea de demostración y escúchala contestar, o lee los planes y lo que incluye cada uno." },
  "Carm Marketing": { en: "Carm Marketing", es: "Carm Marketing" },
  "Coming soon": { en: "Coming soon", es: "Próximamente" },
  "Confirm Demo": { en: "Confirm Demo", es: "Confirmar demo" },
  "Contact": { en: "Contact", es: "Contacto" },
  "Contact us": { en: "Contact us", es: "Contáctanos" },
  "Date": { en: "Date", es: "Fecha" },
  "Demo Scheduled!": { en: "Demo Scheduled!", es: "¡Demo agendada!" },
  "Demo line": { en: "Demo line", es: "Línea de demostración" },
  "Email": { en: "Email", es: "Correo" },
  "Email confirmation sent instantly after booking": { en: "Email confirmation sent instantly after booking", es: "Correo de confirmación enviado al instante después de reservar" },
  "Every feature below carries its real status — Live, Partial, or Coming Soon — and the note on each card says exactly what runs today. If we cannot do it yet, the page says so.": { en: "Every feature below carries its real status — Live, Partial, or Coming Soon — and the note on each card says exactly what runs today. If we cannot do it yet, the page says so.", es: "Cada función de abajo lleva su estado real — Activa, Parcial o Próximamente — y la nota de cada tarjeta dice exactamente qué funciona hoy. Si algo todavía no lo podemos hacer, la página lo dice." },
  "Everything below is built and running in the product. Call the demo line and you can hear it.": { en: "Everything below is built and running in the product. Call the demo line and you can hear it.", es: "Todo lo de abajo está construido y funcionando en el producto. Llama a la línea de demostración y puedes escucharlo." },
  "Everything included": { en: "Everything included", es: "Todo incluido" },
  "Example calendar — sample appointments shown for illustration, not real customer data.": { en: "Example calendar — sample appointments shown for illustration, not real customer data.", es: "Calendario de ejemplo — citas de muestra con fines ilustrativos, no son datos reales de clientes." },
  "FOUNDER50 — 50% off your first 3 months. Cancel anytime.": { en: "FOUNDER50 — 50% off your first 3 months. Cancel anytime.", es: "FOUNDER50 — 50% de descuento en tus primeros 3 meses. Cancela cuando quieras." },
  "Fastest": { en: "Fastest", es: "Más rápido" },
  "Features": { en: "Features", es: "Funciones" },
  "For HVAC Contractors": { en: "For HVAC Contractors", es: "Para contratistas de HVAC" },
  "For anything that needs a longer answer — setup questions, billing, or a plan recommendation.": { en: "For anything that needs a longer answer — setup questions, billing, or a plan recommendation.", es: "Para todo lo que necesita una respuesta más larga — dudas de configuración, facturación o una recomendación de plan." },
  "For privacy questions, contact us through our website.": { en: "For privacy questions, contact us through our website.", es: "Para dudas de privacidad, contáctanos a través de nuestro sitio web." },
  "For questions about these Terms, contact us through our website.": { en: "For questions about these Terms, contact us through our website.", es: "Para dudas sobre estos Términos, contáctanos a través de nuestro sitio web." },
  "Full Name *": { en: "Full Name *", es: "Nombre completo *" },
  "Get Started": { en: "Get Started", es: "Comenzar" },
  "Get a Demo": { en: "Get a Demo", es: "Solicitar una demo" },
  "Hear the live demo — (727) 966-7556": { en: "Hear the live demo — (727) 966-7556", es: "Escucha la demo en vivo — (727) 966-7556" },
  "Honest answers": { en: "Honest answers", es: "Respuestas honestas" },
  "How it works for HVAC": { en: "How it works for HVAC", es: "Cómo funciona para HVAC" },
  "I'm interested in": { en: "I'm interested in", es: "Me interesa" },
  "Including these three things means we can answer properly the first time instead of going back and forth:": { en: "Including these three things means we can answer properly the first time instead of going back and forth:", es: "Incluir estas tres cosas nos permite responder bien la primera vez en lugar de ir y venir:" },
  "Interactive demo — watch how calls are handled automatically": { en: "Interactive demo — watch how calls are handled automatically", es: "Demo interactiva — mira cómo se atienden las llamadas automáticamente" },
  "Interest": { en: "Interest", es: "Interés" },
  "July 2026": { en: "July 2026", es: "Julio de 2026" },
  "Just Booked!": { en: "Just Booked!", es: "¡Recién reservada!" },
  "Last updated: July 2026": { en: "Last updated: July 2026", es: "Última actualización: julio de 2026" },
  "Live Demo": { en: "Live Demo", es: "Demo en vivo" },
  "Live in your account today": { en: "Live in your account today", es: "Activo en tu cuenta hoy" },
  "Live today": { en: "Live today", es: "Activo hoy" },
  "Month": { en: "Month", es: "Mes" },
  "Name": { en: "Name", es: "Nombre" },
  "Never miss an HVAC call again": { en: "Never miss an HVAC call again", es: "Nunca vuelvas a perder una llamada de HVAC" },
  "No Google OAuth. No external calendar.": { en: "No Google OAuth. No external calendar.", es: "Sin Google OAuth. Sin calendario externo." },
  "No available times": { en: "No available times", es: "No hay horarios disponibles" },
  "Not shipped yet": { en: "Not shipped yet", es: "Aún no disponible" },
  "Not sure yet?": { en: "Not sure yet?", es: "¿Todavía no estás seguro?" },
  "Notes (optional)": { en: "Notes (optional)", es: "Notas (opcional)" },
  "Open it with the \"Chat with us\" button.": { en: "Open it with the \"Chat with us\" button.", es: "Ábrelo con el botón «Chatea con nosotros»." },
  "Our total aggregate liability for any claims arising from the Service shall not exceed the amount paid by you for the Service in the twelve (12) months preceding the claim.": { en: "Our total aggregate liability for any claims arising from the Service shall not exceed the amount paid by you for the Service in the twelve (12) months preceding the claim.", es: "Nuestra responsabilidad total acumulada por cualquier reclamo derivado del Servicio no excederá la cantidad que hayas pagado por el Servicio en los doce (12) meses anteriores al reclamo." },
  "Owner gets an email summary after every call — no dashboard needed": { en: "Owner gets an email summary after every call — no dashboard needed", es: "El dueño recibe un resumen por correo después de cada llamada — sin necesidad de entrar al panel" },
  "Phone": { en: "Phone", es: "Teléfono" },
  "Phone *": { en: "Phone *", es: "Teléfono *" },
  "Plan tags show where a feature belongs on the roadmap. A tag never means the feature is switched on — the chip and the note do.": { en: "Plan tags show where a feature belongs on the roadmap. A tag never means the feature is switched on — the chip and the note do.", es: "Las etiquetas de plan muestran a qué parte del plan de trabajo pertenece una función. Una etiqueta nunca significa que la función esté activada — lo dicen la insignia de estado y la nota." },
  "Please pick a different date.": { en: "Please pick a different date.", es: "Elige otra fecha, por favor." },
  "Post-Call Email": { en: "Post-Call Email", es: "Correo posterior a la llamada" },
  "Prefer to talk to a person?": { en: "Prefer to talk to a person?", es: "¿Prefieres hablar con una persona?" },
  "Preferred Date *": { en: "Preferred Date *", es: "Fecha preferida *" },
  "Privacy Policy": { en: "Privacy Policy", es: "Política de Privacidad" },
  "Questions HVAC contractors actually ask": { en: "Questions HVAC contractors actually ask", es: "Las preguntas que de verdad hacen los contratistas de HVAC" },
  "Questions about plans, setup, or whether ReceptionAI fits your business — email us, or ask the chat widget on this page. Every message goes to a person.": { en: "Questions about plans, setup, or whether ReceptionAI fits your business — email us, or ask the chat widget on this page. Every message goes to a person.", es: "Dudas sobre planes, configuración o si ReceptionAI encaja con tu negocio — escríbenos o pregunta en el chat de esta página. Cada mensaje llega a una persona." },
  "Ready to never miss an HVAC call again?": { en: "Ready to never miss an HVAC call again?", es: "¿Listo para no volver a perder una llamada de HVAC?" },
  "ReceptionAI": { en: "ReceptionAI", es: "ReceptionAI" },
  "ReceptionAI and its owners, employees, and affiliates shall NOT be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to lost profits, lost revenue, lost business opportunities, missed appointments, missed calls, customer dissatisfaction, or any other commercial or economic loss arising from or relating to the use or inability to use the Service.": { en: "ReceptionAI and its owners, employees, and affiliates shall NOT be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to lost profits, lost revenue, lost business opportunities, missed appointments, missed calls, customer dissatisfaction, or any other commercial or economic loss arising from or relating to the use or inability to use the Service.", es: "ReceptionAI y sus dueños, empleados y afiliados NO serán responsables de daños indirectos, incidentales, especiales, consecuentes o punitivos, incluidos, entre otros, lucro cesante, pérdida de ingresos, pérdida de oportunidades de negocio, citas perdidas, llamadas perdidas, insatisfacción del cliente o cualquier otra pérdida comercial o económica derivada del uso o de la imposibilidad de usar el Servicio." },
  "ReceptionAI exists so that call gets answered: the caller's name and number are taken, the appointment is booked into your calendar while they are still on the line, and you get an email telling you what happened.": { en: "ReceptionAI exists so that call gets answered: the caller's name and number are taken, the appointment is booked into your calendar while they are still on the line, and you get an email telling you what happened.", es: "ReceptionAI existe para que esa llamada se conteste: se toman el nombre y el número de quien llama, la cita se reserva en tu calendario mientras la persona sigue en la línea, y tú recibes un correo contándote qué pasó." },
  "ReceptionAI has its own scheduling system. Set your business hours and it handles everything — bookings, reminders, and follow-ups.": { en: "ReceptionAI has its own scheduling system. Set your business hours and it handles everything — bookings, reminders, and follow-ups.", es: "ReceptionAI tiene su propio sistema de agenda. Configura tu horario y él se encarga de todo — reservas, recordatorios y seguimientos." },
  "ReceptionAI is an AI receptionist for small service businesses. It answers your calls 24/7 in English and Spanish, books appointments against live availability, emails web bookings a confirmation and reminders, and emails you a summary after every call.": { en: "ReceptionAI is an AI receptionist for small service businesses. It answers your calls 24/7 in English and Spanish, books appointments against live availability, emails web bookings a confirmation and reminders, and emails you a summary after every call.", es: "ReceptionAI es una recepcionista de IA para pequeños negocios de servicios. Contesta tus llamadas 24/7 en inglés y español, agenda citas con la disponibilidad en vivo, envía por correo la confirmación y los recordatorios de las reservas hechas en la web, y te manda un resumen por correo después de cada llamada." },
  "ReceptionAI is an AI service. We are not liable for missed calls, lost bookings, AI errors, or service interruptions. We will do our best to help, but we guarantee nothing. Use at your own risk.": { en: "ReceptionAI is an AI service. We are not liable for missed calls, lost bookings, AI errors, or service interruptions. We will do our best to help, but we guarantee nothing. Use at your own risk.", es: "ReceptionAI es un servicio de IA. No somos responsables de llamadas perdidas, reservas perdidas, errores de la IA ni interrupciones del servicio. Haremos lo posible por ayudar, pero no garantizamos nada. Úsalo bajo tu propio riesgo." },
  "ReceptionAI is new, so we're not going to quote customers we don't have yet. Call the number below and check every one of these yourself.": { en: "ReceptionAI is new, so we're not going to quote customers we don't have yet. Call the number below and check every one of these yourself.", es: "ReceptionAI es nuevo, así que no vamos a citar clientes que todavía no tenemos. Llama al número de abajo y comprueba cada uno de estos puntos tú mismo." },
  "ReceptionAI is operated by Carm Marketing LLC.": { en: "ReceptionAI is operated by Carm Marketing LLC.", es: "ReceptionAI es operado por Carm Marketing LLC." },
  "ReceptionAI provides an AI-powered virtual receptionist that answers phone calls and web chats. The Service uses artificial intelligence and automated systems to respond to inquiries, schedule appointments, and route calls.": { en: "ReceptionAI provides an AI-powered virtual receptionist that answers phone calls and web chats. The Service uses artificial intelligence and automated systems to respond to inquiries, schedule appointments, and route calls.", es: "ReceptionAI ofrece una recepcionista virtual con IA que contesta llamadas telefónicas y chats web. El Servicio usa inteligencia artificial y sistemas automatizados para responder consultas, agendar citas y transferir llamadas." },
  "Review your demo details.": { en: "Review your demo details.", es: "Revisa los datos de tu demo." },
  "Schedule Another": { en: "Schedule Another", es: "Agendar otra" },
  "Schedule a call to see how ReceptionAI works for your business.": { en: "Schedule a call to see how ReceptionAI works for your business.", es: "Agenda una llamada para ver cómo funciona ReceptionAI en tu negocio." },
  "See ReceptionAI in action": { en: "See ReceptionAI in action", es: "Mira ReceptionAI en acción" },
  "See pricing": { en: "See pricing", es: "Ver precios" },
  "See the features": { en: "See the features", es: "Ver las funciones" },
  "See what each plan includes": { en: "See what each plan includes", es: "Ver lo que incluye cada plan" },
  "Select a Time": { en: "Select a Time", es: "Elige un horario" },
  "Smart Reminders": { en: "Smart Reminders", es: "Recordatorios inteligentes" },
  "Start Today": { en: "Start Today", es: "Empieza hoy" },
  "Start today — founders get 50% off your first 3 months. Your AI receptionist goes live in minutes — not days.": { en: "Start today — founders get 50% off your first 3 months. Your AI receptionist goes live in minutes — not days.", es: "Empieza hoy — los fundadores tienen 50% de descuento en sus primeros 3 meses. Tu recepcionista de IA queda activa en minutos, no en días." },
  "Start with what already works": { en: "Start with what already works", es: "Empieza con lo que ya funciona" },
  "TO THE MAXIMUM EXTENT PERMITTED BY LAW:": { en: "TO THE MAXIMUM EXTENT PERMITTED BY LAW:", es: "EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY:" },
  "Talk to a human": { en: "Talk to a human", es: "Hablar con una persona" },
  "Terms of Service": { en: "Terms of Service", es: "Términos del Servicio" },
  "Thank you for calling. How can I help you today?": { en: "Thank you for calling. How can I help you today?", es: "Gracias por llamar. ¿Cómo puedo ayudarte hoy?" },
  "The Service is provided on an": { en: "The Service is provided on an", es: "El Servicio se ofrece" },
  "The Service may record and transcribe calls for quality and training purposes. You are responsible for providing required disclosures to your callers regarding call recording, as required by applicable laws in your jurisdiction.": { en: "The Service may record and transcribe calls for quality and training purposes. You are responsible for providing required disclosures to your callers regarding call recording, as required by applicable laws in your jurisdiction.", es: "El Servicio puede grabar y transcribir llamadas con fines de calidad y capacitación. Eres responsable de dar a quienes te llaman los avisos requeridos sobre la grabación de llamadas, según lo exijan las leyes aplicables en tu jurisdicción." },
  "The Service relies on third-party providers including telecommunications carriers, cloud hosting services, and AI model providers. We are not responsible for failures, outages, or policy changes by these third parties.": { en: "The Service relies on third-party providers including telecommunications carriers, cloud hosting services, and AI model providers. We are not responsible for failures, outages, or policy changes by these third parties.", es: "El Servicio depende de proveedores externos, incluidas operadoras de telecomunicaciones, servicios de alojamiento en la nube y proveedores de modelos de IA. No somos responsables de fallas, caídas o cambios de políticas de estos terceros." },
  "The built-in calendar in the dashboard — nothing to connect, nothing to sync.": { en: "The built-in calendar in the dashboard — nothing to connect, nothing to sync.", es: "El calendario integrado en el panel — nada que conectar, nada que sincronizar." },
  "The chat widget in the bottom-right corner of this page answers instantly, in English or Spanish, and can pass a message on to us if it can't help.": { en: "The chat widget in the bottom-right corner of this page answers instantly, in English or Spanish, and can pass a message on to us if it can't help.", es: "El chat de la esquina inferior derecha de esta página responde al instante, en inglés o español, y puede pasarnos un mensaje si no puede ayudarte." },
  "These Terms are governed by the laws of the State of Florida, without regard to conflict of law principles.": { en: "These Terms are governed by the laws of the State of Florida, without regard to conflict of law principles.", es: "Estos Términos se rigen por las leyes del Estado de Florida, sin considerar principios de conflicto de leyes." },
  "These are running now — not roadmap items. The demo line uses the same call flow you get after you sign up.": { en: "These are running now — not roadmap items. The demo line uses the same call flow you get after you sign up.", es: "Estas están funcionando ahora — no son cosas del plan de trabajo. La línea de demostración usa el mismo flujo de llamada que recibes al registrarte." },
  "These three are being built. They are not part of any plan yet, and we are not promising a date.": { en: "These three are being built. They are not part of any plan yet, and we are not promising a date.", es: "Estas tres se están construyendo. Todavía no son parte de ningún plan y no prometemos una fecha." },
  "Three steps. That's it.": { en: "Three steps. That's it.", es: "Tres pasos. Eso es todo." },
  "Time": { en: "Time", es: "Hora" },
  "Try another date": { en: "Try another date", es: "Prueba otra fecha" },
  "Try the demo": { en: "Try the demo", es: "Probar la demo" },
  "Try the demo line": { en: "Try the demo line", es: "Probar la línea de demostración" },
  "Two of these run today, two are partly live and one is still being built. Read the note on each card — that is the part that tells you what you would actually get today.": { en: "Two of these run today, two are partly live and one is still being built. Read the note on each card — that is the part that tells you what you would actually get today.", es: "Dos de estas funcionan hoy, dos están parcialmente activas y una todavía se está construyendo. Lee la nota de cada tarjeta — esa es la parte que te dice lo que realmente tendrías hoy." },
  "View Pricing": { en: "View Pricing", es: "Ver precios" },
  "Want to try it yourself?": { en: "Want to try it yourself?", es: "¿Quieres probarlo tú mismo?" },
  "Watch Again": { en: "Watch Again", es: "Ver otra vez" },
  "Watch how the AI receptionist handles a real customer call — automatically booking appointments, checking availability, and sending confirmations.": { en: "Watch how the AI receptionist handles a real customer call — automatically booking appointments, checking availability, and sending confirmations.", es: "Mira cómo la recepcionista de IA atiende una llamada real de un cliente — agenda citas automáticamente, consulta la disponibilidad y envía confirmaciones." },
  "We are NOT responsible for: misrouted calls, dropped calls, transcription errors, AI misinterpretation of caller intent, missed appointments due to system errors, calendar sync failures, or any other technical malfunction.": { en: "We are NOT responsible for: misrouted calls, dropped calls, transcription errors, AI misinterpretation of caller intent, missed appointments due to system errors, calendar sync failures, or any other technical malfunction.", es: "NO somos responsables de: llamadas mal dirigidas, llamadas cortadas, errores de transcripción, interpretación errónea de la intención de quien llama por parte de la IA, citas perdidas por errores del sistema, fallas de sincronización del calendario o cualquier otro fallo técnico." },
  "We collect information you provide when signing up: company name, email address, phone number, and payment information (processed securely by Stripe — we do not store full credit card details). We also collect call data including recordings, transcriptions, and message content to provide and improve the Service.": { en: "We collect information you provide when signing up: company name, email address, phone number, and payment information (processed securely by Stripe — we do not store full credit card details). We also collect call data including recordings, transcriptions, and message content to provide and improve the Service.", es: "Recopilamos la información que nos das al registrarte: nombre de la empresa, correo electrónico, número de teléfono e información de pago (procesada de forma segura por Stripe — no guardamos los datos completos de la tarjeta). También recopilamos datos de las llamadas, incluidas grabaciones, transcripciones y el contenido de los mensajes, para prestar y mejorar el Servicio." },
  "We don't promise a response time. Email is read by a person, and the chat widget answers immediately.": { en: "We don't promise a response time. Email is read by a person, and the chat widget answers immediately.", es: "No prometemos un tiempo de respuesta. El correo lo lee una persona y el chat contesta de inmediato." },
  "We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.": { en: "We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.", es: "Podemos actualizar estos Términos en cualquier momento. El uso continuado del Servicio después de los cambios constituye la aceptación de los nuevos Términos." },
  "We reserve the right to suspend or terminate your access to the Service at any time for violation of these Terms or for any other reason at our sole discretion. Upon termination, your phone number(s) may be released.": { en: "We reserve the right to suspend or terminate your access to the Service at any time for violation of these Terms or for any other reason at our sole discretion. Upon termination, your phone number(s) may be released.", es: "Nos reservamos el derecho de suspender o cancelar tu acceso al Servicio en cualquier momento por incumplimiento de estos Términos o por cualquier otra razón a nuestra entera discreción. Al terminar, tus números de teléfono pueden quedar liberados." },
  "We send text messages only to people who asked for them. A business owner opts in by ticking the consent box during setup, or by asking us to enable text alerts; that box is unchecked by default and choosing email instead leaves the account fully working. A customer of that business gets an appointment confirmation or reminder only at the number they gave when they booked. Every message is transactional — a call alert, an appointment confirmation or a reminder — never marketing. Message frequency varies. Message and data rates may apply. Reply STOP to any message to opt out, or HELP for help. Consent to receive texts is not a condition of purchase. We do not sell, rent, or share mobile phone numbers or SMS opt-in data with third parties or affiliates for marketing or promotional purposes.": { en: "We send text messages only to people who asked for them. A business owner opts in by ticking the consent box during setup, or by asking us to enable text alerts; that box is unchecked by default and choosing email instead leaves the account fully working. A customer of that business gets an appointment confirmation or reminder only at the number they gave when they booked. Every message is transactional — a call alert, an appointment confirmation or a reminder — never marketing. Message frequency varies. Message and data rates may apply. Reply STOP to any message to opt out, or HELP for help. Consent to receive texts is not a condition of purchase. We do not sell, rent, or share mobile phone numbers or SMS opt-in data with third parties or affiliates for marketing or promotional purposes.", es: "Enviamos mensajes de texto solo a quien los pidió. El dueño del negocio da su consentimiento marcando la casilla durante la configuración o pidiéndonos que activemos las alertas por texto; esa casilla está desmarcada por defecto y elegir correo en su lugar deja la cuenta funcionando por completo. Un cliente de ese negocio recibe una confirmación o un recordatorio de cita solo en el número que dio al reservar. Cada mensaje es transaccional — una alerta de llamada, una confirmación de cita o un recordatorio — nunca publicidad. La frecuencia de los mensajes varía. Pueden aplicarse tarifas de mensajes y datos. Responde STOP a cualquier mensaje para darte de baja, o HELP para obtener ayuda. Dar consentimiento para recibir textos no es condición de compra. No vendemos, alquilamos ni compartimos números de teléfono móvil ni datos de consentimiento de SMS con terceros o afiliados con fines de marketing o promoción." },
  "We share data with third-party service providers only as necessary to operate the Service: Stripe (payments), Telnyx (telecommunications), Neon (database hosting), and AI model providers. We do not sell your data.": { en: "We share data with third-party service providers only as necessary to operate the Service: Stripe (payments), Telnyx (telecommunications), Neon (database hosting), and AI model providers. We do not sell your data.", es: "Compartimos datos con proveedores externos solo en la medida necesaria para operar el Servicio: Stripe (pagos), Telnyx (telecomunicaciones), Neon (alojamiento de la base de datos) y proveedores de modelos de IA. No vendemos tus datos." },
  "We use industry-standard encryption and security practices. However, no method of electronic storage is 100% secure.": { en: "We use industry-standard encryption and security practices. However, no method of electronic storage is 100% secure.", es: "Usamos cifrado y prácticas de seguridad estándar en la industria. Sin embargo, ningún método de almacenamiento electrónico es 100% seguro." },
  "We use your information to: provide the Service, process payments, communicate with you about your account, improve our AI systems, and comply with legal obligations. Call data is used to train and improve our AI models.": { en: "We use your information to: provide the Service, process payments, communicate with you about your account, improve our AI systems, and comply with legal obligations. Call data is used to train and improve our AI models.", es: "Usamos tu información para: prestar el Servicio, procesar pagos, comunicarnos contigo sobre tu cuenta, mejorar nuestros sistemas de IA y cumplir obligaciones legales. Los datos de las llamadas se usan para entrenar y mejorar nuestros modelos de IA." },
  "We're closed on this day.": { en: "We're closed on this day.", es: "Ese día estamos cerrados." },
  "Week": { en: "Week", es: "Semana" },
  "What happens when you call": { en: "What happens when you call", es: "Qué pasa cuando llamas" },
  "What it does now": { en: "What it does now", es: "Lo que hace ahora" },
  "What works today,": { en: "What works today,", es: "Lo que funciona hoy," },
  "What's happening:": { en: "What's happening:", es: "Qué está pasando:" },
  "When nobody picks up, the caller does not wait and does not leave a message. They call the next business on the list. A missed call is usually a job that went to a competitor, and you never find out it happened.": { en: "When nobody picks up, the caller does not wait and does not leave a message. They call the next business on the list. A missed call is usually a job that went to a competitor, and you never find out it happened.", es: "Cuando nadie contesta, quien llama no espera ni deja mensaje. Llama al siguiente negocio de la lista. Una llamada perdida suele ser un trabajo que se fue a la competencia, y tú nunca te enteras." },
  "Where the bigger features stand": { en: "Where the bigger features stand", es: "En qué punto están las funciones más grandes" },
  "Who runs it": { en: "Who runs it", es: "Quién lo lleva" },
  "Why it exists": { en: "Why it exists", es: "Por qué existe" },
  "Why the labels matter": { en: "Why the labels matter", es: "Por qué importan las etiquetas" },
  "You acknowledge that the Service uses artificial intelligence which may produce inaccurate, incomplete, or inappropriate responses. The AI is not a substitute for human judgment, professional advice, or emergency services.": { en: "You acknowledge that the Service uses artificial intelligence which may produce inaccurate, incomplete, or inappropriate responses. The AI is not a substitute for human judgment, professional advice, or emergency services.", es: "Reconoces que el Servicio usa inteligencia artificial, la cual puede producir respuestas inexactas, incompletas o inapropiadas. La IA no sustituye el criterio humano, el asesoramiento profesional ni los servicios de emergencia." },
  "You agree to indemnify and hold harmless ReceptionAI, its owners, and affiliates from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights or applicable laws.": { en: "You agree to indemnify and hold harmless ReceptionAI, its owners, and affiliates from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights or applicable laws.", es: "Aceptas indemnizar y mantener indemnes a ReceptionAI, sus dueños y afiliados frente a cualquier reclamo, daño o gasto derivado de tu uso del Servicio, de tu incumplimiento de estos Términos o de tu violación de derechos de terceros o de las leyes aplicables." },
  "You are responsible for reviewing AI interactions and maintaining appropriate human oversight of critical business functions.": { en: "You are responsible for reviewing AI interactions and maintaining appropriate human oversight of critical business functions.", es: "Eres responsable de revisar las interacciones de la IA y de mantener una supervisión humana adecuada en las funciones críticas del negocio." },
  "You are responsible for: (a) maintaining accurate business information and settings, (b) providing a valid phone number for call transfers, (c) testing the Service regularly to ensure proper operation, (d) complying with all applicable laws regarding call recording and customer communications.": { en: "You are responsible for: (a) maintaining accurate business information and settings, (b) providing a valid phone number for call transfers, (c) testing the Service regularly to ensure proper operation, (d) complying with all applicable laws regarding call recording and customer communications.", es: "Eres responsable de: (a) mantener información y configuraciones exactas del negocio, (b) dar un número de teléfono válido para las transferencias de llamadas, (c) probar el Servicio con regularidad para asegurar su buen funcionamiento, (d) cumplir todas las leyes aplicables sobre grabación de llamadas y comunicaciones con clientes." },
  "You can reach a human by email or through the chat widget on this site — the details are on the contact page.": { en: "You can reach a human by email or through the chat widget on this site — the details are on the contact page.", es: "Puedes llegar a una persona por correo o a través del chat de este sitio — los datos están en la página de contacto." },
  "You have the right to access, correct, or delete your personal data. Contact us to exercise these rights.": { en: "You have the right to access, correct, or delete your personal data. Contact us to exercise these rights.", es: "Tienes derecho a acceder, corregir o eliminar tus datos personales. Contáctanos para ejercer estos derechos." },
  "You'll receive an email confirmation shortly. We look forward to showing you ReceptionAI.": { en: "You'll receive an email confirmation shortly. We look forward to showing you ReceptionAI.", es: "Recibirás un correo de confirmación en breve. Nos alegra poder mostrarte ReceptionAI." },
  "Your AI receptionist answers calls 24/7, books service appointments, and transfers urgent callers straight to your phone. Built-in calendar. No integrations needed.": { en: "Your AI receptionist answers calls 24/7, books service appointments, and transfers urgent callers straight to your phone. Built-in calendar. No integrations needed.", es: "Tu recepcionista de IA contesta llamadas 24/7, agenda citas de servicio y transfiere a tu teléfono a quienes llaman por urgencias. Calendario integrado. Sin integraciones." },
  "Your customers can interact in the language they prefer. The AI seamlessly switches between both.": { en: "Your customers can interact in the language they prefer. The AI seamlessly switches between both.", es: "Tus clientes pueden hablar en el idioma que prefieran. La IA cambia entre los dos sin problema." },
  "and what is still being built": { en: "and what is still being built", es: "y lo que todavía se está construyendo" },
  "basis. We do not guarantee uninterrupted access, error-free operation, or that the Service will meet all your requirements. The Service may be unavailable due to maintenance, third-party service outages (including but not limited to telecommunications carriers, cloud providers, and AI model providers), or circumstances beyond our control.": { en: "basis. We do not guarantee uninterrupted access, error-free operation, or that the Service will meet all your requirements. The Service may be unavailable due to maintenance, third-party service outages (including but not limited to telecommunications carriers, cloud providers, and AI model providers), or circumstances beyond our control.", es: "tal cual y según disponibilidad. No garantizamos acceso ininterrumpido, funcionamiento sin errores ni que el Servicio cumpla todos tus requisitos. El Servicio puede no estar disponible por mantenimiento, caídas de servicios de terceros (incluidos, entre otros, operadoras de telecomunicaciones, proveedores de nube y proveedores de modelos de IA) o circunstancias fuera de nuestro control." },
  "hello@receptionai.store": { en: "hello@receptionai.store", es: "hello@receptionai.store" },
  "is a live demo of the AI — call it and you'll talk to the receptionist exactly as your callers would. It is not a support line, and nobody will pick up on the other end: it is the AI.": { en: "is a live demo of the AI — call it and you'll talk to the receptionist exactly as your callers would. It is not a support line, and nobody will pick up on the other end: it is the AI.", es: "es una demostración en vivo de la IA — llámala y hablarás con la recepcionista exactamente como lo harían tus clientes. No es una línea de soporte y nadie va a contestar del otro lado: es la IA." },
  "misses the call": { en: "misses the call", es: "pierde la llamada" },
  "— even at 2 AM": { en: "— even at 2 AM", es: "— incluso a las 2 de la mañana" },
  "— or book a product demo below —": { en: "— or book a product demo below —", es: "— o agenda una demo del producto abajo —" },
  "← Back": { en: "← Back", es: "← Volver" },
  "24/7 Call Answering": { en: "24/7 Call Answering", es: "Contestación de llamadas 24/7" },
  "24/7 inbound call handling with natural conversation": { en: "24/7 inbound call handling with natural conversation", es: "Atención de llamadas entrantes 24/7 con conversación natural" },
  "A booking made on your website emails the person who booked a confirmation, then reminders 24 hours and 2 hours before the appointment.": { en: "A booking made on your website emails the person who booked a confirmation, then reminders 24 hours and 2 hours before the appointment.", es: "Una reserva hecha en tu sitio web le envía a la persona un correo de confirmación y luego recordatorios 24 horas y 2 horas antes de la cita." },
  "A caller who wants a person can reach one. What is not built yet is the AI deciding on its own — from tone or sentiment — that a call needs a human.": { en: "A caller who wants a person can reach one. What is not built yet is the AI deciding on its own — from tone or sentiment — that a call needs a human.", es: "Quien llama y quiere hablar con una persona puede llegar a una. Lo que todavía no está construido es que la IA decida por sí sola — por el tono o el sentimiento — que una llamada necesita a un humano." },
  "A real conversation, in English or Spanish": { en: "A real conversation, in English or Spanish", es: "Una conversación real, en inglés o español" },
  "AI Call Answering": { en: "AI Call Answering", es: "Contestación de llamadas con IA" },
  "AI books the job": { en: "AI books the job", es: "La IA agenda el trabajo" },
  "Advanced Analytics": { en: "Advanced Analytics", es: "Analíticas avanzadas" },
  "After a call, the owner gets an email with the caller's number, what they needed, and what happened on the call.": { en: "After a call, the owner gets an email with the caller's number, what they needed, and what happened on the call.", es: "Después de cada llamada, el dueño recibe un correo con el número de quien llamó, lo que necesitaba y lo que pasó en la llamada." },
  "An email 24 hours before the appointment and again 2 hours before, in the caller's language.": { en: "An email 24 hours before the appointment and again 2 hours before, in the caller's language.", es: "Un correo 24 horas antes de la cita y otro 2 horas antes, en el idioma de quien reservó." },
  "An email summary after every call": { en: "An email summary after every call", es: "Un resumen por correo después de cada llamada" },
  "Analytics": { en: "Analytics", es: "Analíticas" },
  "Appointment goes on your calendar. You get an email summary with caller info, what they need, and when they're booked.": { en: "Appointment goes on your calendar. You get an email summary with caller info, what they need, and when they're booked.", es: "La cita queda en tu calendario. Recibes un resumen por correo con los datos de quien llamó, lo que necesita y cuándo quedó agendado." },
  "Ask for a person and the call is bridged to you. If you can't pick up, the caller can leave a voicemail and you get it by email, so the conversation doesn't just end.": { en: "Ask for a person and the call is bridged to you. If you can't pick up, the caller can leave a voicemail and you get it by email, so the conversation doesn't just end.", es: "Pide hablar con una persona y la llamada se conecta contigo. Si no puedes contestar, quien llama puede dejar un mensaje de voz y tú lo recibes por correo, así la conversación no se corta sin más." },
  "Auto Scheduling": { en: "Auto Scheduling", es: "Agendado automático" },
  "Bilingual": { en: "Bilingual", es: "Bilingüe" },
  "Bilingual, just like your customers": { en: "Bilingual, just like your customers", es: "Bilingüe, igual que tus clientes" },
  "Books appointments automatically on your built-in calendar": { en: "Books appointments automatically on your built-in calendar", es: "Agenda citas automáticamente en tu calendario integrado" },
  "Books on the call, from your real calendar": { en: "Books on the call, from your real calendar", es: "Reserva durante la llamada, desde tu calendario real" },
  "Call Outcomes & Missed Calls": { en: "Call Outcomes & Missed Calls", es: "Resultados de llamadas y llamadas perdidas" },
  "Caller, duration, outcome and what they wanted — sent to your phone, no dashboard login needed.": { en: "Caller, duration, outcome and what they wanted — sent to your phone, no dashboard login needed.", es: "Quién llamó, duración, resultado y qué quería — enviado a tu teléfono, sin tener que entrar al panel." },
  "Callers choose their language at the start of the call and the AI continues in it. Web chat and emails go out in English and Spanish too.": { en: "Callers choose their language at the start of the call and the AI continues in it. Web chat and emails go out in English and Spanish too.", es: "Quien llama elige su idioma al inicio de la llamada y la IA sigue en ese idioma. El chat web y los correos también salen en inglés y español." },
  "Checks your calendar and books automatically": { en: "Checks your calendar and books automatically", es: "Consulta tu calendario y reserva automáticamente" },
  "Coming Soon": { en: "Coming Soon", es: "Próximamente" },
  "Confirmations & Reminders": { en: "Confirmations & Reminders", es: "Confirmaciones y recordatorios" },
  "Custom Call Scripts": { en: "Custom Call Scripts", es: "Guiones de llamada personalizados" },
  "Custom script authoring is still being built. Scale includes the customization work already on the roadmap — it is not something you can configure today.": { en: "Custom script authoring is still being built. Scale includes the customization work already on the roadmap — it is not something you can configure today.", es: "La creación de guiones personalizados todavía se está construyendo. Scale incluye el trabajo de personalización que ya está en el plan de trabajo — no es algo que puedas configurar hoy." },
  "Customer calls — AI answers": { en: "Customer calls — AI answers", es: "El cliente llama — la IA contesta" },
  "Deeper reporting on call volume, booking rates, peak hours and outcomes, instead of a summary of what happened.": { en: "Deeper reporting on call volume, booking rates, peak hours and outcomes, instead of a summary of what happened.", es: "Informes más detallados sobre volumen de llamadas, tasas de reserva, horas pico y resultados, en lugar de solo un resumen de lo que pasó." },
  "Designed and on the roadmap, not available yet. Nothing to configure today.": { en: "Designed and on the roadmap, not available yet. Nothing to configure today.", es: "Diseñada y en el plan de trabajo, todavía no disponible. Nada que configurar hoy." },
  "Done! Your appointment is confirmed for tomorrow at 10 AM. The team will see you then. Is there anything else?": { en: "Done! Your appointment is confirmed for tomorrow at 10 AM. The team will see you then. Is there anything else?", es: "¡Listo! Tu cita queda confirmada para mañana a las 10 de la mañana. El equipo te atenderá entonces. ¿Algo más?" },
  "Emails confirmations & reminders for web bookings": { en: "Emails confirmations & reminders for web bookings", es: "Envía por correo confirmaciones y recordatorios de las reservas hechas en la web" },
  "English & Spanish": { en: "English & Spanish", es: "Inglés y español" },
  "English & Spanish — seamless switching": { en: "English & Spanish — seamless switching", es: "Inglés y español — cambio fluido" },
  "English and Spanish, with nothing to configure. Callers press 1 for English or 2 for Spanish before they hear the menu.": { en: "English and Spanish, with nothing to configure. Callers press 1 for English or 2 for Spanish before they hear the menu.", es: "Inglés y español, sin configurar nada. Quien llama marca 1 para inglés o 2 para español antes de escuchar el menú." },
  "Every call is stored with a real outcome — booked, message taken, transferred, or missed — and a missed call gets its own row on the dashboard.": { en: "Every call is stored with a real outcome — booked, message taken, transferred, or missed — and a missed call gets its own row on the dashboard.", es: "Cada llamada se guarda con un resultado real — reservada, mensaje tomado, transferida o perdida — y cada llamada perdida tiene su propia fila en el panel." },
  "Every missed HVAC call is a service visit you did not get paid for — and in the middle of a cold snap that hurts most. Your AI answers every call, 24/7, holidays included.": { en: "Every missed HVAC call is a service visit you did not get paid for — and in the middle of a cold snap that hurts most. Your AI answers every call, 24/7, holidays included.", es: "Cada llamada de HVAC perdida es una visita de servicio que no te pagaron — y en plena ola de frío duele más. Tu IA contesta cada llamada, 24/7, festivos incluidos." },
  "Great, I have an opening at 10 AM tomorrow morning. Does that work?": { en: "Great, I have an opening at 10 AM tomorrow morning. Does that work?", es: "Perfecto, tengo un espacio mañana a las 10 de la mañana. ¿Te viene bien?" },
  "Hi, I need my AC fixed. Can you help?": { en: "Hi, I need my AC fixed. Can you help?", es: "Hola, necesito que me arreglen el aire acondicionado. ¿Pueden ayudarme?" },
  "Human Handoff": { en: "Human Handoff", es: "Traspaso a una persona" },
  "I'm David from 123 Oak Street.": { en: "I'm David from 123 Oak Street.", es: "Soy David, de la calle Oak 123." },
  "Instant Confirmations": { en: "Instant Confirmations", es: "Confirmaciones al instante" },
  "It reads live availability — your hours, your holidays, appointments already booked and a 15-minute buffer — and books the slot straight into your calendar.": { en: "It reads live availability — your hours, your holidays, appointments already booked and a 15-minute buffer — and books the slot straight into your calendar.", es: "Lee la disponibilidad en vivo — tu horario, tus festivos, las citas ya reservadas y un margen de 15 minutos — y reserva el horario directamente en tu calendario." },
  "Listen back to a voicemail from the dashboard. The audio is saved as soon as the caller leaves it, and the missed-call alert goes out at the same time.": { en: "Listen back to a voicemail from the dashboard. The audio is saved as soon as the caller leaves it, and the missed-call alert goes out at the same time.", es: "Escucha un mensaje de voz desde el panel. El audio se guarda en cuanto la persona lo deja y la alerta de llamada perdida sale al mismo tiempo." },
  "Live: call transfer to the owner + web-chat human requests. Sentiment-based smart handoff: coming.": { en: "Live: call transfer to the owner + web-chat human requests. Sentiment-based smart handoff: coming.", es: "Activo: transferencia de llamada al dueño + solicitudes de humano en el chat web. Traspaso inteligente según el sentimiento: próximamente." },
  "Live: calls, web chat and email notifications. Text alerts are an optional add-on, not part of any plan. Unified multi-channel inbox: coming.": { en: "Live: calls, web chat and email notifications. Text alerts are an optional add-on, not part of any plan. Unified multi-channel inbox: coming.", es: "Activo: llamadas, chat web y notificaciones por correo. Las alertas por texto son un complemento opcional, no forman parte de ningún plan. Bandeja unificada multicanal: próximamente." },
  "Live: the analytics dashboard in your account — call volume, missed calls and real outcomes.": { en: "Live: the analytics dashboard in your account — call volume, missed calls and real outcomes.", es: "Activo: el panel de analíticas de tu cuenta — volumen de llamadas, llamadas perdidas y resultados reales." },
  "Live: voicemail messages (option 9 on your line) are recorded and play back in your dashboard, and missed-call alerts go out. Recording whole calls, not just voicemail: coming.": { en: "Live: voicemail messages (option 9 on your line) are recorded and play back in your dashboard, and missed-call alerts go out. Recording whole calls, not just voicemail: coming.", es: "Activo: los mensajes de voz (opción 9 en tu línea) se graban y se reproducen en tu panel, y salen las alertas de llamada perdida. Grabar llamadas completas, no solo el mensaje de voz: próximamente." },
  "Messenger conversations answered by the same AI, in the same dashboard.": { en: "Messenger conversations answered by the same AI, in the same dashboard.", es: "Conversaciones de Messenger contestadas por la misma IA, en el mismo panel." },
  "Missed calls = lost revenue": { en: "Missed calls = lost revenue", es: "Llamadas perdidas = ingresos perdidos" },
  "Multi-Channel": { en: "Multi-Channel", es: "Multicanal" },
  "Never miss a lead — AI answers instantly, day or night": { en: "Never miss a lead — AI answers instantly, day or night", es: "Nunca pierdas un cliente potencial — la IA contesta al instante, de día o de noche" },
  "No, that's all. Thanks!": { en: "No, that's all. Thanks!", es: "No, eso es todo. ¡Gracias!" },
  "Of course! I can help you book a service visit. What's your name?": { en: "Of course! I can help you book a service visit. What's your name?", es: "¡Claro! Puedo ayudarte a reservar una visita de servicio. ¿Cómo te llamas?" },
  "Omnichannel Inbox": { en: "Omnichannel Inbox", es: "Bandeja omnicanal" },
  "One inbox where every conversation — call, chat, email — lands in the same thread with the same customer.": { en: "One inbox where every conversation — call, chat, email — lands in the same thread with the same customer.", es: "Una sola bandeja donde cada conversación — llamada, chat, correo — cae en el mismo hilo con el mismo cliente." },
  "Part of Growth": { en: "Part of Growth", es: "Incluido en Growth" },
  "Part of Scale": { en: "Part of Scale", es: "Incluido en Scale" },
  "Part of it works now — the note on the card says exactly which part.": { en: "Part of it works now — the note on the card says exactly which part.", es: "Una parte ya funciona — la nota de la tarjeta dice exactamente cuál." },
  "Perfect, book it!": { en: "Perfect, book it!", es: "¡Perfecto, resérvala!" },
  "Post-Call Summary to Your Inbox": { en: "Post-Call Summary to Your Inbox", es: "Resumen de la llamada en tu correo" },
  "Press 1 for English or 2 for Spanish, then the menu: 1 appointments, 2 services, 3 a team member, 4 to reschedule, 5 availability, 9 voicemail. Every option works.": { en: "Press 1 for English or 2 for Spanish, then the menu: 1 appointments, 2 services, 3 a team member, 4 to reschedule, 5 availability, 9 voicemail. Every option works.", es: "Marca 1 para inglés o 2 para español, y luego el menú: 1 citas, 2 servicios, 3 hablar con una persona del equipo, 4 reprogramar, 5 disponibilidad, 9 mensaje de voz. Todas las opciones funcionan." },
  "Press 3 and the call bridges to your phone — live today. Automatic escalation is coming soon.": { en: "Press 3 and the call bridges to your phone — live today. Automatic escalation is coming soon.", es: "Marca 3 y la llamada se conecta con tu teléfono — activo hoy. La escalación automática llega pronto." },
  "Press 3 and the call rings your phone": { en: "Press 3 and the call rings your phone", es: "Marca 3 y la llamada suena en tu teléfono" },
  "Press 9 to leave a message: the recording is saved, playable in your dashboard, and you're alerted once.": { en: "Press 9 to leave a message: the recording is saved, playable in your dashboard, and you're alerted once.", es: "Marca 9 para dejar un mensaje: la grabación se guarda, se puede reproducir en tu panel y recibes un aviso una sola vez." },
  "Real Bookings, Live Availability": { en: "Real Bookings, Live Availability", es: "Reservas reales, disponibilidad en vivo" },
  "Reminders that go out on their own": { en: "Reminders that go out on their own", es: "Recordatorios que salen solos" },
  "Running in your account today, on every plan that includes it.": { en: "Running in your account today, on every plan that includes it.", es: "Funcionando en tu cuenta hoy, en todos los planes que la incluyen." },
  "Smart Human Handoff": { en: "Smart Human Handoff", es: "Traspaso inteligente a una persona" },
  "Smart Scheduling": { en: "Smart Scheduling", es: "Agenda inteligente" },
  "Stop playing phone tag": { en: "Stop playing phone tag", es: "Deja de jugar al teléfono ocupado" },
  "Thanks David! Let me check available slots for tomorrow...": { en: "Thanks David! Let me check available slots for tomorrow...", es: "¡Gracias, David! Déjame revisar los horarios disponibles para mañana..." },
  "That's it. No phone tag. No missed leads. No 2 AM voicemails you check in the morning.": { en: "That's it. No phone tag. No missed leads. No 2 AM voicemails you check in the morning.", es: "Eso es todo. Sin llamadas cruzadas. Sin clientes potenciales perdidos. Sin mensajes de voz de las 2 de la mañana que escuchas por la mañana." },
  "The AI answers WhatsApp messages the same way it answers calls and web chats.": { en: "The AI answers WhatsApp messages the same way it answers calls and web chats.", es: "La IA contesta los mensajes de WhatsApp igual que contesta llamadas y chats web." },
  "The AI checks your business hours, holidays, existing appointments and a 15-minute buffer, offers actual open times, and books the appointment during the call.": { en: "The AI checks your business hours, holidays, existing appointments and a 15-minute buffer, offers actual open times, and books the appointment during the call.", es: "La IA revisa tu horario, tus festivos, las citas ya existentes y un margen de 15 minutos, ofrece horarios realmente libres y agenda la cita durante la llamada." },
  "Track calls, bookings, and missed opportunities": { en: "Track calls, bookings, and missed opportunities", es: "Sigue las llamadas, las reservas y las oportunidades perdidas" },
  "Two-way sync with the calendar you already use. Today ReceptionAI books into its own built-in calendar.": { en: "Two-way sync with the calendar you already use. Today ReceptionAI books into its own built-in calendar.", es: "Sincronización de dos vías con el calendario que ya usas. Hoy ReceptionAI reserva en su propio calendario integrado." },
  "Voice, web chat and email notifications. Text alerts are an optional add-on. WhatsApp and Facebook are in development.": { en: "Voice, web chat and email notifications. Text alerts are an optional add-on. WhatsApp and Facebook are in development.", es: "Voz, chat web y notificaciones por correo. Las alertas por texto son un complemento opcional. WhatsApp y Facebook están en desarrollo." },
  "Voicemail Recordings": { en: "Voicemail Recordings", es: "Grabaciones de mensajes de voz" },
  "Voicemail you can actually play": { en: "Voicemail you can actually play", es: "Mensajes de voz que de verdad puedes escuchar" },
  "Writing your own call scripts, question by question, and having the AI follow them for your business.": { en: "Writing your own call scripts, question by question, and having the AI follow them for your business.", es: "Escribir tus propios guiones de llamada, pregunta por pregunta, y que la IA los siga para tu negocio." },
  "You show up and do the work": { en: "You show up and do the work", es: "Tú llegas y haces el trabajo" },
  "You're welcome, David! Have a great day.": { en: "You're welcome, David! Have a great day.", es: "¡De nada, David! Que tengas un buen día." },
  "Your AI books appointments directly on your calendar. No back-and-forth. No voicemail tag. Customer picks a time, it's on your schedule.": { en: "Your AI books appointments directly on your calendar. No back-and-forth. No voicemail tag. Customer picks a time, it's on your schedule.", es: "Tu IA agenda las citas directamente en tu calendario. Sin ir y venir. Sin mensajes de voz cruzados. El cliente elige un horario y queda en tu agenda." },
  "Your AI receptionist answers inbound calls day or night — weekends and holidays included — and handles more than one call at a time.": { en: "Your AI receptionist answers inbound calls day or night — weekends and holidays included — and handles more than one call at a time.", es: "Tu recepcionista de IA contesta las llamadas entrantes de día o de noche — fines de semana y festivos incluidos — y atiende más de una llamada a la vez." },
  "Answers calls 24/7, including nights, weekends and holidays — in English and Spanish.": { en: "Answers calls 24/7, including nights, weekends and holidays — in English and Spanish.", es: "Contesta llamadas 24/7, incluidas noches, fines de semana y festivos — en inglés y español." },
  "Books appointments during the call, against your real availability: your hours, your holidays, appointments already booked, and a 15-minute buffer.": { en: "Books appointments during the call, against your real availability: your hours, your holidays, appointments already booked, and a 15-minute buffer.", es: "Agenda citas durante la llamada, con tu disponibilidad real: tu horario, tus festivos, las citas ya reservadas y un margen de 15 minutos." },
  "Emails a booking made on your website a confirmation, then reminders 24 hours and 2 hours before the appointment.": { en: "Emails a booking made on your website a confirmation, then reminders 24 hours and 2 hours before the appointment.", es: "Envía por correo la confirmación de una reserva hecha en tu sitio web y luego recordatorios 24 horas y 2 horas antes de la cita." },
  "Emails you a summary after every call: who called, how long it ran, and what happened.": { en: "Emails you a summary after every call: who called, how long it ran, and what happened.", es: "Te envía un resumen por correo después de cada llamada: quién llamó, cuánto duró y qué pasó." },
  "Transfers to you or your team when the caller asks for a person.": { en: "Transfers to you or your team when the caller asks for a person.", es: "Transfiere a ti o a tu equipo cuando quien llama pide hablar con una persona." },
  "Answers website chat in English and Spanish, with the same information as the phone line.": { en: "Answers website chat in English and Spanish, with the same information as the phone line.", es: "Contesta el chat del sitio web en inglés y español, con la misma información que la línea telefónica." },
  "Includes a built-in calendar, so there is nothing to connect before your first booking.": { en: "Includes a built-in calendar, so there is nothing to connect before your first booking.", es: "Incluye un calendario integrado, así que no hay nada que conectar antes de tu primera reserva." },
  "Records voicemail and lets you play it back from the dashboard.": { en: "Records voicemail and lets you play it back from the dashboard.", es: "Graba los mensajes de voz y te deja escucharlos desde el panel." },
  "WhatsApp messaging": { en: "WhatsApp messaging", es: "Mensajería de WhatsApp" },
  "Facebook Messenger": { en: "Facebook Messenger", es: "Facebook Messenger" },
  "Google / Outlook calendar sync": { en: "Google / Outlook calendar sync", es: "Sincronización con el calendario de Google / Outlook" },
  "Your business name — this is what the AI says when it answers (\"Thanks for calling …\").": { en: "Your business name — this is what the AI says when it answers (\"Thanks for calling …\").", es: "El nombre de tu negocio — es lo que la IA dice al contestar («Gracias por llamar a …»)." },
  "The phone number you want answered, and whether it is a new number or one you already have.": { en: "The phone number you want answered, and whether it is a new number or one you already have.", es: "El número de teléfono que quieres que se conteste, y si es un número nuevo o uno que ya tienes." },
  "What you want the AI to do on a call: book appointments, answer common questions, take messages, or transfer to you.": { en: "What you want the AI to do on a call: book appointments, answer common questions, take messages, or transfer to you.", es: "Lo que quieres que la IA haga en una llamada: agendar citas, responder preguntas frecuentes, tomar mensajes o transferirte la llamada." },
  "Checking availability...": { en: "Checking availability...", es: "Consultando disponibilidad..." },
  "Find Available Times": { en: "Find Available Times", es: "Buscar horarios disponibles" },
  "Booking...": { en: "Booking...", es: "Reservando..." },
  "Schedule My Demo": { en: "Schedule My Demo", es: "Agendar mi demo" },
  "Please fill in name, phone, and date.": { en: "Please fill in name, phone, and date.", es: "Completa nombre, teléfono y fecha, por favor." },
  "Could not load available times. Please try again.": { en: "Could not load available times. Please try again.", es: "No pudimos cargar los horarios disponibles. Inténtalo de nuevo." },
  "Could not complete booking. Please try again.": { en: "Could not complete booking. Please try again.", es: "No pudimos completar la reserva. Inténtalo de nuevo." },
  "Book a time with Carm Marketing": { en: "Book a time with Carm Marketing", es: "Reserva un horario con Carm Marketing" },
  "Product Demo": { en: "Product Demo", es: "Demo del producto" },
  "Pricing & Plans": { en: "Pricing & Plans", es: "Precios y planes" },
  "General Service": { en: "General Service", es: "Servicio general" },
  "Sun": { en: "Sun", es: "Dom" },
  "Mon": { en: "Mon", es: "Lun" },
  "Tue": { en: "Tue", es: "Mar" },
  "Wed": { en: "Wed", es: "Mié" },
  "Thu": { en: "Thu", es: "Jue" },
  "Fri": { en: "Fri", es: "Vie" },
  "Sat": { en: "Sat", es: "Sáb" },
  "ReceptionAI Promo Video": { en: "ReceptionAI Promo Video", es: "Video promocional de ReceptionAI" },
  "The English version of this page governs.": { en: "The English version of this page governs.", es: "La versión en inglés es la que rige." },

  /* ─── Dashboard (kept for later phases) ─── */
  "dashboard.overview": { en: "Overview", es: "Resumen" },
  "dashboard.conversations": { en: "Conversations", es: "Conversaciones" },
  "dashboard.appointments": { en: "Appointments", es: "Citas" },
  "dashboard.settings": { en: "Settings", es: "Configuración" },
  "dashboard.analytics": { en: "Analytics", es: "Analíticas" },
  "dashboard.team": { en: "Team", es: "Equipo" },
  "dashboard.recordings": { en: "Recordings", es: "Grabaciones" },
  "dashboard.customers": { en: "Customers", es: "Clientes" },
  "dashboard.missed": { en: "Missed Calls", es: "Llamadas Perdidas" },
  "dashboard.campaigns": { en: "Campaigns", es: "Campañas" },
  "dashboard.billing": { en: "Billing", es: "Facturación" },
  "dashboard.callsToday": { en: "Calls Today", es: "Llamadas Hoy" },
  "dashboard.bookingsToday": { en: "Bookings Today", es: "Reservas Hoy" },
  "dashboard.answered": { en: "Answered", es: "Respondidas" },
  "dashboard.missedLabel": { en: "Missed", es: "Perdidas" },
  "dashboard.avgDuration": { en: "Avg Duration", es: "Duración Promedio" },
  "dashboard.satisfaction": { en: "Satisfaction", es: "Satisfacción" },
  "dashboard.recentActivity": { en: "Recent Activity", es: "Actividad Reciente" },
  "dashboard.viewAll": { en: "View All", es: "Ver Todo" },
  "dashboard.logout": { en: "Log Out", es: "Cerrar Sesión" },

  /* ─── Login / Auth (kept for later phases, trial language removed) ─── */
  "login.welcome": { en: "Welcome back", es: "Bienvenido de nuevo" },
  "login.subtitle": { en: "Sign in to your ReceptionAI dashboard.", es: "Inicia sesión en tu panel de ReceptionAI." },
  "login.createAccount": { en: "Create your account", es: "Crea tu cuenta" },
  "login.createSubtitle": { en: "Create your account to get started.", es: "Crea tu cuenta para comenzar." },
  "login.email": { en: "Business Email", es: "Correo Electrónico" },
  "login.password": { en: "Password", es: "Contraseña" },
  "login.signIn": { en: "Sign In", es: "Iniciar Sesión" },
  "login.createAccountBtn": { en: "Create Account", es: "Crear Cuenta" },
  "login.rememberMe": { en: "Remember me", es: "Recordarme" },
  "login.forgotPassword": { en: "Forgot password?", es: "¿Olvidaste tu contraseña?" },
  "login.noAccount": { en: "Don't have an account?", es: "¿No tienes una cuenta?" },
  "login.hasAccount": { en: "Already have an account?", es: "¿Ya tienes una cuenta?" },
  "login.startTrial": { en: "Get Started", es: "Comenzar" },
  "login.pleaseWait": { en: "Please wait...", es: "Espere por favor..." },
  "login.fillFields": { en: "Please fill in all fields.", es: "Por favor completa todos los campos." },
  /* ─── After payment — /signup/success (the thank-you page) ─── */
  /* A paying customer must never land back on the signup form. Every string here is about a
     payment that already happened: the number we bought, the email we sent, the way in. */
  "success.waiting.title": { en: "Payment received", es: "Pago recibido" },
  "success.waiting.settingUp": { en: "Setting up", es: "Configurando" },
  "success.waiting.note": {
    en: "We're buying your phone number and switching on your receptionist. This usually takes a few seconds.",
    es: "Estamos comprando tu número de teléfono y activando tu recepcionista. Normalmente tarda unos segundos.",
  },
  "success.ready.title": { en: "Thank you", es: "¡Gracias" },
  "success.ready.business": { en: "Your receptionist is answering as", es: "Tu recepcionista contesta como" },
  "success.ready.numberLabel": { en: "Your new number", es: "Tu número nuevo" },
  "success.ready.callIt": {
    en: "Call it and hear your receptionist answer.",
    es: "Llámale y escucha a tu recepcionista contestar.",
  },
  "success.ready.pendingNumber": {
    en: "Your number is being connected — we'll email it to you the moment it is live.",
    es: "Tu número se está conectando — te lo enviaremos por correo en cuanto esté activo.",
  },
  "success.ready.emailed": { en: "We also emailed this to", es: "También te enviamos esto a" },
  "success.ready.openDashboard": { en: "Open my dashboard", es: "Abrir mi panel" },
  "success.ready.finishSetup": { en: "Finish setup", es: "Terminar la configuración" },
  "success.ready.signedIn": {
    en: "You're signed in — pick up wherever you left off.",
    es: "Ya iniciaste sesión — continúa donde lo dejaste.",
  },
  "success.ready.loginRequired": { en: "To get in, sign in with", es: "Para entrar, inicia sesión con" },
  "success.ready.loginRequiredTail": {
    en: "and the password you chose at checkout.",
    es: "y la contraseña que elegiste al pagar.",
  },
  "success.ready.loginLink": { en: "Go to the login page", es: "Ir a la página de inicio de sesión" },
  "success.confirming.title": {
    en: "Your payment is still being confirmed",
    es: "Tu pago aún se está confirmando",
  },
  "success.confirming.body": {
    en: "Nothing is wrong. Stripe is confirming the payment and we're setting up your account — check the email you used at checkout, where your number and sign-in details will arrive.",
    es: "No pasa nada. Stripe está confirmando el pago y estamos creando tu cuenta — revisa el correo que usaste al pagar, ahí llegarán tu número y tus datos de acceso.",
  },
  "success.confirming.login": {
    en: "Already have your password? Log in",
    es: "¿Ya tienes tu contraseña? Inicia sesión",
  },
};

/* ─── Runtime locale (module-level, updated by <LocaleProvider>) ─── */

let currentLocale: Locale = "en";

export function getLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("locale");
    if (stored === "es" || stored === "en") return stored;
  }
  if (typeof document !== "undefined") {
    const html = document.documentElement.lang;
    if (html === "es" || html === "en") return html;
  }
  if (typeof navigator !== "undefined") {
    const nav = navigator.language?.slice(0, 2);
    if (nav === "es") return "es";
  }
  return "en";
}

export function t(key: string, locale?: Locale): string {
  const loc = locale ?? currentLocale;
  return translations[key]?.[loc] ?? key;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
});

/**
 * `fixed` pins the provider to one locale and makes it read-only. Use it on
 * pages whose body exists in English only (legal pages): the chrome then
 * matches the body, and no toggle is offered that could not translate.
 */
export function LocaleProvider({ children, fixed }: { children: ReactNode; fixed?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(fixed ?? "en");

  useEffect(() => {
    if (fixed) {
      currentLocale = fixed;
      setLocaleState(fixed);
      if (typeof document !== "undefined") {
        document.documentElement.lang = fixed;
      }
      return;
    }
    const detected = getLocale();
    currentLocale = detected;
    setLocaleState(detected);
    if (typeof document !== "undefined") {
      document.documentElement.lang = detected;
    }
  }, [fixed]);

  const setLocale = useCallback((l: Locale) => {
    // A fixed provider never switches — there is nothing translated to switch to.
    if (fixed) return;
    currentLocale = l;
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", l);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
    }
  }, [fixed]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
