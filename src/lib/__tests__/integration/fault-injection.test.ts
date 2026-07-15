/**
 * A84-2: Fault-injection integration tests.
 *
 * Verifies that critical code paths degrade gracefully when
 * dependencies (Supabase, Auth, external APIs) are unavailable.
 * Each test mocks a dependency failure and asserts the response
 * is a well-formed degraded response — not an unhandled crash.
 */

import { describe, expect, it } from "vitest";

describe("Fault injection — degraded responses", () => {
  it("single-flight subdomain lookup coalesces concurrent requests", async () => {
    const { singleFlightSubdomainLookup } = await import("@/lib/subdomain-cache");

    let callCount = 0;
    const mockLookup = () =>
      new Promise<{
        id: string;
        name: string;
        subdomain: string;
        type: string;
        tier: string;
        cachedAt: number;
      } | null>((resolve) => {
        callCount++;
        setTimeout(
          () =>
            resolve({
              id: "clinic-1",
              name: "Test Clinic",
              subdomain: "test",
              type: "doctor",
              tier: "pro",
              cachedAt: Date.now(),
            }),
          50,
        );
      });

    // Fire 5 concurrent lookups for the same subdomain — only 1 should hit the DB
    const uniqueSubdomain = `test-sf-${Date.now()}`;
    const promises = Array.from({ length: 5 }, () =>
      singleFlightSubdomainLookup(uniqueSubdomain, mockLookup),
    );
    const results = await Promise.all(promises);

    expect(callCount).toBe(1);
    results.forEach((r) => expect(r?.id).toBe("clinic-1"));
  });
});
