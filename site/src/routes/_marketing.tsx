import { Outlet, createFileRoute } from "@tanstack/react-router";
import Header from "~/components/Header";
import Footer from "~/components/Footer";
import ChatWidgetPreview from "~/components/ChatWidgetPreview";
import { LocaleProvider } from "~/lib/i18n";

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <LocaleProvider>
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        {/* Floating chat widget: kept inside the viewport on phones (right/bottom insets +
            a max width) and below the sticky header, so it never sits on a section heading. */}
        <div className="fixed bottom-4 right-3 z-50 max-w-[calc(100vw-1.5rem)] sm:bottom-6 sm:right-6">
          <ChatWidgetPreview />
        </div>
      </div>
    </LocaleProvider>
  );
}