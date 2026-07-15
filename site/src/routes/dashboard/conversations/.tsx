import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/conversations/$id")({
  component: ConversationDetailPage,
});

type Message = {
  role: "ai" | "customer" | "human";
  content: string;
  time: string;
};

const conversationData: Record<string, {
  name: string;
  initials: string;
  channel: string;
  phone: string;
  email: string;
  status: string;
  messages: Message[];
}> = {
  "C-1001": {
    name: "Maria Garcia",
    initials: "MG",
    channel: "📞 Call",
    phone: "(555) 123-4567",
    email: "maria.g@email.com",
    status: "completed",
    messages: [
      { role: "ai", content: "Thank you for calling Garcia's HVAC Service. This is Maria speaking — how can I help you today?", time: "2:43 PM" },
      { role: "customer", content: "Hi, my AC unit stopped working. It's blowing warm air. Can someone come take a look?", time: "2:43 PM" },
      { role: "ai", content: "I'm sorry to hear that. I can help schedule a service appointment. What's your address?", time: "2:43 PM" },
      { role: "customer", content: "123 Oak Street, apartment 4B.", time: "2:44 PM" },
      { role: "ai", content: "Great, I have an appointment available tomorrow at 2:00 PM. Does that work?", time: "2:44 PM" },
      { role: "customer", content: "Yes, that works perfectly.", time: "2:44 PM" },
      { role: "ai", content: "Perfect! I've booked your AC repair for tomorrow at 2:00 PM. You'll receive a confirmation via SMS. Is there anything else I can help with?", time: "2:44 PM" },
      { role: "customer", content: "No, that's all. Thank you!", time: "2:45 PM" },
      { role: "ai", content: "You're welcome! Have a great day.", time: "2:45 PM" },
    ],
  },
  "C-1002": {
    name: "John Smith",
    initials: "JS",
    channel: "💬 Chat",
    phone: "(555) 987-6543",
    email: "john.smith@email.com",
    status: "active",
    messages: [
      { role: "customer", content: "Hi, I'm looking at your website. Can you tell me about your pricing?", time: "11:30 AM" },
      { role: "ai", content: "Of course! We have three plans: Starter at $99/mo, Growth at $199/mo, and Scale at $399/mo. The Growth plan is our most popular — it includes 2 phone lines, 2,000 AI-minutes, and WhatsApp integration. Would you like more details on any specific plan?", time: "11:30 AM" },
      { role: "customer", content: "The Growth plan sounds interesting. How many team members can use it?", time: "11:32 AM" },
      { role: "ai", content: "The Growth plan includes full team management with no limit on team members. Each team member gets their own dashboard access with role-based permissions. Would you like to schedule a demo?", time: "11:32 AM" },
      { role: "customer", content: "Yes, please! Can we do it this week?", time: "11:33 AM" },
      { role: "human", content: "Hi John! This is Sarah from sales. I can do a demo this Thursday at 2 PM. Does that work for you?", time: "11:35 AM" },
    ],
  },
};

function ConversationDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const conv = conversationData[id];

  if (!conv) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-gray-900">Conversation not found</p>
        <p className="mt-1 text-sm text-gray-500">The conversation "{id}" doesn't exist.</p>
        <button
          onClick={() => navigate({ to: "/dashboard/conversations" })}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          ← Back to conversations
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate({ to: "/dashboard/conversations" })}
            className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
              {conv.initials}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{conv.name}</h1>
              <p className="text-xs text-gray-500">{conv.channel} · {id}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            {conv.status}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Messages */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Conversation Thread</h2>
          </div>
          <div className="space-y-4 p-5">
            {conv.messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "customer" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === "ai"
                      ? "bg-indigo-50 text-indigo-900"
                      : msg.role === "human"
                      ? "bg-amber-50 text-amber-900"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium opacity-60">
                      {msg.role === "ai" ? "AI" : msg.role === "human" ? "Human" : conv.name}
                    </span>
                    <span className="text-xs opacity-40">{msg.time}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Info Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Contact Info</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">📞</span>
                <a href={`tel:${conv.phone}`} className="text-gray-700 hover:text-indigo-600">{conv.phone}</a>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">✉️</span>
                <a href={`mailto:${conv.email}`} className="text-gray-700 hover:text-indigo-600">{conv.email}</a>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Actions</h2>
            <div className="mt-4 space-y-2">
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
                📞 Call Back
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                ✉️ Send Message
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                📅 Book Appointment
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                🎧 Listen to Recording
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
            <textarea
              className="mt-2 h-24 w-full resize-none rounded-lg border border-gray-200 p-3 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Add internal notes..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}