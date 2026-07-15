import { Link } from "@tanstack/react-router";
import { t } from "~/lib/i18n";

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                R
              </div>
              <span className="text-base font-bold tracking-tight text-gray-900">
                Reception<span className="text-indigo-600">AI</span>
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t("footer.product")}</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/features" className="text-sm text-gray-500 transition hover:text-gray-900">
                  {t("nav.features")}
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-sm text-gray-500 transition hover:text-gray-900">
                  {t("nav.pricing")}
                </Link>
              </li>
              <li>
                <Link to="/demo" className="text-sm text-gray-500 transition hover:text-gray-900">
                  {t("nav.demo")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t("footer.company")}</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="#" className="text-sm text-gray-500 transition hover:text-gray-900">
                  {t("footer.privacy")}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition hover:text-gray-900">
                  {t("footer.terms")}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition hover:text-gray-900">
                  {t("footer.contact")}
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t("footer.support")}</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="mailto:hello@receptionai.com" className="text-sm text-gray-500 transition hover:text-gray-900">
                  hello@receptionai.com
                </a>
              </li>
              <li>
                <a href="tel:+18885551234" className="text-sm text-gray-500 transition hover:text-gray-900">
                  1-888-555-1234
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6 text-center text-sm text-gray-400">
          {t("footer.copyright")}
        </div>
      </div>
    </footer>
  );
}