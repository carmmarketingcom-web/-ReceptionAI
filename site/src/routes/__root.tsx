import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "color-scheme", content: "light" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ReceptionAI — AI Receptionist for Small Businesses | 24/7 Call Answering" },
      {
        name: "description",
        content:
          "AI-powered virtual receptionist that answers calls, books appointments, and handles messages 24/7. Built-in calendar — no Google account needed. Try it free.",
      },
      { name: "og:title", content: "ReceptionAI — AI Receptionist for Small Businesses" },
      {
        name: "og:description",
        content:
          "AI-powered virtual receptionist that answers calls, books appointments, and handles messages 24/7.",
      },
      { name: "og:url", content: "https://www.receptionai.store" },
      { name: "og:type", content: "website" },
      { name: "og:image", content: "https://www.receptionai.store/images/og-image.png" },
      { name: "og:image:width", content: "1536" },
      { name: "og:image:height", content: "1024" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://www.receptionai.store/images/og-image.png" },
      { name: "google-site-verification", content: "QgwuDrpvyBumv82MqfbquRN1ep8cp8pYwBVqvNnr-Ng" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/images/favicon-64.png" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800;14..32,900&display=swap",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-white via-indigo-50/30 to-white">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-50 text-4xl">🔍</div>
        <h1 className="mt-6 text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">The page you're looking for doesn't exist.</p>
        <a href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">← Back to Home</a>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-white via-indigo-50/30 to-white">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 text-4xl">⚙️</div>
        <h1 className="mt-6 text-2xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500">We're working on it. Please try again.</p>
        <button onClick={() => window.location.reload()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">Try Again</button>
      </div>
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}