/**
 * SEED-01 runtime guard tests.
 *
 * Exercises the real `isSeedUserBlocked` from `../seed-guard`: the guard
 * must consult the DB-backed blocklist only in production and support both
 * auth IDs and emails so recreated accounts cannot bypass the guard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSeedGuardCacheForTests,
  isSeedUserBlocked,
  listBlockedSeedEmails,
} from "../seed-guard";

const env = process.env as Record<string, string | undefined>;
const ORIGINAL_NODE_ENV = env.NODE_ENV;

const fromMock = vi.fn();
const selectMock = vi.fn();
const limitMock = vi.fn();
const eqMock = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

beforeEach(() => {
  clearSeedGuardCacheForTests();
  vi.clearAllMocks();

  eqMock.mockResolvedValue({ data: [], error: null });
  limitMock.mockReturnValue({ eq: eqMock });
  selectMock.mockReturnValue({ limit: limitMock });
  fromMock.mockReturnValue({ select: selectMock });
});

afterEach(() => {
  env.NODE_ENV = ORIGINAL_NODE_ENV;
  clearSeedGuardCacheForTests();
});

describe("isSeedUserBlocked", () => {
  it("returns false for null/undefined/empty identifiers", async () => {
    env.NODE_ENV = "production";
    await expect(isSeedUserBlocked(null)).resolves.toBe(false);
    await expect(isSeedUserBlocked(undefined)).resolves.toBe(false);
    await expect(isSeedUserBlocked("")).resolves.toBe(false);
  });

  it("queries by auth_id in production", async () => {
    env.NODE_ENV = "production";
    eqMock.mockResolvedValueOnce({ data: [{ id: "blocked-row" }], error: null });

    await expect(isSeedUserBlocked("a0000000-0000-0000-0000-000000000001")).resolves.toBe(true);
    expect(eqMock).toHaveBeenCalledWith("auth_id", "a0000000-0000-0000-0000-000000000001");
  });

  it("queries by normalized email in production", async () => {
    env.NODE_ENV = "production";
    eqMock.mockResolvedValueOnce({ data: [{ id: "blocked-row" }], error: null });

    await expect(isSeedUserBlocked("Admin@Demo-Clinic.com")).resolves.toBe(true);
    expect(eqMock).toHaveBeenCalledWith("email", "admin@demo-clinic.com");
  });

  it("does not block unknown users in production", async () => {
    env.NODE_ENV = "production";
    await expect(isSeedUserBlocked("11111111-2222-3333-4444-555555555555")).resolves.toBe(false);
  });

  it("never queries the DB outside production", async () => {
    env.NODE_ENV = "development";
    await expect(isSeedUserBlocked("a0000000-0000-0000-0000-000000000001")).resolves.toBe(false);
    env.NODE_ENV = "test";
    await expect(isSeedUserBlocked("admin@demo-clinic.com")).resolves.toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("caches lookups briefly per identifier", async () => {
    env.NODE_ENV = "production";
    eqMock.mockResolvedValueOnce({ data: [{ id: "blocked-row" }], error: null });

    await expect(isSeedUserBlocked("admin@demo-clinic.com")).resolves.toBe(true);
    await expect(isSeedUserBlocked("admin@demo-clinic.com")).resolves.toBe(true);

    expect(eqMock).toHaveBeenCalledTimes(1);
  });
});

describe("listBlockedSeedEmails", () => {
  it("returns normalized blocklist emails in production", async () => {
    env.NODE_ENV = "production";
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({
        data: [{ email: "Admin@Demo-Clinic.com" }, { email: "doctor@demo-clinic.com" }],
        error: null,
      }),
    });

    await expect(listBlockedSeedEmails()).resolves.toEqual([
      "admin@demo-clinic.com",
      "doctor@demo-clinic.com",
    ]);
  });

  it("returns an empty list outside production", async () => {
    env.NODE_ENV = "development";
    await expect(listBlockedSeedEmails()).resolves.toEqual([]);
  });
});
