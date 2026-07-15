import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

const dayLabels: Record<DayOfWeek, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"hours" | "calendar" | "ai" | "notifications">("hours");
  const [businessHours, setBusinessHours] = useState<Record<DayOfWeek, { open: string; close: string; enabled: boolean }>>({
    monday: { open: "09:00", close: "17:00", enabled: true },
    tuesday: { open: "09:00", close: "17:00", enabled: true },
    wednesday: { open: "09:00", close: "17:00", enabled: true },
    thursday: { open: "09:00", close: "17:00", enabled: true },
    friday: { open: "09:00", close: "17:00", enabled: true },
    saturday: { open: "10:00", close: "14:00", enabled: true },
    sunday: { open: "09:00", close: "17:00", enabled: false },
  });

  const tabs = [
    { id: "hours", label: "Business Hours" },
    { id: "calendar", label: "Calendar" },
    { id: "ai", label: "AI Responses" },
    { id: "notifications", label: "Notifications" },
  ] as const;

  const toggleDay = (day: DayOfWeek) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const updateTime = (day: DayOfWeek, field: "open" | "close", value: string) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your business configuration.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Business Hours */}
      {activeTab === "hours" && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Business Hours</h2>
            <p className="mt-0.5 text-xs text-gray-500">When should the AI answer calls? Outside these hours, callers can leave a voicemail.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {(Object.keys(dayLabels) as DayOfWeek[]).map((day) => (
              <div key={day} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex w-8 items-center">
                  <input
                    type="checkbox"
                    checked={businessHours[day].enabled}
                    onChange={() => toggleDay(day)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <div className="w-24 text-sm font-medium text-gray-900">{dayLabels[day]}</div>
                {businessHours[day].enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={businessHours[day].open}
                      onChange={(e) => updateTime(day, "open", e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-400">to</span>
                    <input
                      type="time"
                      value={businessHours[day].close}
                      onChange={(e) => updateTime(day, "close", e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Closed</span>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 px-5 py-4">
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Save Hours
            </button>
          </div>
        </div>
      )}

      {/* Calendar Connection */}
      {activeTab === "calendar" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Google Calendar</h2>
                <p className="mt-0.5 text-xs text-gray-500">Sync appointments and availability.</p>
              </div>
              <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Connect
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Outlook Calendar</h2>
                <p className="mt-0.5 text-xs text-gray-500">Sync appointments and availability.</p>
              </div>
              <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Responses */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">AI Greeting</h2>
            <p className="mt-0.5 text-xs text-gray-500">What the AI says when it answers a call.</p>
            <textarea
              className="mt-3 h-20 w-full resize-none rounded-lg border border-gray-200 p-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              defaultValue="Thank you for calling [Business Name]. This is your AI receptionist speaking. How can I help you today?"
            />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">After-Hours Message</h2>
            <p className="mt-0.5 text-xs text-gray-500">What callers hear when calling outside business hours.</p>
            <textarea
              className="mt-3 h-20 w-full resize-none rounded-lg border border-gray-200 p-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              defaultValue="You've reached [Business Name] outside of business hours. Please leave a message and we'll get back to you first thing tomorrow."
            />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">FAQ / Custom Responses</h2>
            <p className="mt-0.5 text-xs text-gray-500">Common questions and how the AI should respond.</p>
            <div className="mt-3 space-y-3">
              {[
                { q: "What are your hours?", a: "We're open Monday to Friday, 9 AM to 5 PM, and Saturday 10 AM to 2 PM." },
                { q: "How much does service cost?", a: "Our rates vary by service. I can schedule a free estimate for you." },
                { q: "Do you offer emergency service?", a: "Yes! For emergencies, I'll transfer you to our on-call team immediately." },
              ].map((faq, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-4">
                  <label className="text-xs font-medium text-gray-600">Question</label>
                  <input type="text" defaultValue={faq.q} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  <label className="mt-2 block text-xs font-medium text-gray-600">Response</label>
                  <textarea rows={2} defaultValue={faq.a} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              ))}
              <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">+ Add FAQ</button>
            </div>
          </div>
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Save AI Responses
          </button>
        </div>
      )}

      {/* Notifications */}
      {activeTab === "notifications" && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Notification Preferences</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { label: "New call received", desc: "Get notified when a new call comes in" },
              { label: "New voicemail", desc: "Get notified when a voicemail is left" },
              { label: "Appointment booked", desc: "Get notified when a new appointment is scheduled" },
              { label: "Appointment cancelled", desc: "Get notified when an appointment is cancelled" },
              { label: "Human handoff needed", desc: "Get notified when the AI transfers a call to you" },
              { label: "Daily summary", desc: "Receive a daily summary of all activity" },
              { label: "Weekly report", desc: "Receive a weekly analytics report every Monday" },
            ].map((notif) => (
              <div key={notif.label} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{notif.label}</p>
                  <p className="text-xs text-gray-500">{notif.desc}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" defaultChecked className="peer sr-only" />
                  <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-indigo-600 peer-checked:after:translate-x-full" />
                </label>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-900">Notification Email</label>
              <input type="email" defaultValue="owner@mybusiness.com" className="mt-1 block w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}