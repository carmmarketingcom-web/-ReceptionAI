import { Link, useRouterState } from "@tanstack/react-router";
import { t, useLocale } from "~/lib/i18n";

/**
 * Only these pages have a translated body today. Everywhere else the page is
 * English-only, so showing the globe there would promise a Spanish version
 * that does not exist. The nav and footer keep using the stored locale.
 */
const TRANSLATED_PATHS = new Set(["/", "/pricing", "/faq"]);

export default function Header() {
  const { locale, setLocale } = useLocale();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const showLocaleToggle = TRANSLATED_PATHS.has(normalizedPath);
  const toggleLocale = () => setLocale(locale === "en" ? "es" : "en");

  return (
    <header className="sticky top-0 z-[60] border-b border-gray-100 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src="/images/logo.png" alt="ReceptionAI" className="h-12 w-auto sm:h-14" width={800} height={450} />
          <span className="hidden text-xs font-medium text-gray-400 md:inline-block border-l border-gray-200 pl-3">
            {t("header.tagline")}
          </span>
        </Link>

        <nav className="hidden items-center gap-5 md:flex lg:gap-7">
          <Link to="/features" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>{t("nav.features")}</Link>
          <Link to="/book" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">{t("nav.book")}</Link>
          <Link to="/pricing" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>{t("nav.pricing")}</Link>
          <Link to="/demo" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>{t("nav.demo")}</Link>
          <Link to="/faq" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>{t("nav.faq")}</Link>
          <Link to="/about" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>About</Link>
          <Link to="/contact" className="text-sm font-medium text-gray-600 transition hover:text-gray-900" activeProps={{ className: "text-indigo-600 font-medium" }}>Contact</Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {showLocaleToggle && (
            <button
              type="button"
              onClick={toggleLocale}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:border-indigo-300 hover:text-indigo-600"
              aria-label={t("lang.switchTo")}
              title={t("lang.switchTo")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {locale === "en" ? t("lang.label.es") : t("lang.label.en")}
            </button>
          )}
          <Link to="/login" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">{t("nav.login")}</Link>
          <Link to="/signup" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">{t("nav.signup")}</Link>
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
              <Link to="/faq" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.faq")}</Link>
              <Link to="/about" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>About</Link>
              <Link to="/contact" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>Contact</Link>
              <Link to="/book" className="block rounded-lg bg-indigo-600 px-3 py-2 text-center text-base font-medium text-white hover:bg-indigo-700" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.book")}</Link>
              <div className="border-t border-gray-100 pt-3">
                <Link to="/login" className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.login")}</Link>
                <Link to="/signup" className="mt-2 block rounded-lg bg-indigo-600 px-3 py-2 text-center text-base font-medium text-white hover:bg-indigo-700" onClick={() => (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open")}>{t("nav.getStarted")}</Link>
                {showLocaleToggle && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleLocale();
                      (document.getElementById("mobile-menu-details") as HTMLDetailsElement)?.removeAttribute("open");
                    }}
                    className="mt-2 block w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-base font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {locale === "en" ? t("lang.label.es") : t("lang.label.en")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
