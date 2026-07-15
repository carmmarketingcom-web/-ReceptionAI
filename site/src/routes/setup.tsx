import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

const steps = [
  { num: 1, title: "Phone Number", icon: "📞" },
  { num: 2, title: "Calendar", icon: "📅" },
  { num: 3, title: "Business Hours", icon: "⏰" },
  { num: 4, title: "AI Greeting", icon: "🤖" },
  { num: 5, title: "Team Members", icon: "👥" },
  { num: 6, title: "Launch", icon: "🚀" },
];

function SetupPage() {
  const [step, setStep] = useState(1);
  const [phoneOption, setPhoneOption] = useState<"port" | "new">("port");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [businessHours, setBusinessHours] = useState({
    monday: { open: "09:00", close: "17:00", enabled: true },
    tuesday: { open: "09:00", close: "17:00", enabled: true },
    wednesday: { open: "09:00", close: "17:00", enabled: true },
    thursday: { open: "09:00", close: "17:00", enabled: true },
    friday: { open: "09:00", close: "17:00", enabled: true },
    saturday: { open: "10:00", close: "14:00", enabled: true },
    sunday: { open: "09:00", close: "17:00", enabled: false },
  });
  const [greeting, setGreeting] = useState("Thank you for calling [Business Name]. This is your AI receptionist. How can I help you today?");
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [businessName, setBusinessName] = useState("");
  const router = useRouter();

  const nextStep = () => setStep((s) => Math.min(s + 1, 6));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const addTeamMember = () => {
    if (newMemberName.trim()) {
      setTeamMembers([...teamMembers, `${newMemberName.trim()} (${newMemberRole || "Team Member"})`]);
      setNewMemberName("");
      setNewMemberRole("");
    }
  };

  const finish = () => {
    router.navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              R
            </div>
            <span className="text-base font-bold tracking-tight text-gray-900">
              Reception<span className="text-indigo-600">AI</span>
            </span>
          </div>
          <span className="text-sm text-gray-500">Step {step} of 6</span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Progress Steps */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.num} className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
                    s.num === step
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : s.num < step
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {s.num < step ? "✓" : s.icon}
                </div>
                <span className={`mt-1.5 hidden text-xs font-medium sm:block ${
                  s.num === step ? "text-indigo-600" : s.num < step ? "text-green-600" : "text-gray-400"
                }`}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${((step - 1) / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {/* Step 1: Phone Number */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Connect your phone number</h2>
                <p className="mt-1 text-sm text-gray-500">Choose how you want to receive calls.</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="phoneOption"
                    checked={phoneOption === "port"}
                    onChange={() => setPhoneOption("port")}
                    className="mt-1 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Port your existing number</p>
                    <p className="text-xs text-gray-500">Keep your current business number. We'll handle the transfer.</p>
                  </div>
                </label>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="phoneOption"
                    checked={phoneOption === "new"}
                    onChange={() => setPhoneOption("new")}
                    className="mt-1 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Get a new number</p>
                    <p className="text-xs text-gray-500">We'll assign you a new local business number.</p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {phoneOption === "port" ? "Current phone number" : "Preferred area code (optional)"}
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={phoneOption === "port" ? "(555) 123-4567" : "e.g., 212 for New York"}
                  className="mt-1 block w-full max-w-sm rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Calendar */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Connect your calendar</h2>
                <p className="mt-1 text-sm text-gray-500">The AI needs to check availability and book appointments.</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-5 transition hover:border-indigo-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg">
                      📅
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Google Calendar</p>
                      <p className="text-xs text-gray-500">Sync appointments and availability</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCalendarConnected(!calendarConnected)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      calendarConnected
                        ? "bg-green-100 text-green-700"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {calendarConnected ? "✓ Connected" : "Connect"}
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg">
                      📧
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Outlook Calendar</p>
                      <p className="text-xs text-gray-500">Sync appointments and availability</p>
                    </div>
                  </div>
                  <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Connect
                  </button>
                </div>
              </div>
              {calendarConnected && (
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  ✓ Google Calendar connected successfully!
                </div>
              )}
            </div>
          )}

          {/* Step 3: Business Hours */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Set your business hours</h2>
                <p className="mt-1 text-sm text-gray-500">When should the AI answer calls? Outside these hours, callers leave a voicemail.</p>
              </div>
              <div className="space-y-3">
                {(Object.entries(businessHours) as [string, { open: string; close: string; enabled: boolean }][]).map(([day, hours]) => (
                  <div key={day} className="flex items-center gap-4 rounded-lg border border-gray-100 p-3">
                    <input
                      type="checkbox"
                      checked={hours.enabled}
                      onChange={() => setBusinessHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day as keyof typeof prev], enabled: !prev[day as keyof typeof prev].enabled }
                      }))}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="w-24 text-sm font-medium capitalize text-gray-900">{day}</span>
                    {hours.enabled ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={hours.open}
                          onChange={(e) => setBusinessHours((prev) => ({
                            ...prev,
                            [day]: { ...prev[day as keyof typeof prev], open: e.target.value }
                          }))}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-400">to</span>
                        <input
                          type="time"
                          value={hours.close}
                          onChange={(e) => setBusinessHours((prev) => ({
                            ...prev,
                            [day]: { ...prev[day as keyof typeof prev], close: e.target.value }
                          }))}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: AI Greeting */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Customize your AI greeting</h2>
                <p className="mt-1 text-sm text-gray-500">This is what callers hear when the AI answers.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g., Johnson's HVAC"
                  className="mt-1 block w-full max-w-sm rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Greeting message</label>
                <textarea
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-2 text-xs text-gray-400">
                  Use [Business Name] as a placeholder — it will be replaced automatically.
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-4">
                <p className="text-xs font-medium text-indigo-700">Preview:</p>
                <p className="mt-1 text-sm text-indigo-900">
                  {greeting.replace("[Business Name]", businessName || "Your Business")}
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Team Members */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add your team members</h2>
                <p className="mt-1 text-sm text-gray-500">Who should receive transferred calls and notifications?</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTeamMember())}
                />
                <input
                  type="text"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  placeholder="Role (optional)"
                  className="w-40 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTeamMember())}
                />
                <button
                  onClick={addTeamMember}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
              {teamMembers.length > 0 && (
                <div className="space-y-2">
                  {teamMembers.map((m, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                          {m.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-900">{m}</span>
                      </div>
                      <button
                        onClick={() => setTeamMembers(teamMembers.filter((_, j) => j !== i))}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {teamMembers.length === 0 && (
                <p className="text-sm text-gray-400">You can add team members now or skip and do it later.</p>
              )}
            </div>
          )}

          {/* Step 6: Launch */}
          {step === 6 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
                🚀
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">You're all set!</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Your AI receptionist is ready to start taking calls. Here's a summary of your setup:
                </p>
              </div>
              <div className="mx-auto max-w-md space-y-3 text-left">
                <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                  <span className="text-lg">📞</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Phone</p>
                    <p className="text-xs text-gray-500">{phoneOption === "port" ? "Porting your number" : "New number requested"}{phoneNumber ? ` · ${phoneNumber}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                  <span className="text-lg">📅</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Calendar</p>
                    <p className="text-xs text-gray-500">{calendarConnected ? "Google Calendar connected" : "Not connected yet"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                  <span className="text-lg">⏰</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Hours</p>
                    <p className="text-xs text-gray-500">{Object.values(businessHours).filter(h => h.enabled).length} days configured</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                  <span className="text-lg">👥</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Team</p>
                    <p className="text-xs text-gray-500">{teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""} added</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
            <button
              onClick={prevStep}
              disabled={step === 1}
              className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
            >
              ← Back
            </button>

            {step < 6 ? (
              <button
                onClick={nextStep}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={finish}
                className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
              >
                Go to Dashboard 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}