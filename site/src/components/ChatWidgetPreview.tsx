import { useState, useRef, useEffect } from "react";

type Message = {
  role: "bot" | "user";
  content: string;
};

export default function ChatWidgetPreview() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", content: "Hi! I'm your AI receptionist. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<"en" | "es">("en");
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const switchLanguage = (newLang: "en" | "es") => {
    setLang(newLang);
    setMessages([
      {
        role: "bot",
        content: newLang === "en"
          ? "Hi! I'm your AI receptionist. How can I help you today?"
          : "Hola! Soy tu recepcionista de IA. Como puedo ayudarte hoy?",
      },
    ]);
  };

  const sendMessage = async () => {
    if (!input.trim() || typing) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, lang }),
      });
      const data = (await res.json()) as { reply?: string };
      const reply = data.reply || "I'm not sure how to answer that. Can you rephrase?";
      setMessages((prev) => [...prev, { role: "bot", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "bot",
        content: lang === "en"
          ? "Sorry, I'm having trouble connecting. Please try again."
          : "Lo siento, tengo problemas para conectarme. Intentalo de nuevo.",
      }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Language:</span>
          <button
            onClick={() => switchLanguage("en")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${lang === "en" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            EN
          </button>
          <button
            onClick={() => switchLanguage("es")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${lang === "es" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            ES
          </button>
        </div>
        <button
          onClick={() => switchLanguage(lang)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Reset
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-sm">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {lang === "en" ? "Chat with us" : "Chatea con nosotros"}
          </button>
        )}

        {isOpen && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-indigo-600 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">AI</div>
                <div>
                  <p className="text-sm font-semibold text-white">ReceptionAI</p>
                  <p className="text-xs text-indigo-200">{lang === "en" ? "Online" : "En linea"}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="h-72 space-y-3 overflow-y-auto p-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`mt-1 text-[10px] ${msg.role === "user" ? "text-indigo-200" : "text-gray-400"}`}>
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl bg-gray-100 px-4 py-3 text-gray-900">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-gray-100 p-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={lang === "en" ? "Type a message..." : "Escribe un mensaje..."}
                disabled={typing}
                className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || typing}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-xs text-gray-400">
        {lang === "en"
          ? "Ask me about pricing, hours, appointments, or features!"
          : "Preguntame sobre precios, horarios, citas o caracteristicas!"}
      </div>
    </div>
  );
}
