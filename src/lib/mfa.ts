"use server";

import { createClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { logAuthEvent } from "@/lib/audit-log";
import { randomBytes } from "crypto";

// ============================================================
// Types
// ============================================================

export interface MFAEnrollment {
  /** Factor ID returned by Supabase */
  factorId: string;
  /** TOTP URI for QR code generation */
  totpUri: string;
  /** Secret key for manual entry */
  secret: string;
  /** QR code data URL (SVG) */
  qrCode: string;
}

export interface MFAVerifyResult {
  error: string | null;
}

// ============================================================
// MFA Actions
// ============================================================

/**
 * Enroll the current user in TOTP-based MFA.
 * Returns the enrollment details including QR code URI and secret.
 */
export async function enrollMFA(): Promise<{
  data: MFAEnrollment | null;
  error: string | null;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "auth.genericError" };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator App",
  });

  if (error) {
    logger.warn("MFA enrollment failed", { context: "mfa/enroll", error });
    return { data: null, error: "mfa.enrollError" };
  }

  return {
    data: {
      factorId: data.id,
      totpUri: data.totp.uri,
      secret: data.totp.secret,
      qrCode: data.totp.qr_code,
    },
    error: null,
  };
}

/**
 * Verify a TOTP code to complete MFA enrollment.
 * This creates a verified factor on the user's account.
 */
export async function verifyMFAEnrollment(
  factorId: string,
  code: string,
): Promise<MFAVerifyResult> {
  const supabase = await createClient();

  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });

  if (challengeError) {
    logger.warn("MFA challenge failed during enrollment", {
      context: "mfa/verifyEnrollment",
      error: challengeError,
    });
    return { error: "mfa.verifyError" };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) {
    logger.warn("MFA verification failed during enrollment", {
      context: "mfa/verifyEnrollment",
      error: verifyError,
    });
    return { error: "mfa.invalidCode" };
  }

  // Log MFA enrollment for security audit
  const {
    data: { user },
  } = await supabase.auth.getUser();
  logAuthEvent({
    supabase,
    action: "mfa.enrolled",
    actor: user?.email ?? user?.id ?? "unknown",
    description: "TOTP MFA enrolled successfully",
    success: true,
  }).catch((err) => {
    logger.warn("Failed to log MFA enrollment event", {
      context: "mfa/verifyEnrollment",
      error: err,
    });
  });

  return { error: null };
}

/**
 * Verify a TOTP code during login (MFA challenge step).
 * On success, redirects to the appropriate dashboard.
 */
export async function verifyMFALogin(
  factorId: string,
  code: string,
): Promise<MFAVerifyResult> {
  const supabase = await createClient();

  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });

  if (challengeError) {
    logger.warn("MFA challenge failed during login", {
      context: "mfa/verifyLogin",
      error: challengeError,
    });
    return { error: "mfa.verifyError" };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) {
    return { error: "mfa.invalidCode" };
  }

  return { error: null };
}

/**
 * Unenroll (disable) a TOTP factor from the user's account.
 */
export async function unenrollMFA(
  factorId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.mfa.unenroll({ factorId });

  if (error) {
    logger.warn("MFA unenrollment failed", {
      context: "mfa/unenroll",
      error,
    });
    return { error: "mfa.unenrollError" };
  }

  // Log MFA unenrollment for security audit
  const {
    data: { user },
  } = await supabase.auth.getUser();
  logAuthEvent({
    supabase,
    action: "mfa.unenrolled",
    actor: user?.email ?? user?.id ?? "unknown",
    description: "TOTP MFA unenrolled",
    success: true,
  }).catch((err) => {
    logger.warn("Failed to log MFA unenrollment event", {
      context: "mfa/unenroll",
      error: err,
    });
  });

  return { error: null };
}

/**
 * Get the current user's MFA factors.
 * Returns verified TOTP factors if any exist.
 */
