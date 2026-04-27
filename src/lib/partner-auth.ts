/**
 * F-33: Partner API key authentication for /api/v1/* endpoints.
 *
 * Partners authenticate via `Authorization: Bearer <api_key>` header.
 * Keys are stored hashed (SHA-256) in a `partner_api_keys` table
 * scoped by clinic_id.
 *
 * Usage in route handlers:
 *   const partner = await verifyPartnerApiKey(request);
 *   if (!partner) return apiError("Unauthorized", 401);
 */

import { logger } from "@/lib/logger";

interface PartnerKeyResult {
  partnerId: string;
  clinicId: string;
  partnerName: string;
}

/**
 * Verify a partner API key from the Authorization header.
 * Returns partner details if valid, null if invalid or missing.
 *
 * Note: This requires the `partner_api_keys` table to exist.
 * Until it's created, this function returns null (graceful degradation).
 */
export async function verifyPartnerApiKey(
  request: Request,
): Promise<PartnerKeyResult | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  if (!apiKey || apiKey.length < 32) return null;

  try {
    // Hash the key for comparison
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Look up the hashed key in the database
    const { createAdminClient } = await import("@/lib/supabase-server");
    const supabase = createAdminClient();

    // Table may not exist yet — use `as never` to bypass type checking
    // since partner_api_keys is not in the generated DB types.
    const { data, error } = await supabase
      .from("partner_api_keys" as never)
      .select("id, clinic_id, partner_name" as never)
      .eq("key_hash" as never, hashHex as never)
      .eq("is_active" as never, true as never)
      .maybeSingle();

    if (error) {
      const pgError = error as { code?: string };
      // Table might not exist yet
      if (pgError.code === "42P01") {
        logger.debug("partner_api_keys table not created yet", {
          context: "partner-auth",
        });
        return null;
      }
      logger.error("Partner API key lookup failed", {
        context: "partner-auth",
        error,
      });
      return null;
    }

    if (!data) return null;

    const row = data as unknown as {
      id: string;
      clinic_id: string;
      partner_name: string;
    };

    return {
      partnerId: row.id,
      clinicId: row.clinic_id,
      partnerName: row.partner_name,
    };
  } catch (err) {
    logger.error("Partner API key verification error", {
      context: "partner-auth",
      error: err,
    });
    return null;
  }
}
