import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/success")({
  loader: () => { throw redirect({ to: "/signup/success" }); },
  component: () => null,
});
