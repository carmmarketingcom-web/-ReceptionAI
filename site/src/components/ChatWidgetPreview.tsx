import { useState, useRef, useEffect } from "react";

type Message = {
  role: "bot" | "user";
  content: string;
};

const botResponses: Record<string, string> = {
  "hi": "Hello! Welcome to our business. How can I help you today?",
  "hello": "Hi there! How can I assist you today?",
  "hours": "We're open Monday to Friday, 9 AM to 5 PM, and Saturday 10 AM to 2 PM. We're closed on Sundays.",
  "price": "We offer three plans: Starter at $99/mo, Growth at $199/mo, and Scale at $399/mo. Would you like more details?",
  "appointment": "I'd be happy to help you book an appointment! Could you tell me what service you need and a preferred date/time?",
  "default": "Thanks for your message! I'm your AI receptionist. I can help with appointments, pricing, hours, or general questions.",
};

function getBotResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, response] of Object.entries(botResponses)) {
    if (lower.includes(key)) return response;
  }
  return botResponses.default;
}

export default function ChatWidgetPreview() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", content: "👋 Hi! I'm your AI receptionist. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<"en" | "es">("en");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");

    setTimeout(() => {
      const botReply = getBotResponse(userMsg);
      setMessages((prev) => [...prev, { role: "bot", content: botReply }]);
    }, 800);
  };

  return (
    <div className="flex flex-col">
      {/* Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Language:</span>
          <button
            onClick={() => setLang("en")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${lang === "en" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            EN
          </button>
          <button
            onClick={() => setLang("es")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${lang === "es" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            ES
          </button>
        </div>
        <button
          onClick={() => setMessages([{ role: "bot" as const, content: "👋 Hi! I'm your AI receptionist. How can I help you today?" }])}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Reset
        </button>
      </div>

      {/* Chat Widget Preview */}
      <div className="relative mx-auto w-full max-w-sm">
        {/* Chat button */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-700"
          >
            💬 Chat with us
          </button>
        )}

        {/* Chat window */}
        {isOpen && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between bg-indigo-600 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                  AI
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">ReceptionAI</p>
                  <p className="text-xs text-indigo-200">Online</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="h-72 space-y-3 overflow-y-auto p-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={`mt-1 text-[10px] ${msg.role === "user" ? "text-indigo-200" : "text-gray-400"}`}>
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 border-t border-gray-100 p-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={lang === "en" ? "Type a message..." : "Escribe un mensaje..."}
                className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
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

      {/* Test hints */}
      <div className="mt-4 text-center text-xs text-gray-400">
        Try typing: "hours", "price", "appointment", or just say "hi"
      </div>
    </div>
  );
}