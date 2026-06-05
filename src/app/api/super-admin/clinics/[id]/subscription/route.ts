/**
 * PATCH /api/super-admin/clinics/:id/subscription
 *
 * Updates the subscription tier for a clinic. Super admin only.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiNotFound, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const schema = z.object({
  tier: z.enum(["trial", "starter", "pro", "enterprise"]),
});

export const PATCH = (request: NextRequest, context: { params: Promise<{ id: string }> }) =>
  withAuth(
    async (req: NextRequest, { supabase, profile }: AuthContext) => {
      const { id } = await context.params;

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return apiValidationError("Invalid JSON body");
      }

      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return apiValidationError(
          parsed.error.issues.map((e: { message: string }) => e.message).join(", "),
        );
      }

      const { tier } = parsed.data;

      // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant update
      const { data, error } = await supabase
        .from("clinics")
        .update({ tier })
        .eq("id", id)
        .select("id")
        .single();

      if (error || !data) {
        return apiNotFound("Clinic not found");
      }

      await logAuditEvent({
        supabase,
        action: "subscription_tier_changed",
        type: "admin",
        clinicId: id,
        description: `Subscription tier changed to ${tier} by super_admin ${profile.id}`,
        metadata: { newTier: tier, adminId: profile.id },
      });

      return apiSuccess({ updated: true });
    },
    ["super_admin"],
  )(request);
