import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceEmailProviderExclusivity } from "../env";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const EMAIL_VARS = [
  "RESEND_API_KEY",
  "EMAIL_RELAY_HOST",
  "EMAIL_RELAY_USER",
  "EMAIL_RELAY_PASS",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
];

function clearEmailEnv() {
  for (const name of EMAIL_VARS) vi.stubEnv(name, "");
}

describe("enforceEmailProviderExclusivity (F-10)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does nothing outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    clearEmailEnv();
    expect(() => enforceEmailProviderExclusivity()).not.toThrow();
  });

  it("passes in production with only Resend configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearEmailEnv();
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    expect(() => enforceEmailProviderExclusivity()).not.toThrow();
  });

  it("passes in production with only the legacy SMTP_* relay configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearEmailEnv();
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "user");
    vi.stubEnv("SMTP_PASS", "pass");
    expect(() => enforceEmailProviderExclusivity()).not.toThrow();
  });

  it("passes in production with only the EMAIL_RELAY_* relay configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearEmailEnv();
    vi.stubEnv("EMAIL_RELAY_HOST", "api.mailgun.net/v3/mg.example.com");
    vi.stubEnv("EMAIL_RELAY_USER", "user");
    vi.stubEnv("EMAIL_RELAY_PASS", "pass");
    expect(() => enforceEmailProviderExclusivity()).not.toThrow();
  });

  it("throws in production when both Resend and SMTP are configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearEmailEnv();
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "user");
    vi.stubEnv("SMTP_PASS", "pass");
    expect(() => enforceEmailProviderExclusivity()).toThrow(
      /Both Resend[\s\S]*relay[\s\S]*are configured/,
    );
  });

  it("throws in production when neither provider is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    clearEmailEnv();
    expect(() => enforceEmailProviderExclusivity()).toThrow(
      /No email provider is configured/,
    );
  });

  it("treats the relay as unconfigured when only SMTP_HOST is set without credentials", () => {
    // A partially-configured relay is unusable at runtime, so production
    // boot must reject this as effectively having no provider.
    vi.stubEnv("NODE_ENV", "production");
    clearEmailEnv();
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    expect(() => enforceEmailProviderExclusivity()).toThrow(
      /No email provider is configured/,
    );
  });
});
