// ─── Web Chat Widget Embed Script ────────────────────────────────────────────
// Vanilla JS embed script that injects the chat widget into any website.
// Usage: <script src="https://receptionai.app/embed.js" data-org-id="xxx"></script>

// This file is compiled to a standalone JS bundle that:
// 1. Creates a Shadow DOM container so it doesn't conflict with host site styles
// 2. Injects the chat widget styles and markup
// 3. Connects to the ReceptionAI WebSocket chat handler
// 4. Handles the full chat lifecycle

(function () {
  "use strict";

  // ─── Configuration ──────────────────────────────────────────────────────────

  const script = document.currentScript as HTMLScriptElement | null;
  const orgId = script?.getAttribute("data-org-id") || "";
  const primaryColor = script?.getAttribute("data-primary-color") || "#2563eb";
  const position = (script?.getAttribute("data-position") || "bottom-right") as
    | "bottom-right"
    | "bottom-left";
  const locale = (script?.getAttribute("data-locale") || "en") as "en" | "es";
  const apiUrl = script?.getAttribute("data-api-url") || "";

  if (!orgId) {
    console.warn("[ReceptionAI] data-org-id is required. Widget not loaded.");
    return;
  }

  // ─── Translations ───────────────────────────────────────────────────────────

  const I18N: Record<string, Record<string, string>> = {
    en: {
      title: "Chat with us",
      subtitle: "Hi! How can we help you today?",
      placeholder: "Type your message...",
      startButton: "Start Chat",
      nameLabel: "Your Name",
      emailLabel: "Your Email (optional)",
      phoneLabel: "Your Phone (optional)",
      sendButton: "Send",
      closeButton: "Close",
      errorMessage: "Sorry, I'm having trouble connecting.",
      aiTyping: "AI is typing...",
    },
    es: {
      title: "Chatea con nosotros",
      subtitle: "¡Hola! ¿Cómo podemos ayudarte hoy?",
      placeholder: "Escribe tu mensaje...",
      startButton: "Iniciar Chat",
      nameLabel: "Tu Nombre",
      emailLabel: "Tu Correo (opcional)",
      phoneLabel: "Tu Teléfono (opcional)",
      sendButton: "Enviar",
      closeButton: "Cerrar",
      errorMessage: "Lo siento, tengo problemas de conexión.",
      aiTyping: "La IA está escribiendo...",
    },
  };

  const i18n = I18N[locale] || I18N.en;

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const styles = `
    .rc-chat-bubble {
      position: fixed;
      bottom: 24px;
      right: ${position === "bottom-left" ? "auto" : "24px"};
      left: ${position === "bottom-left" ? "24px" : "auto"};
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${primaryColor};
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .rc-chat-bubble:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    .rc-chat-bubble svg {
      width: 28px;
      height: 28px;
    }
    .rc-chat-window {
      position: fixed;
      bottom: 100px;
      right: ${position === "bottom-left" ? "auto" : "24px"};
      left: ${position === "bottom-left" ? "24px" : "auto"};
      width: 360px;
      height: 560px;
      max-height: calc(100vh - 140px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      z-index: 999999;
      overflow: hidden;
      animation: rc-slideIn 0.3s ease-out;
    }
    @keyframes rc-slideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .rc-header {
      background: ${primaryColor};
      color: white;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rc-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
    .rc-header p { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
    .rc-close-btn {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 20px;
      padding: 4px;
    }
    .rc-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .rc-message {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
    }
    .rc-message-customer {
      align-self: flex-end;
      background: ${primaryColor};
      color: white;
      border-bottom-right-radius: 4px;
    }
    .rc-message-ai {
      align-self: flex-start;
      background: #f1f5f9;
      color: #1e293b;
      border-bottom-left-radius: 4px;
    }
    .rc-message-system {
      align-self: center;
      color: #94a3b8;
      font-size: 12px;
    }
    .rc-typing {
      align-self: flex-start;
      padding: 10px 14px;
      border-radius: 12px;
      background: #f1f5f9;
      display: flex;
      gap: 4px;
    }
    .rc-typing-dot {
      width: 8px;
      height: 8px;
      background: #94a3b8;
      border-radius: 50%;
      animation: rc-bounce 1.4s infinite ease-in-out;
    }
    .rc-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .rc-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes rc-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    .rc-input-area {
      padding: 12px 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
    }
    .rc-input-area input {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      padding: 10px 16px;
      font-size: 14px;
      outline: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .rc-input-area input:focus { border-color: ${primaryColor}; }
    .rc-send-btn {
      background: ${primaryColor};
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .rc-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .rc-form {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .rc-form label { font-size: 14px; font-weight: 500; color: #475569; }
    .rc-form input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
    }
    .rc-form input:focus { border-color: ${primaryColor}; }
    .rc-form button {
      background: ${primaryColor};
      color: white;
      border: none;
      padding: 12px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .rc-timestamp {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 4px;
      text-align: right;
    }
  `;

  // ─── Widget Logic ───────────────────────────────────────────────────────────

  let isOpen = false;
  let showForm = true;
  let ws: WebSocket | null = null;
  let sessionId = crypto.randomUUID();
  let customerName = "";
  let customerEmail = "";
  let customerPhone = "";

  const messages: Array<{ id: string; role: string; content: string; timestamp: Date }> = [];

  function getWsUrl(): string {
    if (apiUrl) return apiUrl;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/api/chat`;
  }

  function connectWebSocket() {
    ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      ws?.send(JSON.stringify({
        type: "message",
        content: `Hi, I'm ${customerName}.`,
        sessionId,
        orgId,
        customer: { name: customerName, email: customerEmail || undefined, phone: customerPhone || undefined },
      }));
      addMessage("ai", `Hello ${customerName}! I'm ReceptionAI, your virtual assistant. How can I help you today?`);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "typing") {
        const typingEl = root.querySelector(".rc-typing");
        if (typingEl) {
          typingEl.style.display = data.action === "ai_thinking" ? "flex" : "none";
        }
        return;
      }
      if (data.type === "message" && data.content) {
        const typingEl = root.querySelector(".rc-typing");
        if (typingEl) typingEl.style.display = "none";
        addMessage("ai", data.content);
      }
    };

    ws.onerror = () => {
      addMessage("system", i18n.errorMessage);
    };

    ws.onclose = () => {
      setTimeout(() => { if (isOpen) connectWebSocket(); }, 3000);
    };
  }

  function addMessage(role: string, content: string) {
    messages.push({ id: crypto.randomUUID(), role, content, timestamp: new Date() });
    renderMessages();
  }

  function sendMessage() {
    const input = root.querySelector(".rc-input-area input") as HTMLInputElement;
    if (!input || !input.value.trim() || !ws) return;

    const text = input.value.trim();
    input.value = "";
    addMessage("customer", text);
    ws.send(JSON.stringify({ type: "message", content: text, sessionId, orgId }));
  }

  function renderMessages() {
    const container = root.querySelector(".rc-messages");
    if (!container) return;

    container.innerHTML = messages.map((msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `<div>
        <div class="rc-message rc-message-${msg.role}">${escapeHtml(msg.content)}</div>
        <div class="rc-timestamp">${time}</div>
      </div>`;
    }).join("") + `<div class="rc-typing" style="display:none">
      <div class="rc-typing-dot"></div>
      <div class="rc-typing-dot"></div>
      <div class="rc-typing-dot"></div>
    </div>`;

    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Build DOM ──────────────────────────────────────────────────────────────

  const host = document.createElement("div");
  host.id = "receptionai-widget";

  const shadow = host.attachShadow({ mode: "closed" });
  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  shadow.appendChild(styleEl);

  const root = document.createElement("div");
  root.style.cssText = "all:initial;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
  shadow.appendChild(root);

  function render() {
    root.innerHTML = isOpen ? renderChatWindow() : renderBubble();
    if (isOpen) {
      setupChatListeners();
      if (showForm) setupFormListener();
      else renderMessages();
    }
  }

  function renderBubble(): string {
    return `<button class="rc-chat-bubble" id="rc-bubble-btn" aria-label="Open chat">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
    </button>`;
  }

  function renderChatWindow(): string {
    if (showForm) {
      return `<div class="rc-chat-window">
        <div class="rc-header">
          <div><h3>${escapeHtml(i18n.title)}</h3><p>${escapeHtml(i18n.subtitle)}</p></div>
          <button class="rc-close-btn" id="rc-close-btn">✕</button>
        </div>
        <form class="rc-form" id="rc-form">
          <div>
            <label>${escapeHtml(i18n.nameLabel)} *</label>
            <input type="text" id="rc-name-input" placeholder="John Doe" required>
          </div>
          <div>
            <label>${escapeHtml(i18n.emailLabel)}</label>
            <input type="email" id="rc-email-input" placeholder="john@example.com">
          </div>
          <div>
            <label>${escapeHtml(i18n.phoneLabel)}</label>
            <input type="tel" id="rc-phone-input" placeholder="+1 (555) 123-4567">
          </div>
          <button type="submit">${escapeHtml(i18n.startButton)}</button>
        </form>
      </div>`;
    }

    return `<div class="rc-chat-window">
      <div class="rc-header">
        <div><h3>${escapeHtml(i18n.title)}</h3><p>${escapeHtml(i18n.subtitle)}</p></div>
        <button class="rc-close-btn" id="rc-close-btn">✕</button>
      </div>
      <div class="rc-messages"></div>
      <div class="rc-input-area">
        <input type="text" placeholder="${escapeHtml(i18n.placeholder)}">
        <button class="rc-send-btn" id="rc-send-btn">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>`;
  }

  function setupChatListeners() {
    const closeBtn = root.querySelector("#rc-close-btn");
    closeBtn?.addEventListener("click", () => { isOpen = false; render(); });

    if (!showForm) {
      const input = root.querySelector(".rc-input-area input") as HTMLInputElement;
      const sendBtn = root.querySelector("#rc-send-btn");
      input?.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
      sendBtn?.addEventListener("click", sendMessage);
      renderMessages();
    }
  }

  function setupFormListener() {
    const form = root.querySelector("#rc-form") as HTMLFormElement;
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = (root.querySelector("#rc-name-input") as HTMLInputElement)?.value.trim();
      if (!name) return;
      customerName = name;
      customerEmail = (root.querySelector("#rc-email-input") as HTMLInputElement)?.value.trim();
      customerPhone = (root.querySelector("#rc-phone-input") as HTMLInputElement)?.value.trim();
      showForm = false;
      render();
      connectWebSocket();
    });
  }

  // ─── Initial Render ─────────────────────────────────────────────────────────

  render();
  document.body.appendChild(host);

  // Listen for bubble click — re-attach each render
  document.addEventListener("click", (e) => {
    const target = e.composedPath()[0] as HTMLElement;
    if (target?.id === "rc-bubble-btn") {
      isOpen = true;
      render();
    }
  });

})();