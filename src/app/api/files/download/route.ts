/**
 * GET /api/files/download — Authenticated download of an encrypted PHI file
 *
 * Query params:
 *   - key: R2 object key (without `.enc` suffix), e.g.
 *          `clinics/{clinicId}/lab-reports/{timestamp}-{rand}-{hash}.html`
 *
 * Authorization
 *   1. Caller must be authenticated (handled by `withAuthAnyRole`).
 *   2. Caller must belong to the clinic that owns the key (super_admin
 *      may access any `clinics/...` key).
 *   3. The role check above is intentionally lenient (any authenticated
 *      role) so that patients can fetch reports they themselves are
 *      tied to via tenant scoping. Tenant prefix enforcement is the
 *      primary access control here, mirroring `expectedKeyPrefixForProfile`
 *      in the upload-confirm route.
 *
 * Decryption: encrypted blobs (with `.enc` suffix) are pulled from R2,
 * decrypted via `downloadAndDecrypt`, and streamed back with a derived
 * Content-Type. The R2 URL itself is never exposed to the caller.
 *
 * Auditing: every successful download is recorded via `logAuditEvent`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { apiError, apiForbidden, apiInternalError, apiNotFound } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { downloadAndDecrypt } from "@/lib/r2-encrypted";
import type { UserRole } from "@/lib/types/database";
import { withAuthAnyRole, type AuthContext } from "@/lib/with-auth";

const ALLOWED_DOWNLOAD_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  "super_admin",
  "clinic_admin",
  "receptionist",
  "doctor",
  "patient",
]);

/**
 * Compute the R2 key prefix the authenticated profile is allowed to read.
 * Mirrors `expectedKeyPrefixForProfile` in the upload-confirm route so that
 * upload-side and download-side authorization stay in lockstep.
 *
 * Returns `null` when the profile has no clinic and isn't a super_admin —
 * such a user cannot legitimately read any encrypted file.
 */
export function expectedDownloadPrefixForProfile(
  role: UserRole,
  clinicId: string | null | undefined,
): string | null {
  if (role === "super_admin") return "clinics/";
  if (clinicId) return `clinics/${clinicId}/`;
  return null;
}

/**
 * Pick a Content-Type from the underlying object key extension. The encrypted
 * blob doesn't preserve MIME type metadata, so we derive it from the key.
 *
 * Defaults to `application/octet-stream` for unknown extensions so the
 * browser falls back to the Content-Disposition filename.
 */
export function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html; charset=utf-8";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

/**
 * Reject keys with traversal segments or absolute paths. The R2 helper
 * `buildUploadKey` already sanitizes inputs, but this is defense-in-depth
 * for any caller-supplied key.
 */
export function isSafeKey(key: string): boolean {
  if (!key) return false;
  if (key.startsWith("/")) return false;
  if (key.includes("..")) return false;
  if (key.includes("\0")) return false;
  return true;
}

/**
 * Extract the clinic UUID from a tenant-scoped key (`clinics/{clinicId}/...`).
 * Used for audit logging when the caller's profile has no `clinic_id`
 * (e.g. super_admin) so that PHI access is still attributed to the
 * clinic that owns the file. Returns `null` for keys that don't match
 * the expected shape.
 */
export function extractClinicIdFromKey(key: string): string | null {
  const match = /^clinics\/([0-9a-fA-F-]{36})\//.exec(key);
  return match ? match[1] : null;
}

async function handler(request: NextRequest, { supabase, profile }: AuthContext): Promise<NextResponse> {
  if (!ALLOWED_DOWNLOAD_ROLES.has(profile.role)) {
    return apiForbidden();
  }

  const rawKey = request.nextUrl.searchParams.get("key");
  if (!rawKey) {
    return apiError("Missing 'key' query parameter", 400, "MISSING_KEY");
  }

  if (!isSafeKey(rawKey)) {
    return apiError("Invalid key", 400, "INVALID_KEY");
  }

  // Strip a `.enc` suffix if a caller passed one — `downloadAndDecrypt`
  // will append it again. We compare prefixes against the unsuffixed key.
  const baseKey = rawKey.endsWith(".enc") ? rawKey.slice(0, -4) : rawKey;

  const allowedPrefix = expectedDownloadPrefixForProfile(profile.role, profile.clinic_id);
  if (!allowedPrefix || !baseKey.startsWith(allowedPrefix)) {
    logger.warn("Cross-tenant download attempt blocked", {
      context: "api/files/download",
      role: profile.role,
      profileClinicId: profile.clinic_id,
      keyPrefix: baseKey.split("/").slice(0, 2).join("/"),
    });
    return apiForbidden("File belongs to a different clinic");
  }

  const plaintext = await downloadAndDecrypt(baseKey);
  if (!plaintext) {
    return apiNotFound("File not found or could not be decrypted");
  }

  // Audit the access. We do not include the file body in the audit metadata.
  // Privileged access (super_admin) MUST also be logged — for those callers
  // we attribute the event to the clinic that owns the key, which is parsed
  // from the `clinics/{clinicId}/...` prefix. Compliance with Moroccan Law
  // 09-08 requires that PHI access be auditable; silently skipping audit
  // writes when `profile.clinic_id` is null would create a privileged
  // back-door.
  const auditClinicId =
    profile.clinic_id ?? extractClinicIdFromKey(baseKey);

  if (auditClinicId) {
    await logAuditEvent({
      supabase,
      action: "file_downloaded",
      type: "patient",
      clinicId: auditClinicId,
      actor: profile.id,
      description: `Downloaded encrypted file ${baseKey}`,
      metadata: {
        key: baseKey,
        role: profile.role,
        // Flag privileged cross-tenant access explicitly in the audit trail.
        crossTenant: profile.clinic_id !== auditClinicId,
        callerClinicId: profile.clinic_id ?? null,
      },
    }).catch((err) => {
      logger.warn("Failed to log file download audit event", {
        context: "api/files/download",
        error: err,
      });
    });
  } else {
    // Should not happen in practice — `allowedPrefix` enforcement above
    // guarantees the key starts with `clinics/{uuid}/` for any caller we
    // got this far with. Log a warning so we notice if it ever does.
    logger.warn("File download served without auditable clinic context", {
      context: "api/files/download",
      role: profile.role,
      keyPrefix: baseKey.split("/").slice(0, 2).join("/"),
    });
  }

  const filename = baseKey.split("/").pop() ?? "download";
  const contentType = contentTypeForKey(baseKey);

  // Force `inline` for HTML so existing UI flows (window.open) render the
  // report; everything else is offered as an attachment so the browser
  // doesn't try to execute or interpret arbitrary PHI bytes.
  const disposition = contentType.startsWith("text/html") ? "inline" : "attachment";

  // Cast the Node Buffer through `unknown` so it satisfies the Web BodyInit
  // type used by NextResponse — Buffers are streamable in Next.js but TS
  // doesn't model that overlap.
  const body = plaintext as unknown as BodyInit;

  try {
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(plaintext.byteLength),
        "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, "")}"`,
        // Short-lived private cache: PHI must not be cached by intermediaries.
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    logger.error("Failed to build download response", {
      context: "api/files/download",
      key: baseKey,
      error: err,
    });
    return apiInternalError("Download failed");
  }
}

export const GET = withAuthAnyRole(handler);
