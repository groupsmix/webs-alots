/**
 * POST /api/super-admin/clinics/:id/domain
 *
 * Verifies that a clinic's custom domain has a CNAME record pointing to
 * clinics.oltigo.com, then persists the domain as verified.
 *
 * Only super_admin may call this endpoint.
 * Cross-tenant access is intentional — super admins manage all clinic domains.
 */

import { resolveCname } from "dns/promises";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const domainSchema = z.object({
  domain: z
    .string()
    .min(4)
    .max(253)
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Invalid domain format"),
});

export const POST = withAuth(
  async (request: NextRequest, { supabase, profile }: AuthContext) => {
    // Extract clinic id from URL: /api/super-admin/clinics/{id}/domain
    const clinicId = new URL(request.url).pathname.split("/").at(-2) ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(clinicId)) return apiNotFound();

    // Parse and validate request body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    const parsed = domainSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Validation error",
        422,
        "VALIDATION_ERROR",
      );
    }

    const { domain } = parsed.data;

    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("id", clinicId)
      .maybeSingle();

    if (!clinic) return apiNotFound("Clinic not found");

    // Verify the CNAME record resolves to the Oltigo platform
    let cnameVerified = false;
    try {
      const records = await resolveCname(domain);
      cnameVerified = records.some(
        (r) => r.endsWith("clinics.oltigo.com") || r.endsWith("oltigo.com"),
      );
    } catch {
      // NXDOMAIN, ENOTFOUND, timeout — treat as mismatch
      cnameVerified = false;
    }

    if (!cnameVerified) {
      return apiError(
        "CNAME ne pointe pas vers clinics.oltigo.com",
        400,
        "CNAME_MISMATCH",
      );
    }

    // Persist the verified domain
    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant update
    const { error: updateError } = await supabase
      .from("clinics")
      .update({ custom_domain: domain, domain_status: "verified" })
      .eq("id", clinicId);

    if (updateError) {
      return apiError("Failed to update clinic domain", 500);
    }

    await logAuditEvent({
      supabase,
      action: "custom_domain_verified",
      type: "config",
      clinicId,
      actor: profile.id,
      description: `Custom domain ${domain} verified for clinic ${clinicId}`,
      metadata: { domain, clinicId },
    });

    return apiSuccess({ verified: true, domain });
  },
  ["super_admin"],
);
