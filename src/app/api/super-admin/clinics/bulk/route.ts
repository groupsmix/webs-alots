/**
 * POST /api/super-admin/clinics/bulk
 *
 * Bulk operations on clinics for super admins:
 *   - suspend         → set status = "suspended"
 *   - announce        → send a WhatsApp message to each clinic owner
 *   - change_status   → set status to active | suspended | inactive  (needs `value`)
 *   - change_tier     → set the subscription tier                    (needs `value`)
 *   - enable_feature  → upsert a clinic feature override (enabled)    (needs `value`)
 *
 * Super admin only.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { createAdminClient } from "@/lib/supabase-server";
import { sendTextMessage } from "@/lib/whatsapp";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const VALUE_ACTIONS = ["change_status", "change_tier", "enable_feature"] as const;
const CLINIC_STATUSES = ["active", "suspended", "inactive"] as const;

const bodySchema = z
  .object({
    action: z.enum(["suspend", "announce", "change_status", "change_tier", "enable_feature"]),
    ids: z.array(z.string().uuid()).min(1).max(50),
    message: z.string().max(1000).optional(),
    /** Target value for change_status / change_tier / enable_feature. */
    value: z.string().min(1).max(100).optional(),
  })
  .refine((d) => d.action !== "announce" || !!d.message, {
    message: "Message required for announce",
  })
  .refine((d) => !VALUE_ACTIONS.includes(d.action as (typeof VALUE_ACTIONS)[number]) || !!d.value, {
    message: "value is required for this action",
  })
  .refine(
    (d) => d.action !== "change_status" || CLINIC_STATUSES.includes(d.value as never),
    { message: `status must be one of: ${CLINIC_STATUSES.join(", ")}` },
  );

export const POST = withAuth(
  async (request: NextRequest, { supabase, profile }: AuthContext) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "),
      );
    }

    const { action, ids, message, value } = parsed.data;

    // Use admin client to bypass RLS for cross-tenant super_admin operations.
    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant
    const adminClient = createAdminClient("super_admin");

    if (action === "suspend") {
      const { error } = await adminClient
        .from("clinics")
        .update({ status: "suspended" })
        .in("id", ids);

      if (error) {
        return apiError("Failed to suspend clinics", 500);
      }

      await logAuditEvent({
        supabase,
        action: "clinics_bulk_suspended",
        type: "admin",
        clinicId: ids[0]!,
        actor: profile.id,
        description: `${ids.length} clinic(s) suspended by super_admin ${profile.id}`,
        metadata: { count: ids.length },
      });
    }

    if (action === "announce") {
      const { data: clinics, error: fetchError } = await adminClient
        .from("clinics")
        .select("id, owner_phone")
        .in("id", ids);

      if (fetchError) {
        return apiError("Failed to fetch clinics", 500);
      }

      const targets = (clinics ?? []).filter((c) => c.owner_phone);
      const results = await Promise.allSettled(
        targets.map((c) => sendTextMessage(c.owner_phone!, message!)),
      );

      const successCount = results.filter((r) => r.status === "fulfilled").length;

      await logAuditEvent({
        supabase,
        action: "clinics_bulk_announced",
        type: "admin",
        clinicId: ids[0]!,
        actor: profile.id,
        description: `Announcement sent to ${targets.length} clinic(s) by super_admin ${profile.id}`,
        metadata: { count: ids.length, successCount },
      });
    }

    if (action === "change_status") {
      const { error } = await adminClient
        .from("clinics")
        .update({ status: value as (typeof CLINIC_STATUSES)[number] })
        .in("id", ids);

      if (error) {
        return apiError("Failed to update clinic status", 500);
      }

      await logAuditEvent({
        supabase,
        action: "clinics_bulk_status_changed",
        type: "admin",
        clinicId: ids[0]!,
        actor: profile.id,
        description: `${ids.length} clinic(s) set to status "${value}" by super_admin ${profile.id}`,
        metadata: { count: ids.length, status: value },
      });
    }

    if (action === "change_tier") {
      const { error } = await adminClient
        .from("clinics")
        .update({ tier: value })
        .in("id", ids);

      if (error) {
        return apiError("Failed to update clinic tier", 500);
      }

      await logAuditEvent({
        supabase,
        action: "clinics_bulk_tier_changed",
        type: "admin",
        clinicId: ids[0]!,
        actor: profile.id,
        description: `${ids.length} clinic(s) moved to tier "${value}" by super_admin ${profile.id}`,
        metadata: { count: ids.length, tier: value },
      });
    }

    if (action === "enable_feature") {
      const rows = ids.map((id) => ({ clinic_id: id, feature_key: value!, enabled: true }));
      const { error } = await adminClient
        .from("clinic_feature_overrides")
        .upsert(rows, { onConflict: "clinic_id,feature_key" });

      if (error) {
        return apiError("Failed to enable feature", 500);
      }

      await logAuditEvent({
        supabase,
        action: "clinics_bulk_feature_enabled",
        type: "config",
        clinicId: ids[0]!,
        actor: profile.id,
        description: `Feature "${value}" enabled for ${ids.length} clinic(s) by super_admin ${profile.id}`,
        metadata: { count: ids.length, feature: value },
      });
    }

    return apiSuccess({ processed: ids.length });
  },
  ["super_admin"],
);
