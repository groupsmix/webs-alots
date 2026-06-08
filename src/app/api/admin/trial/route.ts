/**
 * POST /api/admin/trial
 *
 * Starts a trial for a clinic. Called during onboarding.
 *
 * Body: { planSlug: "professional" | "enterprise", trialDays?: number }
 *
 * OWASP A01: withAuth restricts to super_admin only (trial assignment is privileged).
 * OWASP A04: All DB writes scoped to clinicId.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";
import type { AuthContext } from "@/lib/with-auth";

const trialStartSchema = z.object({
  clinicId: z.string().uuid("Invalid clinic ID"),
  planSlug: z.enum(["professional", "enterprise"]),
  trialDays: z.number().int().min(1).max(90).default(14),
});

export const POST = withAuthValidation(
  trialStartSchema,
  async (data, _request: NextRequest, auth: AuthContext) => {
    const supabase = createAdminClient("trial-start");

    // Verify target clinic exists
    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant write is intentional
    const { data: clinic, error: clinicError } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              k: string,
              v: string,
            ) => {
              single: () => Promise<{ data: { id: string; name: string } | null; error: unknown }>;
            };
          };
        };
      }
    )
      .from("clinics")
      .select("id, name")
      .eq("id", data.clinicId)
      .single();

    if (clinicError || !clinic) {
      return apiError("Clinic not found", 404, "CLINIC_NOT_FOUND");
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + data.trialDays * 24 * 60 * 60 * 1000);

    try {
      // Update clinic with trial dates
      // nosemgrep: semgrep.tenant-scoping — super_admin intentional cross-tenant write
      const adminSupa = supabase as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => {
            eq: (k: string, v: string) => Promise<{ error: unknown }>;
          };
          insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
        };
      };

      const { error: updateError } = await adminSupa
        .from("clinics")
        .update({
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
          tier: data.planSlug,
        })
        .eq("id", data.clinicId);

      if (updateError) {
        logger.error("Failed to set trial dates on clinic", {
          context: "api/admin/trial",
          clinicId: data.clinicId,
          error: updateError,
        });
        return apiInternalError("Failed to start trial");
      }

      // Log to subscription_history
      const { error: historyError } = await adminSupa.from("subscription_history").insert({
        clinic_id: data.clinicId,
        event_type: "trial_started",
        from_plan_slug: "free",
        to_plan_slug: data.planSlug,
        notes: `${data.trialDays}-day trial started by super_admin`,
        changed_by: auth.profile.id,
      });

      if (historyError) {
        logger.warn("Failed to log trial start to subscription_history", {
          context: "api/admin/trial",
          clinicId: data.clinicId,
        });
      }

      // Audit log
      void logAuditEvent({
        supabase: createAdminClient("audit"),
        action: "trial_started",
        type: "admin",
        clinicId: data.clinicId,
        clinicName: (clinic as { id: string; name: string }).name,
        actor: auth.profile.id,
        description: `${data.trialDays}-day ${data.planSlug} trial started`,
        metadata: {
          planSlug: data.planSlug,
          trialDays: data.trialDays,
          trialEndsAt: trialEndsAt.toISOString(),
        },
      });

      return apiSuccess({
        clinicId: data.clinicId,
        planSlug: data.planSlug,
        trialStartedAt: now.toISOString(),
        trialEndsAt: trialEndsAt.toISOString(),
        trialDays: data.trialDays,
      });
    } catch (err) {
      logger.error("Trial start failed", {
        context: "api/admin/trial",
        clinicId: data.clinicId,
        error: err instanceof Error ? err.message : String(err),
      });
      return apiInternalError("Failed to start trial");
    }
  },
  ["super_admin"],
);
