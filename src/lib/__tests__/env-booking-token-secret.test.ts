import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceBookingTokenSecretMinLength } from "../env";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("enforceBookingTokenSecretMinLength (audit-4 F-15)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does nothing outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BOOKING_TOKEN_SECRET", "x");
    expect(() => enforceBookingTokenSecretMinLength()).not.toThrow();
  });

  it("does nothing in production when the secret is unset", () => {
    // The "missing" case is handled by ENV_RULES.required, not by this guard.
    // This guard only fires when the value is set but short.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKING_TOKEN_SECRET", "");
    expect(() => enforceBookingTokenSecretMinLength()).not.toThrow();
  });

  it("throws in production when the secret is shorter than 32 chars", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKING_TOKEN_SECRET", "short");
    expect(() => enforceBookingTokenSecretMinLength()).toThrow(
      /BOOKING_TOKEN_SECRET must be at least 32 characters/,
    );
  });

  it("throws in production when the secret is exactly 31 chars", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKING_TOKEN_SECRET", "a".repeat(31));
    expect(() => enforceBookingTokenSecretMinLength()).toThrow(
      /BOOKING_TOKEN_SECRET must be at least 32 characters/,
    );
  });

  it("passes in production when the secret is exactly 32 chars", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKING_TOKEN_SECRET", "a".repeat(32));
    expect(() => enforceBookingTokenSecretMinLength()).not.toThrow();
  });

  it("passes in production when the secret is comfortably longer", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKING_TOKEN_SECRET", "a".repeat(64));
    expect(() => enforceBookingTokenSecretMinLength()).not.toThrow();
  });
});
