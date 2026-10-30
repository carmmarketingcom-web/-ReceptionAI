import { createFileRoute, Link } from "@tanstack/react-router";
import { t, useLocale } from "~/lib/i18n";

export const Route = createFileRoute("/_marketing/faq")({
  component: FaqPage,
});

function FaqPage() {
  // Subscribe to the locale context: t() reads a module-level value, so without
  // this the page keeps rendering English after the visitor flips the toggle.
  useLocale();
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {t("faq.hero.title")}
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            {t("faq.hero.subtitle")}
          </p>
        </div>
      </section>

      {/* Signup SOP */}
      <section id="signup" className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">1</span>
            <h2 className="text-2xl font-bold text-gray-900">{t("faq.signup.title")}</h2>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">{t("faq.signup.stepsTitle")}</h3>
              <ol className="list-decimal ml-5 space-y-3 text-sm">
                <li>{t("faq.signup.step1")}</li>
                <li>{t("faq.signup.step2")}</li>
                <li>{t("faq.signup.step3")}</li>
                <li>{t("faq.signup.step4")}</li>
                <li>{t("faq.signup.step5")}</li>
                <li>{t("faq.signup.step6")}</li>
                <li>{t("faq.signup.step7")}</li>
                <li>{t("faq.signup.step8")}</li>
              </ol>
            </div>

            {/* Screenshot */}
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-lg">
              <img
                src="/signup-screenshot.png"
                alt="Signup page screenshot showing form fields and plan selector"
                className="w-full"
              />
              <p className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
                {t("faq.signup.caption")}
              </p>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
              <p className="text-sm text-indigo-800">
                <strong>💡 {t("faq.signup.founderNote")}</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Login SOP */}
      <section id="login" className="bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">2</span>
            <h2 className="text-2xl font-bold text-gray-900">{t("faq.login.title")}</h2>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-3">{t("faq.signup.stepsTitle")}</h3>
              <ol className="list-decimal ml-5 space-y-3 text-sm">
                <li>{t("faq.login.step1")}</li>
                <li>{t("faq.login.step2")}</li>
                <li>{t("faq.login.step3")}</li>
                <li>{t("faq.login.step4")}</li>
              </ol>
            </div>

            {/* Screenshot */}
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-lg">
              <img
                src="/login-screenshot.png"
                alt="Login page screenshot showing email and password fields"
                className="w-full"
              />
              <p className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
                {t("faq.login.caption")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">{t("faq.list.title")}</h2>

          <div className="space-y-4">
            {[
              { q: "faq.list.q1", a: "faq.list.a1" },
              { q: "faq.list.q2", a: "faq.list.a2" },
              { q: "faq.number.q", a: "faq.number.a" },
              { q: "faq.forward.q", a: "faq.forward.a" },
              { q: "faq.list.q3", a: "faq.list.a3" },
              { q: "faq.list.q4", a: "faq.list.a4" },
              { q: "faq.list.q5", a: "faq.list.a5" },
              { q: "faq.list.q6", a: "faq.list.a6" },
              { q: "faq.list.q7", a: "faq.list.a7" },
              { q: "faq.list.q8", a: "faq.list.a8" },
              { q: "faq.list.q9", a: "faq.list.a9" },
            ].map((item, i) => (
              <details key={i} className="group rounded-xl border border-gray-200 bg-white">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
                  {t(item.q)}
                  <svg className="h-5 w-5 shrink-0 text-gray-400 group-open:rotate-180 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </summary>
                <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{t(item.a)}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">{t("faq.cta.title")}</h2>
          <p className="mt-3 text-lg text-indigo-100">
            {t("faq.cta.subtitle")}
          </p>
          <div className="mt-8">
            <Link
              to="/signup"
              className="inline-block rounded-xl bg-white px-8 py-3 text-base font-semibold text-indigo-600 shadow-lg hover:bg-indigo-50 transition"
            >
              {t("faq.cta.button")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
