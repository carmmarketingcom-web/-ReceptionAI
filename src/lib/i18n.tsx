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

  /* ─── Home — Hero ─── */
  /* Mirrors _marketing.index.tsx HeroSection verbatim. Nothing here promises a
     feature the live page does not show. */
  "home.badge": { en: "AI Receptionist — Now Available", es: "Recepcionista IA — Ya Disponible" },
  "home.hero.line1": { en: "Never miss", es: "Nunca pierdas" },
  "home.hero.highlight": { en: "another customer call.", es: "otra llamada de cliente." },
  "home.hero.subtitle": {
    en: "Every call answered. Every appointment booked. Every caller texted back — in English and Spanish, at 2am on a Sunday. $99 a month.",
    es: "Cada llamada contestada. Cada cita agendada. Cada llamante recibe un mensaje de texto de vuelta — en inglés y español, a las 2 de la mañana un domingo. $99 al mes.",
  },
  "home.hero.cta": { en: "Hear the live demo", es: "Escucha la demo en vivo" },
  "home.hero.secondary": { en: "See pricing", es: "Ver precios" },

  /* ─── Industries ─── */
  "ind.hvac": { en: "HVAC", es: "HVAC" },
  "ind.plumbing": { en: "Plumbing", es: "Plomería" },
  "ind.electrical": { en: "Electrical", es: "Electricidad" },
  "ind.dental": { en: "Dental", es: "Dental" },
  "ind.veterinary": { en: "Veterinary", es: "Veterinaria" },
  "ind.law": { en: "Law", es: "Legal" },
  "ind.medspa": { en: "Med Spa", es: "Med Spa" },
  "ind.homeservices": { en: "Home Services", es: "Servicios para el Hogar" },

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
  "home.how.step3.title": { en: "You get an SMS summary after every call", es: "Recibes un resumen por SMS después de cada llamada" },
  "home.how.step3.desc": {
    en: "Caller info, duration, and outcome — straight to your phone. No dashboard required.",
    es: "Datos del llamante, duración y resultado — directo a tu teléfono. No necesitas abrir el panel.",
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
    en: "AI reads your calendar and books appointments automatically. Sends confirmations, reminders, and follow-ups.",
    es: "La IA lee tu calendario y agenda citas automáticamente. Envía confirmaciones, recordatorios y seguimientos.",
  },
  "feature.multichannel.title": { en: "Calls, Texts & Web Chat", es: "Llamadas, Textos y Chat Web" },
  "feature.multichannel.desc": {
    en: "Calls, texts and web chat handled in one place. The unified inbox for WhatsApp and Facebook messages is in development.",
    es: "Llamadas, mensajes de texto y chat web atendidos en un solo lugar. La bandeja de entrada unificada para mensajes de WhatsApp y Facebook está en desarrollo.",
  },
  "feature.human.title": { en: "Human Handoff When Needed", es: "Transferencia a Humanos Cuando Sea Necesario" },
  "feature.human.desc": {
    en: "Callers press 3 to reach you on a live call, and web-chat requests for a person text your phone. Sentiment-based escalation is coming.",
    es: "Los llamantes presionan 3 para comunicarse contigo en una llamada en vivo, y las solicitudes de una persona en el chat web llegan a tu teléfono por mensaje de texto. La escalación automática según el sentimiento aún está en desarrollo.",
  },
  "feature.analytics.title": { en: "Call Outcomes & Missed Calls", es: "Resultados de Llamadas y Llamadas Perdidas" },
  "feature.analytics.desc": {
    en: "See call activity, missed calls and real outcomes in your dashboard. The advanced analytics dashboard is in progress.",
    es: "Mira la actividad de llamadas, las llamadas perdidas y los resultados reales en tu panel. El panel de analíticas avanzadas está en desarrollo.",
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
    en: "Get SMS summaries after every call. See everything in your dashboard. Only step in when you want to.",
    es: "Recibe resúmenes por SMS después de cada llamada. Ve todo en tu panel. Interviene solo cuando quieras.",
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
    en: "Press 3 at any time and the call is bridged straight to you or your team. If nobody picks up, the caller gets a text back — so an urgent call never just ends.",
    es: "Presiona 3 en cualquier momento y la llamada se conecta directamente contigo o con tu equipo. Si nadie contesta, el llamante recibe un mensaje de texto de vuelta — así una llamada urgente nunca se queda sin respuesta.",
  },
  "home.faq.q3": { en: "What if it gets something wrong?", es: "¿Qué pasa si se equivoca?" },
  "home.faq.a3": {
    en: "You get an SMS after every call with the caller's number, what they asked, and what happened. If something needs your attention, you'll know within seconds. And we're always improving the AI — your feedback makes it smarter.",
    es: "Recibes un SMS después de cada llamada con el número del llamante, lo que pidió y lo que sucedió. Si algo necesita tu atención, lo sabrás en segundos. Y siempre estamos mejorando la IA — tus comentarios la hacen más inteligente.",
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
  "pricing.billingNote": {
    en: "Simple monthly pricing. You're charged for your first month at checkout and billed monthly after that. Cancel anytime.",
    es: "Precios mensuales simples. Se te cobra el primer mes al finalizar la compra y se te factura mensualmente después. Cancela cuando quieras.",
  },
  /* Honest caveats — own the gap between the plan bullets and what is built today */
  "pricing.caveat1": {
    en: "Good to know: WhatsApp + Facebook messaging and the unified inbox are in development — you'll get them the moment they launch.",
    es: "Ten en cuenta: la mensajería de WhatsApp + Facebook y la bandeja de entrada unificada están en desarrollo — las tendrás en cuanto se lancen.",
  },
  "pricing.caveat2": {
    en: "Growth includes analytics and team tools in their current form; advanced analytics and per-member routing are still in progress.",
    es: "Growth incluye analíticas y herramientas de equipo en su forma actual; las analíticas avanzadas y el enrutamiento por miembro del equipo siguen en desarrollo.",
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
  "pricing.starter.feature3": { en: "SMS & web chat", es: "SMS y chat web" },
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
  "pricing.growth.feature3": { en: "WhatsApp & Facebook integration", es: "Integración con WhatsApp y Facebook" },
  "pricing.growth.feature4": { en: "Advanced analytics dashboard", es: "Panel de analíticas avanzadas" },
  "pricing.growth.feature5": { en: "Team management", es: "Gestión de equipo" },
  "pricing.growth.feature6": { en: "Priority email & chat support", es: "Soporte prioritario por correo y chat" },

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
    en: "The AI answers WhatsApp messages the same way it answers calls and texts.",
    es: "La IA responde los mensajes de WhatsApp igual que responde las llamadas y los mensajes de texto.",
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
    en: "Customize your plan with these extras.",
    es: "Personaliza tu plan con estos extras.",
  },
  "pricing.addon1.name": { en: "Extra phone number", es: "Número telefónico adicional" },
  "pricing.addon1.price": { en: "$15/mo", es: "$15/mes" },
  "pricing.addon2.name": { en: "Additional AI-minutes (500)", es: "Minutos de IA adicionales (500)" },
  "pricing.addon2.price": { en: "$25/mo", es: "$25/mes" },
  "pricing.addon3.name": { en: "Custom integration setup", es: "Configuración de integración personalizada" },
  "pricing.addon3.price": { en: "$500 one-time", es: "$500 pago único" },
  "pricing.addon4.name": { en: "HIPAA compliance add-on", es: "Complemento de cumplimiento HIPAA" },
  "pricing.addon4.price": { en: "$50/mo", es: "$50/mes" },

  /* ─── Pricing / FAQ — shared number Q&As ─── */
  "faq.number.q": { en: "Can I use my existing phone number?", es: "¿Puedo usar mi número de teléfono actual?" },
  "faq.number.a": {
    en: "Yes, but our honest recommendation is to start with a new ReceptionAI number. You're live in minutes, every call is recorded and summarized straight to your phone, and your existing number keeps working for outbound calls, existing customers, and emergencies. Porting your number to us is possible, but we don't recommend it: it typically takes 1–4 weeks with your current carrier, can briefly interrupt service if anything slips, and adds friction you don't need on day one. If you still want to port, we'll handle it with you directly — you send a recent bill and sign a letter of authorization, we submit the port, and we update you at every step. Talk to our team and we'll guide you through it.",
    es: "Sí, pero nuestra recomendación honesta es empezar con un número nuevo de ReceptionAI. Estás en funcionamiento en minutos, cada llamada se graba y se resume directo a tu teléfono, y tu número actual sigue funcionando para llamadas salientes, clientes existentes y emergencias. Portar tu número a nosotros es posible, pero no lo recomendamos: normalmente toma de 1 a 4 semanas con tu operador actual, puede interrumpir brevemente el servicio si algo falla, y agrega fricción que no necesitas el primer día. Si aun así quieres portar, lo manejamos contigo directamente: nos envías una factura reciente y firmas una carta de autorización, nosotros enviamos la solicitud de portabilidad y te actualizamos en cada paso. Habla con nuestro equipo y te guiaremos.",
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
    en: "Yes! You can upgrade or downgrade at any time. Changes take effect immediately, and we'll prorate your billing.",
    es: "¡Sí! Puedes subir o bajar de plan en cualquier momento. Los cambios se aplican de inmediato y prorrateamos tu facturación.",
  },
  "pricing.faq2.q": { en: "What happens if I run out of AI-minutes?", es: "¿Qué pasa si se me acaban los minutos de IA?" },
  "pricing.faq2.a": {
    en: "You can purchase additional minutes in bundles of 500. We'll notify you when you're approaching your limit.",
    es: "Puedes comprar minutos adicionales en paquetes de 500. Te avisaremos cuando te acerques a tu límite.",
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
    en: "Yes! ReceptionAI handles calls, texts, and web chats in both English and Spanish. Callers can switch languages at any time.",
    es: "¡Sí! ReceptionAI maneja llamadas, mensajes de texto y chats web tanto en inglés como en español. Los llamantes pueden cambiar de idioma en cualquier momento.",
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
