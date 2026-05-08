/**
 * Feature Flag Validation Tests
 *
 * A2-08: Tests for production feature flag validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateProductionFlags } from "@/lib/feature-flags";

describe("validateProductionFlags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Non-production environments", () => {
    it("should skip validation in development", () => {
      process.env.NODE_ENV = "development";
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "true";
      // Should not throw even with invalid config
      expect(() => validateProductionFlags()).not.toThrow();
    });

    it("should skip validation in test", () => {
      process.env.NODE_ENV = "test";
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "true";
      // Should not throw even with invalid config
      expect(() => validateProductionFlags()).not.toThrow();
    });
  });

  describe("Production environment - SELF_SERVICE_REGISTRATION_ENABLED", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
      process.env.R2_SIGNED_URL_SECRET = "test-secret-key";
    });

    it("should pass when self-service registration is disabled (default)", () => {
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "false";
      expect(() => validateProductionFlags()).not.toThrow();
    });

    it("should pass when self-service registration is undefined (default)", () => {
      delete process.env.SELF_SERVICE_REGISTRATION_ENABLED;
      expect(() => validateProductionFlags()).not.toThrow();
    });

    it("should pass when self-service registration is enabled with DNS verification", () => {
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "true";
      process.env.DNS_VERIFICATION_SECRET = "test-dns-secret";
      expect(() => validateProductionFlags()).not.toThrow();
    });

    it("should throw when self-service registration is enabled without DNS verification", () => {
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "true";
      delete process.env.DNS_VERIFICATION_SECRET;
      expect(() => validateProductionFlags()).toThrow(
        /SECURITY: Self-service registration is enabled but DNS verification is not configured/
      );
    });

    it("should throw when self-service registration has invalid value", () => {
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "yes";
      expect(() => validateProductionFlags()).toThrow(
        /SECURITY: SELF_SERVICE_REGISTRATION_ENABLED must be "true" or "false"/
      );
    });
  });

  describe("Production environment - PHI masking", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
      process.env.R2_SIGNED_URL_SECRET = "test-secret-key";
    });

    it("should pass when data masking is partial (default)", () => {
      process.env.NEXT_PUBLIC_DATA_MASKING = "partial";
      expect(() => validateProductionFlags()).not.toThrow();
    });

    it("should pass when data masking is full", () => {
      process.env.NEXT_PUBLIC_DATA_MASKING = "full";
      expect(() => validateProductionFlags()).not.toThrow();
    });

    it("should pass when data masking is none with explicit opt-in", () => {
      process.env.NEXT_PUBLIC_DATA_MASKING = "none";
      process.env.ALLOW_UNMASKED_PHI = "true";
      expect(() => validateProductionFlags()).not.toThrow();
    });

    it("should throw when data masking is none without explicit opt-in", () => {
      process.env.NEXT_PUBLIC_DATA_MASKING = "none";
      delete process.env.ALLOW_UNMASKED_PHI;
      expect(() => validateProductionFlags()).toThrow(
        /SECURITY: NEXT_PUBLIC_DATA_MASKING=none requires explicit ALLOW_UNMASKED_PHI=true/
      );
    });
  });

  describe("Production environment - R2 signed URL secret", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should pass when R2 signed URL secret is configured", () => {
      process.env.R2_SIGNED_URL_SECRET = "test-secret-key";
      expect(() => validateProductionFlags()).not.toThrow();
    });

    it("should throw when R2 signed URL secret is missing", () => {
      delete process.env.R2_SIGNED_URL_SECRET;
      expect(() => validateProductionFlags()).toThrow(
        /SECURITY: R2_SIGNED_URL_SECRET must be configured in production/
      );
    });
  });

  describe("Production environment - Combined validation", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should pass with all security flags properly configured", () => {
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "false";
      process.env.NEXT_PUBLIC_DATA_MASKING = "partial";
      process.env.R2_SIGNED_URL_SECRET = "test-secret-key";
      expect(() => validateProductionFlags()).not.toThrow();
    });

    it("should throw on first validation failure (R2 secret)", () => {
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "true";
      delete process.env.DNS_VERIFICATION_SECRET;
      delete process.env.R2_SIGNED_URL_SECRET;
      // Should throw for R2 secret first (checked last in the function)
      expect(() => validateProductionFlags()).toThrow(/R2_SIGNED_URL_SECRET/);
    });
  });
});
