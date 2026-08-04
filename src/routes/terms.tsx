import { createFileRoute } from "@tanstack/react-router";
import Header from "~/components/Header";
import Footer from "~/components/Footer";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1 bg-white px-4 py-20">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-500">Last updated: July 2026</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
          <p className="text-gray-700 leading-relaxed">By using ReceptionAI ("the Service"), you agree to these Terms. If you do not agree, do not use the Service.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">2. Service Description</h2>
          <p className="text-gray-700 leading-relaxed">ReceptionAI provides an AI-powered virtual receptionist that answers phone calls, text messages, and web chats. The Service uses artificial intelligence and automated systems to respond to inquiries, schedule appointments, and route calls.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">3. No Guarantee of Availability</h2>
          <p className="text-gray-700 leading-relaxed">The Service is provided on an <strong>"AS IS" and "AS AVAILABLE"</strong> basis. We do not guarantee uninterrupted access, error-free operation, or that the Service will meet all your requirements. The Service may be unavailable due to maintenance, third-party service outages (including but not limited to telecommunications carriers, cloud providers, and AI model providers), or circumstances beyond our control.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">4. Limitation of Liability</h2>
          <p className="text-gray-700 leading-relaxed"><strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong></p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700 leading-relaxed">
            <li>ReceptionAI and its owners, employees, and affiliates shall NOT be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to lost profits, lost revenue, lost business opportunities, missed appointments, missed calls, customer dissatisfaction, or any other commercial or economic loss arising from or relating to the use or inability to use the Service.</li>
            <li>Our total aggregate liability for any claims arising from the Service shall not exceed the amount paid by you for the Service in the twelve (12) months preceding the claim.</li>
            <li>We are NOT responsible for: misrouted calls, dropped calls, transcription errors, AI misinterpretation of caller intent, missed appointments due to system errors, calendar sync failures, or any other technical malfunction.</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">4a. No Liability</h2>
          <p className="text-gray-700 leading-relaxed">ReceptionAI is an AI service. We are not liable for missed calls, lost bookings, AI errors, or service interruptions. We will do our best to help, but we guarantee nothing. Use at your own risk.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">5. AI Limitations</h2>
          <p className="text-gray-700 leading-relaxed">You acknowledge that the Service uses artificial intelligence which may produce inaccurate, incomplete, or inappropriate responses. The AI is not a substitute for human judgment, professional advice, or emergency services. <strong>You are responsible for reviewing AI interactions and maintaining appropriate human oversight of critical business functions.</strong></p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">6. Third-Party Services</h2>
          <p className="text-gray-700 leading-relaxed">The Service relies on third-party providers including telecommunications carriers, cloud hosting services, and AI model providers. We are not responsible for failures, outages, or policy changes by these third parties.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">7. Customer Responsibilities</h2>
          <p className="text-gray-700 leading-relaxed">You are responsible for: (a) maintaining accurate business information and settings, (b) providing a valid phone number for call transfers, (c) testing the Service regularly to ensure proper operation, (d) complying with all applicable laws regarding call recording and customer communications.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">8. Call Recording and Privacy</h2>
          <p className="text-gray-700 leading-relaxed">The Service may record and transcribe calls for quality and training purposes. You are responsible for providing required disclosures to your callers regarding call recording, as required by applicable laws in your jurisdiction.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">9. Termination</h2>
          <p className="text-gray-700 leading-relaxed">We reserve the right to suspend or terminate your access to the Service at any time for violation of these Terms or for any other reason at our sole discretion. Upon termination, your phone number(s) may be released.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">10. Indemnification</h2>
          <p className="text-gray-700 leading-relaxed">You agree to indemnify and hold harmless ReceptionAI, its owners, and affiliates from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights or applicable laws.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">11. Changes to Terms</h2>
          <p className="text-gray-700 leading-relaxed">We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">12. Governing Law</h2>
          <p className="text-gray-700 leading-relaxed">These Terms are governed by the laws of the State of Florida, without regard to conflict of law principles.</p>

          <h2 className="mt-8 text-xl font-semibold text-gray-900">13. Contact</h2>
          <p className="text-gray-700 leading-relaxed">For questions about these Terms, contact us through our website.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
