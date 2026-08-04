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
              <img
                src="/images/logo.png"
                alt="ReceptionAI"
                className="h-7 w-auto"
                width={800}
                height={450}
              />
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
                <a href="/privacy" className="text-sm text-gray-500 transition hover:text-gray-900">
                  {t("footer.privacy")}
                </a>
              </li>
              <li>
                <a href="/terms" className="text-sm text-gray-500 transition hover:text-gray-900">
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
                <a href="mailto:hello@receptionai.store" className="text-sm text-gray-500 transition hover:text-gray-900">
                  hello@receptionai.store
                </a>
              </li>
              <li>
                <a href="tel:+17279667556" className="text-sm text-gray-500 transition hover:text-gray-900">
                  (727) 966-7556
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