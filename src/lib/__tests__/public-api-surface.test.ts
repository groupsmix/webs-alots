// Public API surface lock — guards against accidental exposure of new
// routes via prefix-matching in `isPublicApiRoute`.
//
// `route-inventory.test.ts` proves every route is *classified* and that a
// fixed list of sensitive prefixes stays protected. It does NOT catch a
// brand-new route that becomes public simply because it lives under an
// already-allowlisted prefix (e.g. adding `src/app/api/booking/<x>/route.ts`
// inherits `/api/booking`'s public status). This test pins the EXACT set of
// publicly-reachable API routes, so any addition/removal forces an explicit,
// reviewed update here.

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { isPublicRoute } from "@/lib/middleware/routes";

function findApiRoutes(dir: string, prefix = "/api"): string[] {
  const routes: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const segment = entry.name.startsWith("[") ? `:${entry.name.slice(1, -1)}` : entry.name;
      routes.push(...findApiRoutes(fullPath, `${prefix}/${segment}`));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      routes.push(prefix);
    }
  }
  return routes;
}

describe("Public API surface lock", () => {
  const apiDir = path.resolve(__dirname, "../../app/api");

  const actualPublicRoutes = findApiRoutes(apiDir)
    .filter((r) => !r.includes("__tests__"))
    .filter((r) => isPublicRoute(r))
    .sort();

  it("matches the reviewed allowlist exactly (add/remove requires a deliberate edit here)", () => {
    expect(actualPublicRoutes).toEqual(EXPECTED_PUBLIC_ROUTES);
  });
});

// Keep sorted. Every entry here is reachable without the middleware auth
// gate. Adding a route to this list means it is exposed to the public
// internet — review tenant scoping, rate limiting, and input validation
// before doing so.
//
// NOTE: the `/api/booking/*` sub-routes below are public only because
// `isPublicApiRoute` treats sub-paths of the allowlisted `/api/booking`
// prefix as public; each one still self-authenticates inside its handler
// via `withAuth`/`withAuthValidation`. This snapshot exists so that any
// NEW sub-route inheriting that prefix is surfaced for explicit review
// (see audit finding AZ-2 on prefix-match scope).
const EXPECTED_PUBLIC_ROUTES: string[] = [
  "/api/auth/demo-login",
  "/api/billing/webhook",
  "/api/booking",
  "/api/booking/cancel",
  "/api/booking/emergency-slot",
  "/api/booking/payment/confirm",
  "/api/booking/payment/initiate",
  "/api/booking/payment/refund",
  "/api/booking/recurring",
  "/api/booking/reschedule",
  "/api/booking/verify",
  "/api/booking/waiting-list",
  "/api/branding",
  "/api/branding/apply-preset",
  "/api/branding/custom-domain",
  "/api/chat",
  "/api/checkin/confirm",
  "/api/checkin/lookup",
  "/api/checkin/qr-scan",
  "/api/checkin/status",
  "/api/cron/audit-log-flush",
  "/api/cron/billing",
  "/api/cron/dedup-purge",
  "/api/cron/feedback",
  "/api/cron/gdpr-purge",
  "/api/cron/notifications",
  "/api/cron/nps-survey",
  "/api/cron/r2-cleanup",
  "/api/cron/rebooking-reminders",
  "/api/cron/reminders",
  "/api/cron/retry-webhooks",
  "/api/cron/stripe-reconcile",
  "/api/cron/uptime-monitor",
  "/api/csp-report",
  "/api/docs",
  "/api/health",
  "/api/health/internal",
  "/api/nps/respond",
  "/api/payments/cmi/callback",
  "/api/payments/webhook",
  "/api/v1/appointments",
  "/api/v1/patients",
  "/api/v1/register-clinic",
  "/api/v1/register-clinic/verification-token",
  "/api/verify-email",
  "/api/waiting-queue",
  "/api/waiting-queue/update",
  "/api/webhooks",
];
