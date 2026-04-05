/**
 * DNS Management API — CRUD for clinic subdomain DNS records.
 *
 * GET    /api/dns?slug=xyz     — Check if a subdomain DNS record exists
 * POST   /api/dns              — Provision a new subdomain
 * DELETE /api/dns              — Remove a subdomain DNS record
 *
 * All endpoints require super_admin or clinic_admin role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiRateLimited } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import {
  provisionSubdomain,
  getDnsRecord,
  removeSubdomain,
  isValidSubdomain,
} from "@/lib/cloudflare-dns";
import { withAuth, type AuthContext } from "@/lib/with-auth";
import { apiMutationLimiter, extractClientIp } from "@/lib/rate-limit";

// ── Schemas ──

const provisionDnsSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
      "Subdomain must be lowercase alphanumeric with optional hyphens",
    ),
});

const deleteDnsSchema = z.object({
  slug: z.string().min(2).max(63),
});

// ── GET /api/dns?slug=xyz ──

export const GET = withAuth(
  async (request: NextRequest, _auth: AuthContext) => {
    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug || !isValidSubdomain(slug)) {
      return apiError("Invalid or missing slug parameter", 400, "INVALID_SLUG");
    }

    const result = await getDnsRecord(slug);
    if (!result.success) {
      return apiError(result.error ?? "DNS lookup failed", 502, "DNS_ERROR");
    }

    return apiSuccess({
      exists: result.data !== null,
      record: result.data,
    });
  },
  ["super_admin", "clinic_admin"],
);

// ── POST /api/dns ──

export const POST = withAuthValidation(
  provisionDnsSchema,
  async (body, request, auth) => {
    const clinicId = auth.profile.clinic_id;

    // MED-16: Rate limit DNS provisioning to prevent quota exhaustion.
    // 10 provisions per hour per user is generous for legitimate use.
    const ip = extractClientIp(request);
    const allowed = await apiMutationLimiter.check(`dns-provision:${auth.profile.id ?? ip}`);
    if (!allowed) {
      return apiRateLimited("Too many DNS provisioning requests. Please try again later.");
    }

    const result = await provisionSubdomain(body.slug);
    if (!result.success) {
      return apiError(
        result.error ?? "Failed to provision subdomain",
        502,
        "DNS_PROVISION_ERROR",
      );
    }

    if (clinicId) {
      await logAuditEvent({
        supabase: auth.supabase,
        action: "dns.subdomain_provisioned",
        type: "config",
        clinicId,
        description: `Subdomain provisioned: ${body.slug}`,
      });
    }

    return apiSuccess(result.data, 201);
  },
  ["super_admin", "clinic_admin"],
);

// ── DELETE /api/dns ──

export const DELETE = withAuthValidation(
  deleteDnsSchema,
  async (body, _request, auth) => {
    const clinicId = auth.profile.clinic_id;

    const result = await removeSubdomain(body.slug);
    if (!result.success) {
      return apiError(
        result.error ?? "Failed to remove subdomain",
        502,
        "DNS_REMOVE_ERROR",
      );
    }

    if (clinicId) {
      await logAuditEvent({
        supabase: auth.supabase,
        action: "dns.subdomain_removed",
        type: "config",
        clinicId,
        description: `Subdomain removed: ${body.slug}`,
      });
    }

    return apiSuccess({ removed: true });
  },
  ["super_admin", "clinic_admin"],
);
