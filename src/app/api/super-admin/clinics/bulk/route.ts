/**
 * POST /api/super-admin/clinics/bulk
 *
 * Bulk operations on clinics: suspend or send a WhatsApp announcement.
 * Super admin only.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { createAdminClient } from "@/lib/supabase-server";
import { sendTextMessage } from "@/lib/whatsapp";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const bodySchema = z
  .object({
    action: z.enum(["suspend", "announce"]),
    ids: z.array(z.string().uuid()).min(1).max(50),
    message: z.string().max(1000).optional(),
  })
  .refine((d) => d.action !== "announce" || !!d.message, {
    message: "Message required for announce",
  });

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
        parsed.error.errors.map((e) => e.message).join(", "),
      );
    }

    const { action, ids, message } = parsed.data;

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

    return apiSuccess({ processed: ids.length });
  },
  ["super_admin"],
);
