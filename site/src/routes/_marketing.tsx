import { Outlet, createFileRoute } from "@tanstack/react-router";
import Header from "~/components/Header";
import Footer from "~/components/Footer";
import ChatWidgetPreview from "~/components/ChatWidgetPreview";

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <div className="fixed bottom-6 right-6 z-50">
        <ChatWidgetPreview />
      </div>
    </div>
  );
}