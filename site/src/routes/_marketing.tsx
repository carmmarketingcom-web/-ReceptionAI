import { Outlet, createFileRoute } from "@tanstack/react-router";
import Header from "~/components/Header";
import Footer from "~/components/Footer";

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
    </div>
  );
}