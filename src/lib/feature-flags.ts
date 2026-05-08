/**
 * Feature Flag Validation
 *
 * A2-08: Runtime validation for security-critical feature flags.
 * Prevents misconfiguration in production by asserting that security-sensitive
 * flags are explicitly set to safe values.
 *
 * This module is called once on first request (via middleware) to fail-fast
 * if production configuration is unsafe.
 */

import { logger } from "@/lib/logger";

/**
 * Validate production feature flags at startup.
 *
 * A2-08: Self-service registration MUST be disabled in production unless
 * explicitly enabled with proper identity verification. This prevents
 * accidental exposure of the registration endpoint which could allow
 * unauthorized clinic creation.
 *
 * @throws {Error} if validation fails (prevents app startup)
 */
export function validateProductionFlags(): void {
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!isProduction) {
    // Skip validation in non-production environments
    return;
  }

  // A2-08: Validate SELF_SERVICE_REGISTRATION_ENABLED flag
  const selfServiceEnabled = process.env.SELF_SERVICE_REGISTRATION_ENABLED;
  
  if (selfServiceEnabled === "true") {
    // Self-service registration is enabled in production
    // Verify that DNS verification is properly configured
    const dnsSecret = process.env.DNS_VERIFICATION_SECRET;
    
    if (!dnsSecret) {
      logger.error("Production flag validation failed: SELF_SERVICE_REGISTRATION_ENABLED=true but DNS_VERIFICATION_SECRET is not configured", {
        context: "feature-flags",
      });
      throw new Error(
        "SECURITY: Self-service registration is enabled but DNS verification is not configured. " +
        "Set DNS_VERIFICATION_SECRET or disable SELF_SERVICE_REGISTRATION_ENABLED."
      );
    }
    
    logger.warn("Self-service registration is ENABLED in production", {
      context: "feature-flags",
      flag: "SELF_SERVICE_REGISTRATION_ENABLED",
      value: "true",
    });
  } else if (selfServiceEnabled !== "false" && selfServiceEnabled !== undefined) {
    // Flag is set to an invalid value (not "true", "false", or undefined)
    logger.error("Production flag validation failed: SELF_SERVICE_REGISTRATION_ENABLED has invalid value", {
      context: "feature-flags",
      value: selfServiceEnabled,
    });
    throw new Error(
      `SECURITY: SELF_SERVICE_REGISTRATION_ENABLED must be "true" or "false", got: "${selfServiceEnabled}"`
    );
  }

  // Validate PHI masking configuration
  const dataMasking = process.env.NEXT_PUBLIC_DATA_MASKING;
  const allowUnmasked = process.env.ALLOW_UNMASKED_PHI;
  
  if (dataMasking === "none" && allowUnmasked !== "true") {
    logger.error("Production flag validation failed: NEXT_PUBLIC_DATA_MASKING=none without ALLOW_UNMASKED_PHI=true", {
      context: "feature-flags",
    });
    throw new Error(
      "SECURITY: NEXT_PUBLIC_DATA_MASKING=none requires explicit ALLOW_UNMASKED_PHI=true. " +
      "See SECURITY.md for PHI masking policy."
    );
  }

  // Validate R2 signed URL secret is configured
  const r2SignedUrlSecret = process.env.R2_SIGNED_URL_SECRET;
  if (!r2SignedUrlSecret) {
    logger.error("Production flag validation failed: R2_SIGNED_URL_SECRET is not configured", {
      context: "feature-flags",
    });
    throw new Error(
      "SECURITY: R2_SIGNED_URL_SECRET must be configured in production. " +
      "Generate with: openssl rand -hex 32"
    );
  }

  logger.info("Production feature flags validated successfully", {
    context: "feature-flags",
    selfServiceRegistration: selfServiceEnabled ?? "false",
    dataMasking: dataMasking ?? "partial",
  });
}
