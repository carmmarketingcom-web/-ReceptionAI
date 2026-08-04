/**
 * Public booking API endpoints.
 *
 * GET  /api/booking/slots?org_id=UUID&date=YYYY-MM-DD&duration=60
 * POST /api/booking  { org_id, name, phone, email?, date, time, service?, notes? }
 *
 * These are handled inline in serve.ts — this file is a reference.
 * TanStack Start's file router excludes API-only route files.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/booking")({});

