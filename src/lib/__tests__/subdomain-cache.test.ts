/**
 * Subdomain cache tests.
 *
 * Exercises the real exports of `../subdomain-cache`: positive/negative
 * cache writes, the negative-cache clearing on a positive write, targeted
 * and bulk invalidation, and the LRU max-size enforcement (PERF-05).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  subdomainCache,
  negativeSubdomainCache,
  setSubdomainCache,
  setNegativeSubdomainCache,
  invalidateSubdomainCache,
  invalidateAllSubdomainCaches,
} from "../subdomain-cache";

function clinic(id: string) {
  return {
    id,
    name: `Clinic ${id}`,
    subdomain: id,
    type: "general",
    tier: "pro",
    cachedAt: Date.now(),
  };
}

beforeEach(() => {
  subdomainCache.clear();
  negativeSubdomainCache.clear();
});

describe("subdomain cache", () => {
  it("stores and retrieves a positive entry", () => {
    setSubdomainCache("clinic-a", clinic("a"));
    expect(subdomainCache.get("clinic-a")?.id).toBe("a");
  });

  it("clears any negative entry when a positive entry is written", () => {
    setNegativeSubdomainCache("clinic-a");
    expect(negativeSubdomainCache.has("clinic-a")).toBe(true);
    setSubdomainCache("clinic-a", clinic("a"));
    expect(negativeSubdomainCache.has("clinic-a")).toBe(false);
  });

  it("re-inserting an existing key moves it to the most-recently-used position", () => {
    setSubdomainCache("clinic-a", clinic("a"));
    setSubdomainCache("clinic-b", clinic("b"));
    setSubdomainCache("clinic-a", clinic("a2"));
    // Map iteration order: oldest first. "clinic-b" should now be oldest.
    expect([...subdomainCache.keys()][0]).toBe("clinic-b");
    expect(subdomainCache.get("clinic-a")?.id).toBe("a2");
  });

  it("invalidates a single entry from both caches", () => {
    setSubdomainCache("clinic-a", clinic("a"));
    setNegativeSubdomainCache("clinic-a");
    invalidateSubdomainCache("clinic-a");
    expect(subdomainCache.has("clinic-a")).toBe(false);
    expect(negativeSubdomainCache.has("clinic-a")).toBe(false);
  });

  it("bulk-invalidates the positive cache", () => {
    setSubdomainCache("clinic-a", clinic("a"));
    setSubdomainCache("clinic-b", clinic("b"));
    invalidateAllSubdomainCaches();
    expect(subdomainCache.size).toBe(0);
  });

  it("enforces the max cache size (PERF-05)", () => {
    for (let i = 0; i < 600; i++) {
      setSubdomainCache(`clinic-${i}`, clinic(String(i)));
    }
    expect(subdomainCache.size).toBeLessThanOrEqual(500);
    // The most recently inserted key must still be present.
    expect(subdomainCache.has("clinic-599")).toBe(true);
  });

  it("enforces the max size on the negative cache too", () => {
    for (let i = 0; i < 600; i++) {
      setNegativeSubdomainCache(`neg-${i}`);
    }
    expect(negativeSubdomainCache.size).toBeLessThanOrEqual(500);
  });
});