export async function getMFAFactors(): Promise<{
  factors: Array<{ id: string; friendlyName: string | null; status: string }>;
  error: string | null;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { factors: [], error: "auth.genericError" };
  }

  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) {
    logger.warn("Failed to list MFA factors", {
      context: "mfa/getFactors",
      error,
    });
    return { factors: [], error: "mfa.listError" };
  }

  const totpFactors = data.totp.map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    status: f.status,
  }));

  return { factors: totpFactors, error: null };
}

/**
 * Check if the current user has MFA enabled (at least one verified TOTP factor).
 */
export async function isMFAEnabled(): Promise<boolean> {
  const { factors } = await getMFAFactors();
  return factors.some((f) => f.status === "verified");
}

/**
 * Get the current MFA assurance level for the authenticated user.
 * Returns 'aal1' if only password was used, 'aal2' if MFA was verified.
 */
export async function getMFAAssuranceLevel(): Promise<{
  currentLevel: string | null;
  nextLevel: string | null;
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error) {
    return { currentLevel: null, nextLevel: null, error: error.message };
  }

  return {
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
    error: null,
  };
}

// ============================================================
// Backup Codes
// ============================================================

/**
 * Generate 10 one-time use backup codes.
 * These are stored as hashed values in the user's metadata.
 * Returns the plain-text codes for the user to save.
 */
export async function generateBackupCodes(): Promise<{
  codes: string[] | null;
  error: string | null;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { codes: null, error: "auth.genericError" };
  }

  // Generate 10 random 8-character backup codes
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const bytes = randomBytes(4);
    const code = bytes
      .toString("hex")
      .toUpperCase()
      .replace(/(.{4})(.{4})/, "$1-$2");
    codes.push(code);
  }

  // Store hashed codes in user metadata
  const { createHash } = await import("crypto");
  const hashedCodes = codes.map((code) =>
    createHash("sha256").update(code.replace("-", "")).digest("hex"),
  );

  const { error } = await supabase.auth.updateUser({
    data: {
      mfa_backup_codes: hashedCodes,
      mfa_backup_codes_generated_at: new Date().toISOString(),
    },
  });

  if (error) {
    logger.warn("Failed to store backup codes", {
      context: "mfa/generateBackupCodes",
      error,
    });
    return { codes: null, error: "mfa.backupCodeError" };
  }

  // Log backup code generation for security audit
  logAuthEvent({
    supabase,
    action: "mfa.backup_codes_generated",
    actor: user.email ?? user.id,
    description: "MFA backup codes generated",
    success: true,
  }).catch((err) => {
    logger.warn("Failed to log backup code generation", {
      context: "mfa/generateBackupCodes",
      error: err,
    });
  });

  return { codes, error: null };
}

/**
 * Verify a backup code during login.
 * Used codes are removed from the stored list.
 */
export async function verifyBackupCode(
  code: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "auth.genericError" };
  }

  const storedHashes =
    (user.user_metadata?.mfa_backup_codes as string[] | undefined) ?? [];
  if (storedHashes.length === 0) {
    return { error: "mfa.noBackupCodes" };
  }

  const { createHash } = await import("crypto");
  const inputHash = createHash("sha256")
    .update(code.replace("-", "").toUpperCase())
    .digest("hex");

  const matchIndex = storedHashes.findIndex((h) => h === inputHash);
  if (matchIndex === -1) {
    return { error: "mfa.invalidBackupCode" };
  }

  // Remove used code
  const remainingCodes = storedHashes.filter((_, i) => i !== matchIndex);
  const { error } = await supabase.auth.updateUser({
    data: { mfa_backup_codes: remainingCodes },
  });

  if (error) {
    logger.warn("Failed to update backup codes after use", {
      context: "mfa/verifyBackupCode",
      error,
    });
  }

  // Log backup code usage for security audit
  logAuthEvent({
    supabase,
    action: "mfa.backup_code_used",
    actor: user.email ?? user.id,
    description: `Backup code used (${remainingCodes.length} remaining)`,
    success: true,
  }).catch((err) => {
    logger.warn("Failed to log backup code usage", {
      context: "mfa/verifyBackupCode",
      error: err,
    });
  });

  return { error: null };
}
