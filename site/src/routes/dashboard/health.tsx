import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { normalizeOrgHealth } from "../../lib/org-health";

export const Route = createFileRoute("/dashboard/health")({
  component: HealthPage,
});

// ─── Types ──────────────────────────────────────────────────────────

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  callControlId?: string;
  tip?: string;
}

// ─── Status Badge ───────────────────────────────────────────────────

function StatusDot({ state }: { state: "ok" | "warn" | "bad" | "unknown" }) {
  const colour =
    state === "ok"
      ? "bg-green-500"
      : state === "warn"
        ? "bg-amber-500"
        : state === "bad"
          ? "bg-red-500"
          : "bg-gray-300";
  return <span className={`inline-block h-3 w-3 rounded-full ${colour}`} title={state} />;
}

function StatusLabel({ state, text }: { state: "ok" | "warn" | "bad" | "unknown"; text: string }) {
  const colour =
    state === "ok"
      ? "text-green-700"
      : state === "warn"
        ? "text-amber-700"
        : state === "bad"
          ? "text-red-700"
          : "text-gray-500";
  return <span className={`text-sm font-medium ${colour}`}>{text}</span>;
}

// ─── Card ───────────────────────────────────────────────────────────

function StatusCard({
  title,
  state,
  children,
  tip,
}: {
  title: string;
  state: "ok" | "warn" | "bad" | "unknown";
  children: React.ReactNode;
  tip?: string;
}) {
  const border =
    state === "ok"
      ? "border-green-200"
      : state === "warn"
        ? "border-amber-200 bg-amber-50/30"
        : state === "bad"
          ? "border-red-200 bg-red-50/30"
          : "border-gray-200";
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${border}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <StatusDot state={state} />
      </div>
      <div className="space-y-1.5 text-sm text-gray-600">{children}</div>
      {tip && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {tip}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

function HealthPage() {
  // The payload is always a fully-populated object: normalizeOrgHealth() fills in every
  // field, so a missing or renamed value can only ever render as "not checked" — it can
  // never throw and leave a customer looking at a blank page.
  const [health, setHealth] = useState(() => normalizeOrgHealth(null));
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testRunning, setTestRunning] = useState(false);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("receptionai_token");
      const res = await fetch("/api/health/org", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Health check failed (${res.status})`);
      const data = await res.json();
      setHealth(normalizeOrgHealth(data));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const runTest = async () => {
    setTestRunning(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("receptionai_token");
      const res = await fetch("/api/test-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json()) as TestResult;
      setTestResult(data);

      // Refresh health after a short delay for the call to register
      if (data.success) {
        setTimeout(() => fetchHealth(), 3000);
      }
    } catch {
      setTestResult({ success: false, error: "Network error — could not reach server" });
    } finally {
      setTestRunning(false);
    }
  };

  const h = health;
  const phone = h.phoneStatus;
  const hook = h.webhookStatus;
  const texting = h.texting;
  const call = h.lastCall;

  const formattedTime = h.checkedAt ? new Date(h.checkedAt).toLocaleTimeString() : "";

  // ── Loading (first paint only) ─────────────────────────────────────
  if (loading && !loaded && !error) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-sm text-gray-500">Checking system health...</span>
      </div>
    );
  }

  // ── Error, nothing to show ─────────────────────────────────────────
  if (error && !loaded) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="mt-1 text-sm text-gray-500">Check that your ReceptionAI system is working correctly.</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">Could not load health data.</p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
          <button
            onClick={fetchHealth}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── States ─────────────────────────────────────────────────────────
  const phoneState: "ok" | "warn" | "bad" = !phone.provisioned ? "bad" : phone.status === "inactive" ? "warn" : "ok";
  const callState: "ok" | "bad" = call.found ? "ok" : "bad";
  const hookState: "ok" | "warn" | "bad" | "unknown" =
    !hook.known ? "unknown" : hook.configured === true ? "ok" : hook.lastReceived ? "warn" : "bad";

  const issues = h.tips.length;
  const unknownCount = h.unknowns.length;

  const bannerState: "ok" | "warn" = h.allOk ? "ok" : "warn";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="mt-1 text-sm text-gray-500">
            Check that your ReceptionAI system is working correctly.
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Incomplete payload — shown instead of a blank page or a false green tick */}
      {h.missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Some checks did not come back from the server
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Missing: {h.missing.join(", ")}. Anything we could not read is shown as
            &ldquo;not checked&rdquo; below rather than as a green tick.
          </p>
        </div>
      )}

      {/* Overall Status Banner */}
      <div
        className={`rounded-xl p-5 ${
          bannerState === "ok"
            ? "border border-green-200 bg-green-50"
            : "border border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${bannerState === "ok" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {bannerState === "ok" ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </span>
          <div>
            <p className="font-semibold text-gray-900">
              {h.allOk ? "All systems operational" : "Some attention needed"}
            </p>
            <p className="text-sm text-gray-600">
              {!h.allOk
                ? `${issues} issue${issues === 1 ? "" : "s"} found.`
                : unknownCount > 0
                  ? `Everything we could check is healthy. ${unknownCount} check${unknownCount === 1 ? "" : "s"} could not be verified from our side.`
                  : "Your ReceptionAI system is working correctly."}
            </p>
          </div>
        </div>
      </div>

      {/* Status Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Phone Number */}
        <StatusCard
          title="Phone Number"
          state={phoneState}
          tip={
            phone.provisioned
              ? undefined
              : "No phone number is provisioned for this account. If you just subscribed, provisioning may still be running. Contact support if this persists."
          }
        >
          {phone.provisioned ? (
            <>
              <p>
                <StatusLabel
                  state={phone.status === "inactive" ? "warn" : "ok"}
                  text={phone.status === "inactive" ? "Inactive" : "Live"}
                />
              </p>
              <p className="font-mono text-xs">{phone.number || "Number not recorded"}</p>
              <div className="mt-1 flex gap-3 text-xs text-gray-400">
                <span>{phone.voiceEnabled ? "Voice ✓" : "Voice ✗"}</span>
                <span>{phone.smsEnabled ? "Text-capable number ✓" : "Text-capable number ✗"}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500">No phone number assigned to your account.</p>
          )}
        </StatusCard>

        {/* Last Call */}
        <StatusCard
          title="Last Call"
          state={callState}
          tip={
            call.found
              ? undefined
              : "No customer calls yet. Make sure you're forwarding calls to your ReceptionAI number. If you brought your own number, set up call forwarding with your carrier."
          }
        >
          {call.found ? (
            <>
              <p className="font-mono text-xs">{call.callerNumber || "Caller number unavailable"}</p>
              <p className="text-xs text-gray-400">
                {call.time ? new Date(call.time).toLocaleString() : "Time unavailable"}
                {call.duration != null && ` · ${call.duration}s`}
              </p>
              <p className="text-xs text-gray-500">Outcome: {call.outcome || "not recorded"}</p>
              {call.demoCallsExcluded > 0 && (
                <p className="text-xs text-gray-400">
                  {call.demoCallsExcluded} call{call.demoCallsExcluded === 1 ? "" : "s"} to the demo line not counted.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500">No calls from customers yet.</p>
          )}
        </StatusCard>

        {/* Webhook */}
        <StatusCard
          title="Webhook Connection"
          state={hookState}
          tip={
            hook.known && hook.configured === false
              ? "Our server isn't receiving call webhooks, so incoming calls won't be answered by the AI. Contact support and we'll re-attach the Telnyx connection."
              : undefined
          }
        >
          {!hook.known ? (
            <>
              <p>
                <StatusLabel state="unknown" text="Not checked" />
              </p>
              <p className="text-xs text-gray-400">
                We can't read this number's Telnyx voice configuration from here, so we're not
                claiming it is connected.
              </p>
              {hook.lastReceived && (
                <p className="text-xs text-gray-400">
                  Last call event received: {new Date(hook.lastReceived).toLocaleString()}
                  {hook.recent && <span className="ml-1 text-green-600">(recent)</span>}
                </p>
              )}
            </>
          ) : hook.configured ? (
            <>
              <p>
                <StatusLabel state="ok" text="Connected" />
              </p>
              {hook.lastReceived && (
                <p className="text-xs text-gray-400">
                  Last call event received: {new Date(hook.lastReceived).toLocaleString()}
                  {hook.recent && <span className="ml-1 text-green-600">(recent)</span>}
                </p>
              )}
            </>
          ) : (
            <>
              <p>
                <StatusLabel state="bad" text="Not connected" />
              </p>
              <p className="text-xs text-gray-400">Call events may not be reaching our server.</p>
            </>
          )}
        </StatusCard>

        {/* Schedule */}
        <StatusCard title="Schedule" state="ok">
          <p>
            <StatusLabel
              state="ok"
              text={`${h.scheduleStatus.upcoming} upcoming appointment${h.scheduleStatus.upcoming === 1 ? "" : "s"}`}
            />
          </p>
          <p className="text-xs text-gray-400">
            <a href="/dashboard/schedule" className="text-indigo-600 hover:underline">View full schedule →</a>
          </p>
        </StatusCard>

        {/* Text alerts — an optional add-on, off by default, and honest about delivery */}
        <StatusCard
          title="Text Alerts (optional add-on)"
          state={texting.addonEnabled ? (texting.delivering === true ? "ok" : "warn") : "unknown"}
        >
          {!texting.addonEnabled ? (
            <>
              <p>
                <StatusLabel state="unknown" text="Off" />
              </p>
              <p className="text-xs text-gray-400">
                Email notifications are on and free. Texting is a paid upgrade you can turn on
                in Settings → Notifications.
              </p>
            </>
          ) : texting.delivering === true ? (
            <>
              <p>
                <StatusLabel state="ok" text="On" />
              </p>
              <p className="text-xs text-gray-400">Texts are being delivered to your mobile.</p>
            </>
          ) : texting.delivering === false ? (
            <>
              <p>
                <StatusLabel state="warn" text="On — not delivering yet" />
              </p>
              <p className="text-xs text-gray-400">
                No text has been delivered yet while our sending number awaits carrier approval.
                Email is carrying every notification in the meantime.
              </p>
            </>
          ) : (
            <>
              <p>
                <StatusLabel state="warn" text="On — delivery not checked" />
              </p>
              <p className="text-xs text-gray-400">
                We couldn't read the delivery records just now. Email is carrying every
                notification either way.
              </p>
            </>
          )}
        </StatusCard>
      </div>

      {/* Test Call */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Test Your Setup</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Make a test call to verify your phone system is working end-to-end.
            </p>
          </div>
          <button
            onClick={runTest}
            disabled={testRunning || !phone.provisioned}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testRunning ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Calling...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Run Test Call
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              testResult.success
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <p className="font-medium">
              {testResult.success ? "✅ Test call initiated!" : "❌ Test call failed"}
            </p>
            <p className="mt-1 text-xs opacity-80">
              {testResult.success
                ? `${testResult.message}`
                : testResult.error || testResult.tip || "Unknown error"}
            </p>
            {testResult.callControlId && (
              <p className="mt-1 font-mono text-[10px] opacity-60">
                Call ID: {testResult.callControlId}
              </p>
            )}
          </div>
        )}

        {!phone.provisioned && (
          <p className="mt-3 text-xs text-gray-400">
            You need a phone number to run a test call. Provision one first.
          </p>
        )}
      </div>

      {/* Troubleshooting */}
      {h.tips.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Troubleshooting Tips
          </h3>
          <ul className="mt-3 space-y-2">
            {h.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-0.5 flex-shrink-0 select-none text-xs">→</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timestamp */}
      {formattedTime && (
        <p className="text-center text-xs text-gray-400">
          Last checked at {formattedTime}
        </p>
      )}
    </div>
  );
}
