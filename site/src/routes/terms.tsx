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
        <div className="mx-auto max-w-3xl prose prose-gray">
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-500">Last updated: July 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>By using ReceptionAI ("the Service"), you agree to these Terms. If you do not agree, do not use the Service.</p>

          <h2>2. Service Description</h2>
          <p>ReceptionAI provides an AI-powered virtual receptionist that answers phone calls, text messages, and web chats. The Service uses artificial intelligence and automated systems to respond to inquiries, schedule appointments, and route calls.</p>

          <h2>3. No Guarantee of Availability</h2>
          <p>The Service is provided on an <strong>"AS IS" and "AS AVAILABLE"</strong> basis. We do not guarantee uninterrupted access, error-free operation, or that the Service will meet all your requirements. The Service may be unavailable due to maintenance, third-party service outages (including but not limited to telecommunications carriers, cloud providers, and AI model providers), or circumstances beyond our control.</p>

          <h2>4. Limitation of Liability</h2>
          <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong></p>
          <ul>
            <li>ReceptionAI and its owners, employees, and affiliates shall NOT be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to lost profits, lost revenue, lost business opportunities, missed appointments, missed calls, customer dissatisfaction, or any other commercial or economic loss arising from or relating to the use or inability to use the Service.</li>
            <li>Our total aggregate liability for any claims arising from the Service shall not exceed the amount paid by you for the Service in the twelve (12) months preceding the claim.</li>
            <li>We are NOT responsible for: misrouted calls, dropped calls, transcription errors, AI misinterpretation of caller intent, missed appointments due to system errors, calendar sync failures, or any other technical malfunction.</li>
          </ul>

          <h2>4a. No Liability</h2>
          <p>ReceptionAI is an AI service. We are not liable for missed calls, lost bookings, AI errors, or service interruptions. We will do our best to help, but we guarantee nothing. Use at your own risk.</p>

          <h2>5. AI Limitations</h2>
          <p>You acknowledge that the Service uses artificial intelligence which may produce inaccurate, incomplete, or inappropriate responses. The AI is not a substitute for human judgment, professional advice, or emergency services. <strong>You are responsible for reviewing AI interactions and maintaining appropriate human oversight of critical business functions.</strong></p>

          <h2>6. Third-Party Services</h2>
          <p>The Service relies on third-party providers including telecommunications carriers, cloud hosting services, and AI model providers. We are not responsible for failures, outages, or policy changes by these third parties.</p>

          <h2>7. Customer Responsibilities</h2>
          <p>You are responsible for: (a) maintaining accurate business information and settings, (b) providing a valid phone number for call transfers, (c) testing the Service regularly to ensure proper operation, (d) complying with all applicable laws regarding call recording and customer communications.</p>

          <h2>8. Call Recording and Privacy</h2>
          <p>The Service may record and transcribe calls for quality and training purposes. You are responsible for providing required disclosures to your callers regarding call recording, as required by applicable laws in your jurisdiction.</p>

          <h2>9. Termination</h2>
          <p>We reserve the right to suspend or terminate your access to the Service at any time for violation of these Terms or for any other reason at our sole discretion. Upon termination, your phone number(s) may be released.</p>

          <h2>10. Indemnification</h2>
          <p>You agree to indemnify and hold harmless ReceptionAI, its owners, and affiliates from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights or applicable laws.</p>

          <h2>11. Changes to Terms</h2>
          <p>We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>

          <h2>12. Governing Law</h2>
          <p>These Terms are governed by the laws of the State of Florida, without regard to conflict of law principles.</p>

          <h2>13. Contact</h2>
          <p>For questions about these Terms, contact us through our website.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
