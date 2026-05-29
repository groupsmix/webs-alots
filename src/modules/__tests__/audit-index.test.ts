import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("Audit module barrel exports", () => {
  it("exports writeImmutableAuditEntry", async () => {
    const mod = await import("@/modules/audit");
    expect(mod.writeImmutableAuditEntry).toBeDefined();
    expect(typeof mod.writeImmutableAuditEntry).toBe("function");
  });

  it("exports verifyAuditChain", async () => {
    const mod = await import("@/modules/audit");
    expect(mod.verifyAuditChain).toBeDefined();
    expect(typeof mod.verifyAuditChain).toBe("function");
  });

  it("exports getLastAuditHash", async () => {
    const mod = await import("@/modules/audit");
    expect(mod.getLastAuditHash).toBeDefined();
    expect(typeof mod.getLastAuditHash).toBe("function");
  });

  it("exports computeEntryHash", async () => {
    const mod = await import("@/modules/audit");
    expect(mod.computeEntryHash).toBeDefined();
    expect(typeof mod.computeEntryHash).toBe("function");
  });
});
