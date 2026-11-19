import { createFileRoute, Link } from "@tanstack/react-router";
import { t, useLocale } from "~/lib/i18n";
import { PUBLIC_LINE } from "~/lib/public-config";

export const Route = createFileRoute("/_marketing/faq")({
  component: FaqPage,
});

/**
 * The nine answers, in order. Each one is a fact about the product as it ships today:
 * we do not provision a number per customer, texting is off until the carriers verify the
 * number, and a cancel button that ends billing by itself does not exist yet. When one of
 * those changes, this list changes with it.
 */
const ANSWERS: Array<{ q: string; a: string }> = [
  { q: "faq.n1.q", a: "faq.n1.a" },
  { q: "faq.n2.q", a: "faq.n2.a" },
  { q: "faq.n3.q", a: "faq.n3.a" },
  { q: "faq.n4.q", a: "faq.n4.a" },
  { q: "faq.n5.q", a: "faq.n5.a" },
  { q: "faq.n6.q", a: "faq.n6.a" },
  { q: "faq.n7.q", a: "faq.n7.a" },
  { q: "faq.n8.q", a: "faq.n8.a" },
  { q: "faq.n9.q", a: "faq.n9.a" },
];

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
            {t("faq.hero.title2")}
          </h1>
          <p className="mt-4 text-lg text-gray-600">{t("faq.hero.subtitle2")}</p>
        </div>
      </section>

      {/* The nine answers */}
      <section id="faq" className="px-4 pb-8 pt-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {ANSWERS.map((item, i) => (
            <details key={item.q} className="group rounded-xl border border-gray-200 bg-white">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left text-sm font-semibold text-gray-900 transition-colors hover:text-indigo-600">
                <span>
                  <span className="mr-2 text-gray-400">{i + 1}.</span>
                  {t(item.q)}
                </span>
                <svg
                  className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-4 text-sm leading-relaxed text-gray-600">{t(item.a)}</div>
            </details>
          ))}
        </div>
      </section>

      {/* Test it yourself */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
          <p className="text-sm font-semibold text-indigo-900">{t("faq.selfserve.testLink")}</p>
          <a
            href={PUBLIC_LINE.tel}
            className="mt-2 inline-block text-2xl font-bold tracking-wide text-indigo-700 hover:text-indigo-600"
          >
            {PUBLIC_LINE.display}
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">{t("faq.cta.title")}</h2>
          <p className="mt-3 text-lg text-indigo-100">{t("faq.cta.subtitle")}</p>
          <div className="mt-8">
            <Link
              to="/signup"
              className="inline-block rounded-xl bg-white px-8 py-3 text-base font-semibold text-indigo-600 shadow-lg transition hover:bg-indigo-50"
            >
              {t("faq.cta.button")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
