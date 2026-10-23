import { createFileRoute, Link } from "@tanstack/react-router";
import { t } from "~/lib/i18n";

export const Route = createFileRoute("/_marketing/pricing")({
  component: PricingPage,
});

const tiers = [
  {
    name: "Starter",
    price: "$99",
    descriptionKey: "pricing.starter.desc",
    featureKeys: [
      "pricing.starter.feature1",
      "pricing.starter.feature2",
      "pricing.starter.feature3",
      "pricing.starter.feature4",
      "pricing.starter.feature5",
      "pricing.starter.feature6",
    ],
    popular: false,
    stripePaymentLink: "https://buy.stripe.com/6oU5kD6rW2C52Fd1D3aVa02",
    stripePriceId: "price_1TtXMGDqebBmBAbi165hKXK9",
  },
  {
    name: "Growth",
    price: "$199",
    descriptionKey: "pricing.growth.desc",
    featureKeys: [
      "pricing.growth.feature1",
      "pricing.growth.feature2",
      "pricing.growth.feature3",
      "pricing.growth.feature4",
      "pricing.growth.feature5",
      "pricing.growth.feature6",
    ],
    popular: true,
    stripePaymentLink: "https://buy.stripe.com/eVq14ng2w90tfrZ4PfaVa03",
    stripePriceId: "price_1TtXMGDqebBmBAbiqd7ybQzy",
  },
  {
    name: "Scale",
    price: "$399",
    descriptionKey: "pricing.scale.desc",
    featureKeys: [
      "pricing.scale.feature1",
      "pricing.scale.feature2",
      "pricing.scale.feature3",
      "pricing.scale.feature4",
      "pricing.scale.feature5",
      "pricing.scale.feature6",
    ],
    popular: false,
    stripePaymentLink: "https://buy.stripe.com/14AaEX03ygsVbbJchHaVa04",
    stripePriceId: "price_1TtXMGDqebBmBAbidd4SJgki",
  },
];

const addOns = [
  { nameKey: "pricing.addon1.name", priceKey: "pricing.addon1.price" },
  { nameKey: "pricing.addon2.name", priceKey: "pricing.addon2.price" },
  { nameKey: "pricing.addon3.name", priceKey: "pricing.addon3.price" },
  { nameKey: "pricing.addon4.name", priceKey: "pricing.addon4.price" },
];

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white via-indigo-50/30 to-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            {t("pricing.badge")}
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {t("pricing.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            {t("pricing.subtitle")}
          </p>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="bg-white pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  tier.popular
                    ? "border-indigo-200 bg-white shadow-xl shadow-indigo-100 ring-1 ring-indigo-500"
                    : "border-gray-200 bg-white shadow-sm"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-indigo-600 px-4 py-1 text-sm font-semibold text-white">
                      {t("pricing.popular")}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900">{tier.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{t(tier.descriptionKey)}</p>
                </div>

                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900">{tier.price}</span>
                  <span className="text-base text-gray-500">{t("pricing.perMonth")}</span>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {tier.featureKeys.map((key) => (
                    <li key={key} className="flex items-start gap-3 text-sm text-gray-600">
                      <svg
                        className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {t(key)}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/signup"
                  className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-center text-sm font-semibold transition ${
                    tier.popular
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t("pricing.cta")}
                  <svg
                    className="ml-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </Link>
              </div>
            ))}
          </div>

          {/* Why Scale costs more */}
          <div className="mt-12 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70 p-8 sm:p-10">
            <h3 className="text-center text-xl font-bold text-gray-900">
              {t("pricing.scaleBlock.title")}
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-gray-500">
              {t("pricing.scaleBlock.subtitle")}
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wide text-indigo-700">{t("pricing.scaleBlock.capacity")}</h4>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {t("pricing.scaleBlock.capacityDesc")}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wide text-indigo-700">{t("pricing.scaleBlock.customization")}</h4>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {t("pricing.scaleBlock.customizationDesc")}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wide text-indigo-700">{t("pricing.scaleBlock.service")}</h4>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {t("pricing.scaleBlock.serviceDesc")}
                </p>
              </div>
            </div>
          </div>

          {/* Billing note */}
          <p className="mt-8 text-center text-sm text-gray-500">
            {t("pricing.billingNote")}
          </p>
        </div>
      </section>

      {/* Add-ons */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-gray-900">{t("pricing.addons.title")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
            {t("pricing.addons.subtitle")}
          </p>
          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {addOns.map((addon) => (
              <div
                key={addon.nameKey}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4"
              >
                <span className="text-sm font-medium text-gray-900">{t(addon.nameKey)}</span>
                <span className="text-sm font-semibold text-indigo-600">{t(addon.priceKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-gray-900">{t("pricing.faq.title")}</h2>
          <div className="mt-8 space-y-6">
            {[
              { q: "pricing.faq1.q", a: "pricing.faq1.a" },
              { q: "pricing.faq2.q", a: "pricing.faq2.a" },
              { q: "pricing.faq3.q", a: "pricing.faq3.a" },
              { q: "faq.number.q", a: "faq.number.a" },
              { q: "faq.forward.q", a: "faq.forward.a" },
              { q: "pricing.faq4.q", a: "pricing.faq4.a" },
            ].map((faq) => (
              <div key={faq.q} className="rounded-xl border border-gray-100 bg-white p-6">
                <h3 className="font-semibold text-gray-900">{t(faq.q)}</h3>
                <p className="mt-2 text-sm text-gray-600">{t(faq.a)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">{t("pricing.cta.title")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
            {t("pricing.cta.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-600 transition hover:bg-indigo-50"
            >
              {t("pricing.cta")}
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-400 bg-transparent px-8 py-4 text-base font-semibold text-white transition hover:bg-indigo-500/20"
            >
              {t("pricing.cta.secondary")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
