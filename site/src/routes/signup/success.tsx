import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/signup/success")({
  component: SuccessPage,
  validateSearch: (search: Record<string, unknown>) => ({
    plan: (search.plan as string) || "growth",
    email: (search.email as string) || "",
  }),
});

function SuccessPage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.replace("/dashboard");
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-white via-indigo-50/30 to-white">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✅</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Account created!</h1>
          <p className="mt-1 text-sm text-gray-500">Your AI receptionist is being set up...</p>
        </div>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full w-1/2 animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-indigo-500" />
        </div>
        <p className="text-xs text-gray-400">Taking you to your dashboard...</p>
      </div>
    </div>
  );
}
