/**
 * SEED-01 runtime guard tests.
 *
 * Exercises the real `isSeedUserBlocked` from `../seed-guard`: the guard
 * must only block the well-known seed auth IDs, and only when NODE_ENV is
 * production (so dev/test fixtures keep working).
 */
import { describe, it, expect, afterEach } from "vitest";
import { isSeedUserBlocked } from "../seed-guard";

// Writable reference to process.env that avoids TS read-only errors on NODE_ENV.
const env = process.env as Record<string, string | undefined>;
const ORIGINAL_NODE_ENV = env.NODE_ENV;
const SEED_ID = "a0000000-0000-0000-0000-000000000001";
const REAL_ID = "11111111-2222-3333-4444-555555555555";

afterEach(() => {
  env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe("isSeedUserBlocked", () => {
  it("returns false for null/undefined/empty auth IDs", () => {
    env.NODE_ENV = "production";
    expect(isSeedUserBlocked(null)).toBe(false);
    expect(isSeedUserBlocked(undefined)).toBe(false);
    expect(isSeedUserBlocked("")).toBe(false);
  });

  it("blocks a seed user in production", () => {
    env.NODE_ENV = "production";
    expect(isSeedUserBlocked(SEED_ID)).toBe(true);
  });

  it("blocks every known seed auth ID in production", () => {
    env.NODE_ENV = "production";
    const ids = [
      "a0000000-0000-0000-0000-000000000001",
      "a0000000-0000-0000-0000-000000000002",
      "a0000000-0000-0000-0000-000000000003",
      "a0000000-0000-0000-0000-000000000004",
      "a0000000-0000-0000-0000-000000000010",
      "a0000000-0000-0000-0000-000000000011",
      "a0000000-0000-0000-0000-000000000012",
      "a0000000-0000-0000-0000-000000000013",
      "a0000000-0000-0000-0000-000000000014",
    ];
    for (const id of ids) expect(isSeedUserBlocked(id)).toBe(true);
  });

  it("does not block real users even in production", () => {
    env.NODE_ENV = "production";
    expect(isSeedUserBlocked(REAL_ID)).toBe(false);
  });

  it("never blocks (even seed users) outside production", () => {
    env.NODE_ENV = "development";
    expect(isSeedUserBlocked(SEED_ID)).toBe(false);
    env.NODE_ENV = "test";
    expect(isSeedUserBlocked(SEED_ID)).toBe(false);
  });
});
