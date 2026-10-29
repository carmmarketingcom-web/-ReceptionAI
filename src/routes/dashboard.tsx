import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getToken } from "~/lib/auth";
import { useSettings, useSubscription } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const navItems = [
  {
    section: "Main",
    items: [
      { label: "Overview", icon: "📊", href: "/dashboard" },
      { label: "Conversations", icon: "💬", href: "/dashboard/conversations" },
      { label: "Schedule", icon: "📅", href: "/dashboard/schedule" },
      { label: "Getting Started", icon: "📖", href: "/getting-started" },
    ],
  },
  {
    section: "Management",
    items: [
      { label: "Customers", icon: "👥", href: "/dashboard/customers" },
      { label: "Team", icon: "👤", href: "/dashboard/team" },
      { label: "Recordings", icon: "🎙️", href: "/dashboard/recordings" },
      { label: "Chat Widget", icon: "💬", href: "/dashboard/widget" },
    ],
  },
  {
    section: "Insights",
    items: [
      { label: "Analytics", icon: "📈", href: "/dashboard/analytics" },
      { label: "Missed Calls", icon: "❌", href: "/dashboard/missed" },
      { label: "Campaigns", icon: "📧", href: "/dashboard/campaigns" },
    ],
  },
  {
    section: "Settings",
    items: [
      { label: "Settings", icon: "⚙️", href: "/dashboard/settings" },
      { label: "Billing", icon: "💳", href: "/dashboard/billing" },
    ],
  },
];

function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Auth guard: the dashboard renders nothing until we know there is a session. Without a
  // token there is no org to show, so send the visitor to the login page instead of
  // rendering an empty shell that looks like somebody else's account.
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      window.location.replace("/login");
      return;
    }
    setHasSession(true);
  }, []);

  // Real business identity for the header. The org name comes from /api/settings (the same
  // org-scoped row the Settings page edits); the plan comes from /api/billing. If either is
  // unknown we render nothing rather than inventing "Demo Business" / "Growth Plan".
  const { data: settings } = useSettings();
  const { data: billing } = useSubscription();
  const orgName = (settings?.organization?.name || "").trim();
  const planName = (billing?.subscription?.planName || "").trim();
  const initials =
    orgName
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "";

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Until the owner's mobile is set, press-3 transfer and every owner text have nowhere to go.
  // The banner follows them across the dashboard and disappears the moment the number is saved.
  const needsOwnerMobile = !!settings?.organization && !(settings.organization.phone || "").trim();

  if (!hasSession) return null;

  return (
    <div className="flex min-h-dvh bg-gray-50">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeMobileMenu} />
          <div className="absolute inset-y-0 left-0 w-64 animate-[slideIn_0.2s_ease-out] bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-gray-100 px-6">
              <div className="flex items-center gap-2">
                <img src="/images/logo.png" alt="ReceptionAI" className="h-10 w-auto" width={800} height={450} />
              </div>
              <button onClick={closeMobileMenu} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <nav className="p-4">
              {navItems.map((group) => (
                <div key={group.section} className="mb-6">
                  <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{group.section}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={closeMobileMenu}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                        activeProps={{ className: "bg-indigo-50 text-indigo-700 font-semibold" }}
                      >
                        <span className="text-base">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white md:block">
        <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-6">
          <img src="/images/logo.png" alt="ReceptionAI" className="h-10 w-auto" width={800} height={450} />
        </div>

        <nav className="p-4">
          {navItems.map((group) => (
            <div key={group.section} className="mb-6">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {group.section}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                    activeProps={{
                      className: "bg-indigo-50 text-indigo-700 font-semibold",
                    }}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="absolute bottom-0 w-64 border-t border-gray-100 p-4">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Site
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <img src="/images/logo.png" alt="ReceptionAI" className="h-10 w-auto" width={800} height={450} />
          </div>

          <div className="flex-1" />

          {/* Mobile nav — hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* User avatar — the signed-in business, from its own org record */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              {orgName && <p className="text-sm font-medium text-gray-900">{orgName}</p>}
              {planName && <p className="text-xs text-gray-500">{planName}</p>}
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
              {initials || (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {needsOwnerMobile && (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Add your mobile number</span> — so missed-call alerts,
                call summaries and "press 3" transfers actually reach you.
              </p>
              <Link
                to="/setup"
                className="inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Add it now
              </Link>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}