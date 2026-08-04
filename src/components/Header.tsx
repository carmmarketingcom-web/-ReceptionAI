import { Link } from "@tanstack/react-router";
import { t } from "~/lib/i18n";

export default function Header() {
  return (
    <header className="sticky top-0 z-[60] border-b border-gray-100 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src="/images/logo.png" alt="ReceptionAI" className="h-12 w-auto sm:h-14" width={800} height={450} />
          <span className="hidden text-xs font-medium text-gray-400 md:inline-block border-l border-gray-200 pl-3">
            Never Miss a Call.<br />Never Miss a Customer.
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link to="/features" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>{t("nav.features")}</Link>
          <Link to="/book" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">Book Now</Link>
          <Link to="/pricing" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>{t("nav.pricing")}</Link>
          <Link to="/demo" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>{t("nav.demo")}</Link>
          <Link to="/faq" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>FAQ</Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/login" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">{t("nav.login")}</Link>
          <Link to="/signup" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">Sign Up</Link>
          <Link to="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">{t("nav.getStarted")}</Link>
        </div>

        {/* Mobile menu: pure HTML <details> — zero JavaScript required */}
        <details className="group md:hidden" id="mobile-menu-details">
          <summary className="relative z-10 inline-flex cursor-pointer list-none items-center justify-center rounded-md p-3 text-gray-600 hover:bg-gray-100"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
            <svg className="h-6 w-6 group-open:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg className="hidden h-6 w-6 group-open:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </summary>
          <div className="absolute left-0 right-0 top-full z-50 border-t border-gray-100 bg-white shadow-lg">
            <div className="space-y-1 px-4 py-4">
              <Link to="/" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.home")}</Link>
              <Link to="/features" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.features")}</Link>
              <Link to="/pricing" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.pricing")}</Link>
              <Link to="/demo" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.demo")}</Link>
              <Link to="/faq" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>FAQ</Link>
              <Link to="/book" className="block rounded-lg bg-indigo-600 px-3 py-2 text-center text-base font-medium text-white hover:bg-indigo-700" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>Book Now</Link>
              <div className="border-t border-gray-100 pt-3">
                <Link to="/login" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.login")}</Link>
                <Link to="/signup" className="mt-2 block rounded-lg bg-indigo-600 px-3 py-2 text-center text-base font-medium text-white hover:bg-indigo-700" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.getStarted")}</Link>
              </div>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
