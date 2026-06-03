import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceSeedPasswordsRotated } from "../env";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("enforceSeedPasswordsRotated (SEED-01)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not throw outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SEED_PASSWORDS_ROTATED", "false");
    expect(() => enforceSeedPasswordsRotated()).not.toThrow();

    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SEED_PASSWORDS_ROTATED", "");
    expect(() => enforceSeedPasswordsRotated()).not.toThrow();
  });

  it("throws in production when SEED_PASSWORDS_ROTATED is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEED_PASSWORDS_ROTATED", "");
    expect(() => enforceSeedPasswordsRotated()).toThrow(
      /Seed user passwords have not been rotated/,
    );
  });

  it("throws in production when SEED_PASSWORDS_ROTATED is false", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEED_PASSWORDS_ROTATED", "false");
    expect(() => enforceSeedPasswordsRotated()).toThrow(
      /Seed user passwords have not been rotated/,
    );
  });

  it("throws in production when SEED_PASSWORDS_ROTATED is some random string", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEED_PASSWORDS_ROTATED", "yes");
    expect(() => enforceSeedPasswordsRotated()).toThrow(
      /Seed user passwords have not been rotated/,
    );
  });

  it("accepts SEED_PASSWORDS_ROTATED as 'true' in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEED_PASSWORDS_ROTATED", "true");
    expect(() => enforceSeedPasswordsRotated()).not.toThrow();
  });
});
