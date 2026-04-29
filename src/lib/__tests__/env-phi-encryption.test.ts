import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforcePhiEncryptionConfigured } from "../env";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("enforcePhiEncryptionConfigured (Audit C-08)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not throw outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PHI_ENCRYPTION_KEY", "");
    expect(() => enforcePhiEncryptionConfigured()).not.toThrow();
  });

  it("does not throw outside production even when key is invalid", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PHI_ENCRYPTION_KEY", "not-hex");
    expect(() => enforcePhiEncryptionConfigured()).not.toThrow();
  });

  it("throws in production when PHI_ENCRYPTION_KEY is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PHI_ENCRYPTION_KEY", "");
    expect(() => enforcePhiEncryptionConfigured()).toThrow(
      /PHI_ENCRYPTION_KEY is required in production/,
    );
  });

  it("throws in production when key is the wrong length", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PHI_ENCRYPTION_KEY", "a".repeat(32));
    expect(() => enforcePhiEncryptionConfigured()).toThrow(
      /must be exactly 64 hex characters/,
    );
  });

  it("throws in production when key contains non-hex characters", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PHI_ENCRYPTION_KEY", "z".repeat(64));
    expect(() => enforcePhiEncryptionConfigured()).toThrow(
      /must be exactly 64 hex characters/,
    );
  });

  it("accepts a 64-char hex key in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PHI_ENCRYPTION_KEY", "0123456789abcdef".repeat(4));
    expect(() => enforcePhiEncryptionConfigured()).not.toThrow();
  });

  it("accepts a mixed-case hex key", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PHI_ENCRYPTION_KEY", "ABCDEF0123456789".repeat(4));
    expect(() => enforcePhiEncryptionConfigured()).not.toThrow();
  });
});
