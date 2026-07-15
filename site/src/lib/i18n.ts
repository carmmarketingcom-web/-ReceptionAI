/**
 * Simple i18n for English and Spanish.
 * Usage: import { t, useLocale } from "~/lib/i18n";
 *
 * To switch locale, set the `lang` attribute on <html>:
 *   document.documentElement.lang = "es";
 *   localStorage.setItem("locale", "es");
 *   window.location.reload();
 *
 * The system reads the locale from localStorage first, then the <html> lang attr,
 * then the browser's navigator.language, defaulting to "en".
 */

export type Locale = "en" | "es";

export const translations: Record<string, { en: string; es: string }> = {
  /* Navigation */
  "nav.home": { en: "Home", es: "Inicio" },
  "nav.features": { en: "Features", es: "Características" },
  "nav.pricing": { en: "Pricing", es: "Precios" },
  "nav.demo": { en: "Get a Demo", es: "Solicitar Demo" },
  "nav.dashboard": { en: "Dashboard", es: "Panel" },
  "nav.login": { en: "Log In", es: "Iniciar Sesión" },
  "nav.getStarted": { en: "Get Started", es: "Comenzar" },

  /* Hero Section */
  "hero.title": {
    en: "Never Miss a Lead Again. Your AI Receptionist Works 24/7.",
    es: "Nunca Pierdas un Cliente. Tu Recepcionista IA Trabaja 24/7.",
  },
  "hero.subtitle": {
    en: "ReceptionAI answers calls, texts, web chats, and messages — in English and Spanish — schedules appointments, sends reminders, and transfers to your team when needed. All for less than the cost of a human receptionist.",
    es: "ReceptionAI responde llamadas, textos, chats web y mensajes — en inglés y español — agenda citas, envía recordatorios y transfiere a tu equipo cuando sea necesario. Todo por menos del costo de un recepcionista humano.",
  },
  "hero.cta": {
    en: "Start Free Trial",
    es: "Prueba Gratis",
  },
  "hero.watchDemo": { en: "Watch Demo", es: "Ver Demo" },
  "hero.stats": {
    en: "Trusted by 500+ businesses",
    es: "Confiado por 500+ negocios",
  },

  /* Features Section */
  "features.title": {
    en: "Everything your business needs to handle inbound communications",
    es: "Todo lo que tu negocio necesita para manejar comunicaciones entrantes",
  },
  "features.subtitle": {
    en: "One platform that answers calls, messages, and schedules — so you can focus on doing what you do best.",
    es: "Una plataforma que responde llamadas, mensajes y agenda — para que te enfoques en lo que mejor haces.",
  },

  /* Feature Items */
  "feature.247.title": { en: "24/7 Call Answering", es: "Respuesta de Llamadas 24/7" },
  "feature.247.desc": {
    en: "Never miss a business opportunity. AI answers every call instantly, day or night, weekends and holidays included.",
    es: "Nunca pierdas una oportunidad de negocio. La IA responde cada llamada al instante, de día o de noche, fines de semana y feriados incluidos.",
  },
  "feature.multilingual.title": {
    en: "Bilingual (English & Spanish)",
    es: "Bilingüe (Inglés y Español)",
  },
  "feature.multilingual.desc": {
    en: "Serve your customers in the language they're most comfortable with. Seamless switching between English and Spanish.",
    es: "Atiende a tus clientes en el idioma con el que se sientan más cómodos. Cambio sin esfuerzo entre inglés y español.",
  },
  "feature.scheduling.title": {
    en: "Smart Appointment Scheduling",
    es: "Agendamiento Inteligente de Citas",
  },
  "feature.scheduling.desc": {
    en: "AI reads your calendar and books appointments automatically. Send confirmations, reminders, and follow-ups via SMS or email.",
    es: "La IA lee tu calendario y agenda citas automáticamente. Envía confirmaciones, recordatorios y seguimientos por SMS o correo electrónico.",
  },
  "feature.multichannel.title": {
    en: "Omnichannel Inbox",
    es: "Bandeja de Entrada Omnicanal",
  },
  "feature.multichannel.desc": {
    en: "Calls, texts, web chat, WhatsApp, Facebook — all conversations in one place. Never lose track of a lead.",
    es: "Llamadas, textos, chat web, WhatsApp, Facebook — todas las conversaciones en un solo lugar. Nunca pierdas el rastro de un cliente potencial.",
  },
  "feature.human.title": {
    en: "Human Handoff When Needed",
    es: "Transferencia a Humanos Cuando Sea Necesario",
  },
  "feature.human.desc": {
    en: "Smart escalation to your team. When the AI detects a complex issue, it transfers the call or chat seamlessly.",
    es: "Escalado inteligente a tu equipo. Cuando la IA detecta un problema complejo, transfiere la llamada o el chat sin problemas.",
  },
  "feature.analytics.title": {
    en: "Analytics & Insights",
    es: "Analíticas e Información",
  },
  "feature.analytics.desc": {
    en: "See how many calls you're missing, booking rates, peak hours, and customer satisfaction scores — all in one dashboard.",
    es: "Ve cuántas llamadas estás perdiendo, tasas de reserva, horas pico y puntuaciones de satisfacción del cliente — todo en un panel.",
  },

  /* Feature Icons */
  "feature.247.icon": { en: "📞", es: "📞" },
  "feature.multilingual.icon": { en: "🌐", es: "🌐" },
  "feature.scheduling.icon": { en: "📅", es: "📅" },
  "feature.multichannel.icon": { en: "💬", es: "💬" },
  "feature.human.icon": { en: "🔄", es: "🔄" },
  "feature.analytics.icon": { en: "📊", es: "📊" },

  /* How It Works */
  "how.title": {
    en: "How It Works",
    es: "Cómo Funciona",
  },
  "how.step1.title": { en: "Connect Your Number", es: "Conecta tu Número" },
  "how.step1.desc": {
    en: "Port your existing business number or get a new one. Connect your calendar and we're ready to go.",
    es: "Transfiere tu número de negocio existente u obtén uno nuevo. Conecta tu calendario y estamos listos.",
  },
  "how.step2.title": { en: "AI Takes the Calls", es: "La IA Recibe las Llamadas" },
  "how.step2.desc": {
    en: "Your AI receptionist answers every call, asks the right questions, and books appointments — in English or Spanish.",
    es: "Tu recepcionista IA responde cada llamada, hace las preguntas correctas y agenda citas — en inglés o español.",
  },
  "how.step3.title": { en: "You Focus on the Work", es: "Tú Enfócate en el Trabajo" },
  "how.step3.desc": {
    en: "Get notifications, see all conversations in your dashboard, and only step in when the AI transfers a call to you.",
    es: "Recibe notificaciones, ve todas las conversaciones en tu panel y solo intervén cuando la IA te transfiera una llamada.",
  },

  /* Pricing */
  "pricing.title": { en: "Simple, Transparent Pricing", es: "Precios Simples y Transparentes" },
  "pricing.subtitle": {
    en: "No hidden fees, no surprise charges. Start small and scale as you grow.",
    es: "Sin cargos ocultos, sin sorpresas. Comienza pequeño y escala a medida que creces.",
  },
  "pricing.monthly": { en: "Monthly", es: "Mensual" },
  "pricing.yearly": { en: "Yearly (Save 20%)", es: "Anual (Ahorra 20%)" },
  "pricing.starter.name": { en: "Starter", es: "Inicial" },
  "pricing.starter.price": { en: "$99", es: "$99" },
  "pricing.starter.desc": {
    en: "Perfect for solopreneurs and small shops just getting started.",
    es: "Perfecto para emprendedores individuales y pequeños negocios que están comenzando.",
  },
  "pricing.starter.feature1": { en: "1 phone line", es: "1 línea telefónica" },
  "pricing.starter.feature2": { en: "500 AI-minutes/mo", es: "500 minutos IA/mes" },
  "pricing.starter.feature3": { en: "SMS & web chat", es: "SMS y chat web" },
  "pricing.starter.feature4": { en: "Basic calendar sync", es: "Sincronización básica de calendario" },
  "pricing.starter.feature5": { en: "English & Spanish", es: "Inglés y Español" },
  "pricing.growth.name": { en: "Growth", es: "Crecimiento" },
  "pricing.growth.price": { en: "$199", es: "$199" },
  "pricing.growth.desc": {
    en: "Ideal for growing teams that need more coverage and channels.",
    es: "Ideal para equipos en crecimiento que necesitan más cobertura y canales.",
  },
  "pricing.growth.feature1": { en: "2 phone lines", es: "2 líneas telefónicas" },
  "pricing.growth.feature2": { en: "2,000 AI-minutes/mo", es: "2,000 minutos IA/mes" },
  "pricing.growth.feature3": { en: "WhatsApp & Facebook", es: "WhatsApp y Facebook" },
  "pricing.growth.feature4": { en: "Advanced analytics", es: "Analíticas avanzadas" },
  "pricing.growth.feature5": { en: "Team management", es: "Gestión de equipo" },
  "pricing.scale.name": { en: "Scale", es: "Escala" },
  "pricing.scale.price": { en: "$399", es: "$399" },
  "pricing.scale.desc": {
    en: "For high-volume businesses that need unlimited capacity and custom AI.",
    es: "Para negocios de alto volumen que necesitan capacidad ilimitada e IA personalizada.",
  },
  "pricing.scale.feature1": { en: "Unlimited lines", es: "Líneas ilimitadas" },
  "pricing.scale.feature2": { en: "10,000+ AI-minutes/mo", es: "10,000+ minutos IA/mes" },
  "pricing.scale.feature3": { en: "Custom AI responses", es: "Respuestas IA personalizadas" },
  "pricing.scale.feature4": { en: "Priority support", es: "Soporte prioritario" },
  "pricing.scale.feature5": { en: "All channels included", es: "Todos los canales incluidos" },
  "pricing.cta": { en: "Start Free Trial", es: "Prueba Gratis" },
  "pricing.popular": { en: "Most Popular", es: "Más Popular" },

  /* Demo Page */
  "demo.title": { en: "See ReceptionAI in Action", es: "Ve ReceptionAI en Acción" },
  "demo.subtitle": {
    en: "Fill out the form and we'll show you how AI can transform your business communications.",
    es: "Completa el formulario y te mostraremos cómo la IA puede transformar tus comunicaciones empresariales.",
  },
  "demo.form.name": { en: "Full Name", es: "Nombre Completo" },
  "demo.form.email": { en: "Business Email", es: "Correo Electrónico" },
  "demo.form.phone": { en: "Phone Number", es: "Número de Teléfono" },
  "demo.form.company": { en: "Company Name", es: "Nombre de la Empresa" },
  "demo.form.employees": { en: "Number of Employees", es: "Número de Empleados" },
  "demo.form.submit": { en: "Request Demo", es: "Solicitar Demo" },
  "demo.form.success": {
    en: "Thanks! We'll be in touch within 24 hours.",
    es: "¡Gracias! Te contactaremos dentro de 24 horas.",
  },

  /* Footer */
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
  "footer.copyright": {
    en: "© 2026 ReceptionAI. All rights reserved.",
    es: "© 2026 ReceptionAI. Todos los derechos reservados.",
  },

  /* Dashboard */
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

  /* Login / Auth */
  "login.welcome": { en: "Welcome back", es: "Bienvenido de nuevo" },
  "login.subtitle": { en: "Sign in to your ReceptionAI dashboard.", es: "Inicia sesión en tu panel de ReceptionAI." },
  "login.createAccount": { en: "Create your account", es: "Crea tu cuenta" },
  "login.createSubtitle": { en: "Start your 14-day free trial. No credit card needed.", es: "Comienza tu prueba gratuita de 14 días. Sin necesidad de tarjeta de crédito." },
  "login.email": { en: "Business Email", es: "Correo Electrónico" },
  "login.password": { en: "Password", es: "Contraseña" },
  "login.signIn": { en: "Sign In", es: "Iniciar Sesión" },
  "login.createAccountBtn": { en: "Create Account", es: "Crear Cuenta" },
  "login.rememberMe": { en: "Remember me", es: "Recordarme" },
  "login.forgotPassword": { en: "Forgot password?", es: "¿Olvidaste tu contraseña?" },
  "login.noAccount": { en: "Don't have an account?", es: "¿No tienes una cuenta?" },
  "login.hasAccount": { en: "Already have an account?", es: "¿Ya tienes una cuenta?" },
  "login.startTrial": { en: "Start free trial", es: "Prueba gratuita" },
  "login.pleaseWait": { en: "Please wait...", es: "Espere por favor..." },
  "login.fillFields": { en: "Please fill in all fields.", es: "Por favor complete todos los campos." },
};

export function getLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("locale");
    if (stored === "es" || stored === "en") return stored;
  }
  const html = typeof document !== "undefined" ? document.documentElement.lang : "en";
  if (html === "es" || html === "en") return html;
  if (typeof navigator !== "undefined") {
    const nav = navigator.language?.slice(0, 2);
    if (nav === "es") return "es";
  }
  return "en";
}

export function t(key: string, locale?: Locale): string {
  const loc = locale ?? getLocale();
  return translations[key]?.[loc] ?? key;
}