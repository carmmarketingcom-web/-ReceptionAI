import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { t } from "~/lib/i18n";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            R
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            Reception<span className="text-indigo-600">AI</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            to="/features"
            className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
            activeProps={{ className: "text-indigo-600 font-medium" }}
          >
            {t("nav.features")}
          </Link>
          <Link
            to="/pricing"
            className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
            activeProps={{ className: "text-indigo-600 font-medium" }}
          >
            {t("nav.pricing")}
          </Link>
          <Link
            to="/demo"
            className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
            activeProps={{ className: "text-indigo-600 font-medium" }}
          >
            {t("nav.demo")}
          </Link>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
          >
            {t("nav.login")}
          </Link>
          <Link
            to="/demo"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            {t("nav.getStarted")}
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <div className="space-y-1 px-4 py-4">
            <Link
              to="/"
              className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              {t("nav.home")}
            </Link>
            <Link
              to="/features"
              className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              {t("nav.features")}
            </Link>
            <Link
              to="/pricing"
              className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              {t("nav.pricing")}
            </Link>
            <Link
              to="/demo"
              className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              {t("nav.demo")}
            </Link>
            <div className="border-t border-gray-100 pt-3">
              <Link
                to="/login"
                className="block rounded-lg px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                {t("nav.login")}
              </Link>
              <Link
                to="/demo"
                className="mt-2 block rounded-lg bg-indigo-600 px-3 py-2 text-center text-base font-medium text-white hover:bg-indigo-700"
                onClick={() => setMobileOpen(false)}
              >
                {t("nav.getStarted")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}