/**
 * Masking utilities for patient PHI (Protected Health Information).
 *
 * Three masking levels controlled by `NEXT_PUBLIC_DATA_MASKING`:
 *   - `"full"`    — aggressive masking for demos / public screens
 *   - `"partial"` — moderate masking for staff who need partial visibility
 *   - `"none"`    — no masking (authorized personnel)
 *
 * Issue 46
 */

export type MaskLevel = "full" | "partial" | "none";

/**
 * Build-time sentinel (audit 2026-06-09 Task 2).
 *
 * NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time;
 * the startup health check in env.ts reads the RUNTIME var (wrangler.toml)
 * and therefore cannot detect a build that was produced without
 * NEXT_PUBLIC_DATA_MASKING — exactly the silent failure mode where client
 * components ship with masking compiled to "none" while the server-side
 * check passes.
 *
 * The MaskingBuildSentinel component embeds MARKER + LEVEL in the always-
 * shipped root-layout chunk, and scripts/smoke-post-deploy.mjs greps the
 * deployed bundle for it after every deploy.
 */
export const MASKING_BUILD_MARKER = "__OLTIGO_MASKING_BUILD__";
export const MASKING_BUILD_LEVEL: string = process.env.NEXT_PUBLIC_DATA_MASKING || "unset";

/**
 * Read the masking level from the environment.
 *
 * Fail-safe default: when the env var is absent or malformed we return
 * "partial" (NOT "none"), so any code path that reaches getMaskLevel() before
 * the build-time NEXT_PUBLIC_DATA_MASKING inlining (e.g. local dev, SSR paths,
 * tests) still masks PHI by default. This mirrors the build/runtime defaults
 * in next.config.ts (env fallback "partial"), wrangler.toml [vars], and the
 * production guard in env.ts (enforcePhiMaskingPolicy throws on "none").
 * Decision recorded in ADR-0008 ("partial PHI masking by default").
 *
 * Returning "none" requires explicitly setting NEXT_PUBLIC_DATA_MASKING="none"
 * (which is itself blocked in production unless ALLOW_UNMASKED_PHI=true).
 */
export function getMaskLevel(): MaskLevel {
  const raw = process.env.NEXT_PUBLIC_DATA_MASKING;
  if (raw === "full" || raw === "partial" || raw === "none") return raw;
  return "partial";
}

/** Mask a Moroccan phone number. */
export function maskPhone(value: string, level: MaskLevel = getMaskLevel()): string {
  if (level === "none" || !value) return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return value;
  if (level === "full") {
    return `${digits.slice(0, 2)} *** *** ${digits.slice(-2)}`;
  }
  // partial
  return `${digits.slice(0, 4)} *** ${digits.slice(-2)}`;
}

/** Mask an email address. */
function maskEmail(value: string, level: MaskLevel = getMaskLevel()): string {
  if (level === "none" || !value) return value;
  const [local, domain] = value.split("@");
  if (!domain) return value;
  if (level === "full") {
    return `${local.slice(0, 2)}***@${domain}`;
  }
  // partial — show first 3 chars
  return `${local.slice(0, 3)}***@${domain}`;
}

/** Mask a CIN (Carte d'Identité Nationale). */
export function maskCIN(value: string, level: MaskLevel = getMaskLevel()): string {
  if (level === "none" || !value) return value;
  if (level === "full") {
    return `${value.slice(0, 2)}****${value.slice(-2)}`;
  }
  // partial
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

/** Generic masker that dispatches on field type. */
export function mask(value: string, type: "phone" | "email" | "cin", level?: MaskLevel): string {
  switch (type) {
    case "phone":
      return maskPhone(value, level);
    case "email":
      return maskEmail(value, level);
    case "cin":
      return maskCIN(value, level);
  }
}
