import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforcePhiMaskingPolicy } from "../env";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("enforcePhiMaskingPolicy (Audit Finding #7)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not throw when not in production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DATA_MASKING", "none");
    expect(() => enforcePhiMaskingPolicy()).not.toThrow();
  });

  it("does not throw in production when masking is 'partial'", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DATA_MASKING", "partial");
    expect(() => enforcePhiMaskingPolicy()).not.toThrow();
  });

  it("does not throw in production when masking is 'full'", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DATA_MASKING", "full");
    expect(() => enforcePhiMaskingPolicy()).not.toThrow();
  });

  it("does not throw in production when masking is unset (defaults to partial via wrangler.toml)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DATA_MASKING", "");
    expect(() => enforcePhiMaskingPolicy()).not.toThrow();
  });

  it("throws in production when masking is 'none' without the escape hatch", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DATA_MASKING", "none");
    vi.stubEnv("ALLOW_UNMASKED_PHI", "");
    expect(() => enforcePhiMaskingPolicy()).toThrow(
      /NEXT_PUBLIC_DATA_MASKING=none is not allowed in production/,
    );
  });

  it("throws in production when masking is 'none' and the escape hatch is not exactly 'true'", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DATA_MASKING", "none");
    vi.stubEnv("ALLOW_UNMASKED_PHI", "1");
    expect(() => enforcePhiMaskingPolicy()).toThrow(
      /NEXT_PUBLIC_DATA_MASKING=none is not allowed in production/,
    );
  });

  it("permits 'none' in production when ALLOW_UNMASKED_PHI=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DATA_MASKING", "none");
    vi.stubEnv("ALLOW_UNMASKED_PHI", "true");
    expect(() => enforcePhiMaskingPolicy()).not.toThrow();
  });
});
