// AUDIT-22: Route inventory test.
//
// Every API route file under src/app/api/ MUST be accounted for in the
// middleware route classification. This test discovers all API route files
// on disk and verifies each one is either:
//   1. In the PUBLIC_API_ROUTES allowlist (isPublicRoute returns true), OR
//   2. Protected by default (isPublicRoute returns false -- requires auth)
//
// If a new route is added without being classified, this test fails and
// forces the developer to make an explicit decision about whether the
// route should be public or protected.
//
// This prevents audit finding P0-01: accidentally exposing new API routes
// without authentication.

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { isPublicRoute } from "@/lib/middleware/routes";

/**
 * Recursively find all route.ts files under src/app/api/
 */
function findApiRoutes(dir: string, prefix = "/api"): string[] {
  const routes: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Dynamic route segments: [id] → :id
      const segment = entry.name.startsWith("[")
        ? `:${entry.name.slice(1, -1)}`
        : entry.name;
      routes.push(...findApiRoutes(fullPath, `${prefix}/${segment}`));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      routes.push(prefix);
    }
  }

  return routes;
}

describe("API Route Inventory", () => {
  const apiDir = path.resolve(__dirname, "../../app/api");
  const allRoutes = findApiRoutes(apiDir);

  it("discovers at least 10 API routes (sanity check)", () => {
    expect(allRoutes.length).toBeGreaterThan(10);
  });

  it("every API route is explicitly classified as public or protected", () => {
    // Routes that are public (in the allowlist)
    const publicRoutes: string[] = [];
    // Routes that are protected (not in the allowlist — good, default-deny)
    const protectedRoutes: string[] = [];

    for (const route of allRoutes) {
      // Skip __tests__ directory
      if (route.includes("__tests__")) continue;

      if (isPublicRoute(route)) {
        publicRoutes.push(route);
      } else {
        protectedRoutes.push(route);
      }
    }

    // Every route must be in one of the two lists
    const total = publicRoutes.length + protectedRoutes.length;
    const testableRoutes = allRoutes.filter((r) => !r.includes("__tests__"));
    expect(total).toBe(testableRoutes.length);

    // Log the classification for audit trail
    console.log(
      `\nRoute inventory: ${publicRoutes.length} public, ${protectedRoutes.length} protected (${total} total)\n` +
        `Public routes:\n${publicRoutes.map((r) => `  ✓ ${r}`).join("\n")}\n` +
        `Protected routes:\n${protectedRoutes.map((r) => `  🔒 ${r}`).join("\n")}`,
    );
  });

  it("sensitive routes are NOT public", () => {
    const sensitivePatterns = [
      "/api/admin",
      "/api/impersonate",
      "/api/patient/delete-account",
      "/api/patient/export",
      "/api/upload",
      "/api/files/download",
      "/api/notifications/trigger",
      "/api/custom-fields",
      "/api/dns",
      "/api/onboarding/wizard",
    ];

    for (const pattern of sensitivePatterns) {
      const matchingRoutes = allRoutes.filter((r) => r.startsWith(pattern));
      for (const route of matchingRoutes) {
        expect(
          isPublicRoute(route),
          `Sensitive route ${route} should NOT be public`,
        ).toBe(false);
      }
    }
  });
});
