/**
 * Custom Domain Management API for White-Label Support
 *
 * GET    /api/branding/custom-domain — List custom domains for the clinic
 * POST   /api/branding/custom-domain — Add a custom domain
 * DELETE /api/branding/custom-domain — Remove a custom domain
 *
 * Uses Cloudflare for SaaS (Custom Hostnames) to provision SSL
 * and route traffic for clinic-owned domains.
 *
 * Requires clinic_admin or super_admin role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { createCustomHostname, deleteCustomHostname } from "@/lib/cloudflare-custom-hostnames";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import { withAuth, type AuthContext } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

// ── GET — list custom domains for the clinic ──

async function handleGet(_request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;

    const { data, error } = await supabase
      .from("custom_domains")
      .select("id, domain, status, ssl_status, verification_txt, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch custom domains", { clinicId, error });
      return apiInternalError();
    }

    return apiSuccess({ domains: data ?? [] });
  } catch (error) {
    logger.error("Custom domain GET failed", { error });
    return apiInternalError();
  }
}

export const GET = withAuth(handleGet, ADMIN_ROLES);

// ── POST — add a custom domain ──

const addDomainSchema = z.object({
  domain: z
    .string()
    .min(4)
    .max(253)
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i, "Invalid domain format"),
});

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;

    const body = await request.json();
    const parsed = addDomainSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400, "VALIDATION_ERROR");
    }

    const { domain } = parsed.data;

    const { data: existing } = await supabase
      .from("custom_domains")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();

    if (existing) {
      return apiError("This domain is already registered", 409, "DOMAIN_EXISTS");
    }

    const cfResult = await createCustomHostname(domain);

    const verificationTxt = cfResult.data?.ownership_verification?.value ?? null;
    const sslStatus = cfResult.data?.ssl?.status ?? "pending";

    const { data: inserted, error: insertError } = await supabase
      .from("custom_domains")
      .insert({
        clinic_id: clinicId,
        domain,
        status: cfResult.success ? "pending" : "failed",
        cloudflare_custom_hostname_id: cfResult.data?.id ?? null,
        ssl_status: sslStatus,
        verification_txt: verificationTxt,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert custom domain record", {
        clinicId,
        domain,
        error: insertError,
      });
      return apiInternalError();
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "custom_domain_added",
      type: "config",
      clinicId,
      actor: auth.profile.id,
      description: `Custom domain ${domain} added`,
      metadata: { domain, cloudflareId: cfResult.data?.id ?? null },
    });

    return apiSuccess({
      domain: inserted,
      cloudflareStatus: cfResult.success ? "provisioning" : "failed",
      error: cfResult.error ?? null,
    });
  } catch (error) {
    logger.error("Custom domain POST failed", { error });
    return apiInternalError();
  }
}

export const POST = withAuth(handlePost, ADMIN_ROLES);

// ── DELETE — remove a custom domain ──

const deleteDomainSchema = z.object({
  domainId: z.string().uuid(),
});

async function handleDelete(request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;

    const body = await request.json();
    const parsed = deleteDomainSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400, "VALIDATION_ERROR");
    }

    const { domainId } = parsed.data;

    const { data: domainRecord } = await supabase
      .from("custom_domains")
      .select("id, domain, cloudflare_custom_hostname_id")
      .eq("id", domainId)
      .eq("clinic_id", clinicId)
      .single();

    if (!domainRecord) {
      return apiError("Domain not found", 404, "NOT_FOUND");
    }

    if (domainRecord.cloudflare_custom_hostname_id) {
      await deleteCustomHostname(domainRecord.cloudflare_custom_hostname_id);
    }

    const { error: deleteError } = await supabase
      .from("custom_domains")
      .delete()
      .eq("id", domainId)
      .eq("clinic_id", clinicId);

    if (deleteError) {
      logger.error("Failed to delete custom domain record", {
        clinicId,
        domainId,
        error: deleteError,
      });
      return apiInternalError();
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "custom_domain_removed",
      type: "config",
      clinicId,
      actor: auth.profile.id,
      description: `Custom domain ${domainRecord.domain} removed`,
      metadata: { domain: domainRecord.domain },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Custom domain DELETE failed", { error });
    return apiInternalError();
  }
}

export const DELETE = withAuth(handleDelete, ADMIN_ROLES);
