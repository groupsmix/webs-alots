/**
 * Centralised cache key definitions.
 *
 * All keys are prefixed with the resource type for easy bulk invalidation.
 * TTLs are in seconds.
 */

export const CACHE_TTL = {
  /** Clinic configuration (timezone, working hours, slot duration). */
  CLINIC_CONFIG: 300, // 5 minutes
  /** Feature flag overrides per clinic. */
  FEATURE_FLAGS: 300, // 5 minutes
  /** AI provider availability status. */
  AI_STATUS: 60, // 1 minute
  /** User session profile (role, clinic association). */
  USER_SESSION: 600, // 10 minutes
} as const;

export function clinicConfigKey(clinicId: string): string {
  return `clinic:config:${clinicId}`;
}

export function featureFlagsKey(clinicId: string): string {
  return `clinic:flags:${clinicId}`;
}

export function aiStatusKey(): string {
  return `system:ai_status`;
}

export function userSessionKey(userId: string): string {
  return `user:session:${userId}`;
}
