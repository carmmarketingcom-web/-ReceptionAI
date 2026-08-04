let widgetCounter = 0;

export default function ChatWidgetPreview() {
  const widgetId = `cw-${++widgetCounter}`;

  const html = `
<div id="${widgetId}" class="cw-root" style="position:relative;z-index:99999">
  <style>
    #${widgetId} .cw-panel { display: none; }
    #${widgetId}.cw-open .cw-panel { display: block; }
    #${widgetId} .cw-btn, #${widgetId} .cw-lang, #${widgetId} .cw-send {
      touch-action: manipulation; -webkit-tap-highlight-color: transparent; cursor: pointer; user-select: none; -webkit-user-select: none;
    }
    #${widgetId} .cw-input {
      -webkit-user-select: text; user-select: text;
      color: #111827 !important;
      -webkit-text-fill-color: #111827 !important;
      background: #fff !important;
      color-scheme: light !important;
    }
  </style>

  <!-- Language buttons (also managed by delegation) -->
  <div class="mb-3 flex items-center justify-end gap-2">
    <button class="cw-lang rounded-lg px-3 py-1 text-xs font-medium bg-indigo-600 text-white" data-cw-action="lang-en">EN</button>
    <button class="cw-lang rounded-lg px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600" data-cw-action="lang-es">ES</button>
  </div>

  <!-- Toggle -->
  <button class="cw-btn flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-lg" data-cw-action="toggle">
    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    <span id="${widgetId}-label">Chat with us</span>
  </button>

  <!-- Panel -->
  <div class="cw-panel mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
    <div class="flex items-center justify-between bg-indigo-600 px-4 py-3">
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">AI</div>
        <div><p class="text-sm font-semibold text-white">ReceptionAI</p><p class="text-xs text-indigo-200">Online</p></div>
      </div>
    </div>
    <div id="${widgetId}-msgs" class="h-72 space-y-3 overflow-y-auto p-4" style="-webkit-overflow-scrolling:touch"></div>
    <div id="${widgetId}-typing"></div>
    <div class="flex items-center gap-2 border-t border-gray-100 p-3">
      <input id="${widgetId}-input" data-cw-action="focus" class="cw-input flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Type a message..." autocomplete="on" style="pointer-events:auto!important;-webkit-user-select:text!important;user-select:text!important;color:#111827!important;-webkit-text-fill-color:#111827!important;background:#fff!important;color-scheme:light!important" />
      <button class="cw-send flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white" data-cw-action="send">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
      </button>
    </div>
  </div>
</div>

<script>
(function() {
  var root = document.getElementById("${widgetId}");
  if (!root || root._init) return;
  root._init = true;

  var msgs = document.getElementById("${widgetId}-msgs");
  var typingEl = document.getElementById("${widgetId}-typing");
  var input = document.getElementById("${widgetId}-input");
  var label = document.getElementById("${widgetId}-label");

  var isOpen = false;
  var lang = "en";
  var messages = [{ role: "bot", content: "Hi! I'm your AI receptionist. How can I help you today?" }];
  var typing = false;

  var t = {
    greeting: { en: "Hi! I'm your AI receptionist. How can I help you today?", es: "Hola! Soy tu recepcionista de IA. Como puedo ayudarte hoy?" },
    error: { en: "Sorry, I'm having trouble connecting.", es: "Lo siento, tengo problemas para conectarme." },
    summary: { en: "Chat with us", es: "Chatea con nosotros" },
    placeholder: { en: "Type a message...", es: "Escribe un mensaje..." }
  };

  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function render() {
    if (!msgs) return;
    msgs.innerHTML = messages.map(function(m) {
      return '<div class="flex ' + (m.role === "user" ? "justify-end" : "justify-start") + '">' +
        '<div class="max-w-[80%] rounded-2xl px-4 py-2 ' + (m.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900") + '">' +
        '<p class="text-sm">' + esc(m.content) + '</p></div></div>';
    }).join("");
    if (typingEl) typingEl.innerHTML = typing ? '<div class="flex justify-start px-2"><div class="max-w-[80%] rounded-2xl bg-gray-100 px-4 py-3"><div class="flex gap-1"><span class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay:0ms"></span><span class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay:150ms"></span><span class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay:300ms"></span></div></div></div>' : "";
    msgs.scrollTop = msgs.scrollHeight;
  }

  function toggleChat() {
    isOpen = !isOpen;
    root.classList.toggle("cw-open", isOpen);
  }

  function switchLang(l) {
    lang = l;
    messages = [{ role: "bot", content: t.greeting[lang] }];
    if (label) label.textContent = t.summary[lang];
    if (input) input.placeholder = t.placeholder[lang];
    // Update lang button styles
    var enBtn = root.querySelector('[data-cw-action="lang-en"]');
    var esBtn = root.querySelector('[data-cw-action="lang-es"]');
    if (enBtn) { enBtn.className = "cw-lang rounded-lg px-3 py-1 text-xs font-medium " + (lang === "en" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"); }
    if (esBtn) { esBtn.className = "cw-lang rounded-lg px-3 py-1 text-xs font-medium " + (lang === "es" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"); }
    render();
  }

  async function send() {
    if (!input) return;
    var text = input.value.trim();
    if (!text || typing) return;
    input.value = "";
    messages.push({ role: "user", content: text });
    typing = true;
    render();
    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, lang: lang, history: messages.filter(function(_,i){return i>0;}), sessionId: "cw-" + Date.now() })
      });
      var data = await res.json();
      messages.push({ role: "bot", content: data.reply || "I'm not sure how to answer that." });
    } catch(e) {
      messages.push({ role: "bot", content: t.error[lang] });
    } finally {
      typing = false;
      render();
    }
  }

  // EVENT DELEGATION on document.body for maximum reliability
  document.body.addEventListener("click", function(e) {
    var el = e.target;
    if (!el) return;
    // Walk up to find a data-cw-action
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute("data-cw-action")) break;
      el = el.parentElement;
    }
    if (!el || !el.getAttribute) return;
    var action = el.getAttribute("data-cw-action");
    if (action === "toggle" && el.closest("#${widgetId}")) { e.preventDefault(); toggleChat(); }
    if (action === "lang-en" && el.closest("#${widgetId}")) { e.preventDefault(); switchLang("en"); }
    if (action === "lang-es" && el.closest("#${widgetId}")) { e.preventDefault(); switchLang("es"); }
    if (action === "send" && el.closest("#${widgetId}")) { e.preventDefault(); send(); }
    if (action === "focus" && el.closest("#${widgetId}")) { e.preventDefault(); input.focus(); input.click(); }
  }, true); // use capture phase

  // Also listen for touchend for mobile
  document.body.addEventListener("touchend", function(e) {
    var el = e.target;
    if (!el) return;
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute("data-cw-action")) break;
      el = el.parentElement;
    }
    if (!el || !el.getAttribute) return;
    var action = el.getAttribute("data-cw-action");
    if (action === "toggle" && el.closest("#${widgetId}")) { e.preventDefault(); toggleChat(); }
    if (action === "lang-en" && el.closest("#${widgetId}")) { e.preventDefault(); switchLang("en"); }
    if (action === "lang-es" && el.closest("#${widgetId}")) { e.preventDefault(); switchLang("es"); }
    if (action === "send" && el.closest("#${widgetId}")) { e.preventDefault(); send(); }
    if (action === "focus" && el.closest("#${widgetId}")) { e.preventDefault(); input.focus(); input.click(); }
  }, true);

  // Input: listen on document for keydown in our input
  document.body.addEventListener("keydown", function(e) {
    if (e.target && e.target.id === "${widgetId}-input" && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }, true);

  render();
})();
<\/script>`;

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
