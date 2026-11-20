import { createFileRoute } from "@tanstack/react-router";
import Header from "~/components/Header";
import Footer from "~/components/Footer";
import { LocaleProvider, t, useLocale } from "~/lib/i18n";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LocaleProvider>
      <PrivacyContent />
    </LocaleProvider>
  );
}

function PrivacyContent() {
  useLocale();
  return (
    /* The body is translated for Spanish readers; the English text is the
       governing version, and the page says so under the date. */
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1 bg-white px-4 py-20">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">{t("Privacy Policy")}</h1>
          <p className="text-sm text-gray-500">{t("Last updated: July 2026")}</p>
          <p className="text-sm font-medium text-gray-700">{t("The English version of this page governs.")}</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">{t("1. Information We Collect")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("We collect information you provide when signing up: company name, email address, phone number, and payment information (processed securely by Stripe — we do not store full credit card details). We also collect call data including recordings, transcriptions, and message content to provide and improve the Service.")}</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">{t("2. How We Use Your Information")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("We use your information to: provide the Service, process payments, communicate with you about your account, improve our AI systems, and comply with legal obligations. Call data is used to train and improve our AI models.")}</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">{t("3. Data Sharing")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("We share data with third-party service providers only as necessary to operate the Service: Stripe (payments), Telnyx (telecommunications), Neon (database hosting), and AI model providers. We do not sell your data.")}</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">{t("4. Data Retention")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("Call recordings and transcriptions are retained for the duration of your account plus 90 days after termination. You may request deletion of your data by contacting us.")}</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">{t("5. Security")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("We use industry-standard encryption and security practices. However, no method of electronic storage is 100% secure.")}</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">{t("6. Your Rights")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("You have the right to access, correct, or delete your personal data. Contact us to exercise these rights.")}</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">{t("7. Text Messaging (SMS)")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("We send text messages only to people who asked for them. A business owner opts in by ticking the consent box during setup, or by asking us to enable text alerts; that box is unchecked by default and choosing email instead leaves the account fully working. A customer of that business gets an appointment confirmation or reminder only at the number they gave when they booked. Every message is transactional — a call alert, an appointment confirmation or a reminder — never marketing. Message frequency varies. Message and data rates may apply. Reply STOP to any message to opt out, or HELP for help. Consent to receive texts is not a condition of purchase. We do not sell, rent, or share mobile phone numbers or SMS opt-in data with third parties or affiliates for marketing or promotional purposes.")}</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">{t("8. Contact")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("For privacy questions, contact us through our website.")}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
