import { createFileRoute } from "@tanstack/react-router";
import ChatWidgetPreview from "~/components/ChatWidgetPreview";

export const Route = createFileRoute("/dashboard/widget")({
  component: WidgetPage,
});

function WidgetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Web Chat Widget</h1>
        <p className="mt-1 text-sm text-gray-500">Preview and customize the chat widget for your website.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Preview */}
        <div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
            <p className="mt-1 text-xs text-gray-500">This is how the chat widget will look on your website.</p>
            <div className="mt-6 flex justify-center">
              <ChatWidgetPreview />
            </div>
          </div>
        </div>

        {/* Embed Code */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Customize</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600">Primary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" defaultValue="#4f46e5" className="h-9 w-9 cursor-pointer rounded-lg border border-gray-200" />
                  <span className="text-sm text-gray-500">#4f46e5 (Indigo)</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Widget Position</label>
                <select className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option>Bottom Right</option>
                  <option>Bottom Left</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Greeting Message</label>
                <textarea
                  defaultValue="👋 Hi! I'm your AI receptionist. How can I help you today?"
                  rows={2}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Embed Code</h2>
            <p className="mt-1 text-xs text-gray-500">Add this to your website's HTML.</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400">
{`<!-- ReceptionAI Chat Widget -->
<script>
  window.__RECEPTIONAI_CONFIG__ = {
    businessId: "YOUR_BUSINESS_ID",
    primaryColor: "#4f46e5",
    position: "bottom-right",
    language: "en"
  };
</script>
<script src="https://widget.receptionai.com/chat.js" async></script>`}
            </pre>
            <button
              onClick={() => navigator.clipboard?.writeText(`<!-- ReceptionAI Chat Widget -->\n<script>\n  window.__RECEPTIONAI_CONFIG__ = {\n    businessId: "YOUR_BUSINESS_ID",\n    primaryColor: "#4f46e5",\n    position: "bottom-right",\n    language: "en"\n  };\n</script>\n<script src="https://widget.receptionai.com/chat.js" async></script>`)}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Copy Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}