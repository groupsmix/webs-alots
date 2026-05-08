import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enforceSecurityFlagAcknowledgments,
  SECURITY_FLAG_ACKNOWLEDGMENTS,
} from "../env";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function clearAllSecurityFlagEnv() {
  for (const { flag, ack } of SECURITY_FLAG_ACKNOWLEDGMENTS) {
    vi.stubEnv(flag, "");
    vi.stubEnv(ack, "");
  }
}

describe("enforceSecurityFlagAcknowledgments (A2-08)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does nothing outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    clearAllSecurityFlagEnv();
    vi.stubEnv("SELF_SERVICE_REGISTRATION_ENABLED", "true");
    expect(() => enforceSecurityFlagAcknowledgments()).not.toThrow();
  });

  it("passes in production when no security flag is enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearAllSecurityFlagEnv();
    expect(() => enforceSecurityFlagAcknowledgments()).not.toThrow();
  });

  it("passes in production when SELF_SERVICE_REGISTRATION_ENABLED is true and acknowledged", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearAllSecurityFlagEnv();
    vi.stubEnv("SELF_SERVICE_REGISTRATION_ENABLED", "true");
    vi.stubEnv("SELF_SERVICE_REGISTRATION_ACK", "true");
    expect(() => enforceSecurityFlagAcknowledgments()).not.toThrow();
  });

  it("throws in production when SELF_SERVICE_REGISTRATION_ENABLED is true but unacknowledged", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearAllSecurityFlagEnv();
    vi.stubEnv("SELF_SERVICE_REGISTRATION_ENABLED", "true");
    expect(() => enforceSecurityFlagAcknowledgments()).toThrow(
      /SELF_SERVICE_REGISTRATION_ENABLED=true[\s\S]*SELF_SERVICE_REGISTRATION_ACK=true/,
    );
  });

  it("throws in production when NEXT_PUBLIC_PHONE_AUTH_ENABLED is true but unacknowledged", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearAllSecurityFlagEnv();
    vi.stubEnv("NEXT_PUBLIC_PHONE_AUTH_ENABLED", "true");
    expect(() => enforceSecurityFlagAcknowledgments()).toThrow(
      /NEXT_PUBLIC_PHONE_AUTH_ENABLED=true[\s\S]*PHONE_AUTH_ACK=true/,
    );
  });

  it("reports every unacknowledged flag in a single message", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearAllSecurityFlagEnv();
    vi.stubEnv("SELF_SERVICE_REGISTRATION_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_PHONE_AUTH_ENABLED", "true");
    expect(() => enforceSecurityFlagAcknowledgments()).toThrow(
      /SELF_SERVICE_REGISTRATION_ENABLED[\s\S]*NEXT_PUBLIC_PHONE_AUTH_ENABLED/,
    );
  });

  it("treats anything other than the literal string \"true\" as off", () => {
    // Mirrors the existing pattern for other flags so accidental non-boolean
    // values (e.g. "yes", "1") do not silently widen the attack surface.
    vi.stubEnv("NODE_ENV", "production");
    clearAllSecurityFlagEnv();
    vi.stubEnv("SELF_SERVICE_REGISTRATION_ENABLED", "yes");
    vi.stubEnv("NEXT_PUBLIC_PHONE_AUTH_ENABLED", "1");
    expect(() => enforceSecurityFlagAcknowledgments()).not.toThrow();
  });
});
