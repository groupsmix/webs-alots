import { describe, it, expect, vi } from "vitest";
import { computeEntryHash } from "@/modules/audit/append-only";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("computeEntryHash", () => {
  it("produces a 64-char hex string", async () => {
    const hash = await computeEntryHash(
      "clinic-01",
      "test.action",
      "test",
      "e-001",
      "actor-001",
      { key: "value" },
      null,
      "2024-01-15T10:00:00Z",
    );
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("produces different hashes for different actions", async () => {
    const hash1 = await computeEntryHash(
      "clinic-01",
      "create",
      "test",
      "e-001",
      "actor-001",
      {},
      null,
      "2024-01-15T10:00:00Z",
    );
    const hash2 = await computeEntryHash(
      "clinic-01",
      "update",
      "test",
      "e-001",
      "actor-001",
      {},
      null,
      "2024-01-15T10:00:00Z",
    );
    expect(hash1).not.toBe(hash2);
  });

  it("chains hashes via previousHash", async () => {
    const hash1 = await computeEntryHash(
      "clinic-01",
      "test",
      "test",
      "e-001",
      "actor-001",
      {},
      null,
      "2024-01-15T10:00:00Z",
    );
    const hash2 = await computeEntryHash(
      "clinic-01",
      "test",
      "test",
      "e-001",
      "actor-001",
      {},
      hash1,
      "2024-01-15T10:00:00Z",
    );
    expect(hash1).not.toBe(hash2);
  });

  it("is deterministic for same inputs", async () => {
    const args = [
      "clinic-01",
      "test",
      "test",
      "e-001",
      "actor-001",
      { a: 1 },
      "abc",
      "2024-01-15T10:00:00Z",
    ] as const;
    const hash1 = await computeEntryHash(...args);
    const hash2 = await computeEntryHash(...args);
    expect(hash1).toBe(hash2);
  });
});
