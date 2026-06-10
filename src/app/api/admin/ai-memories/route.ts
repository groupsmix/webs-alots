/**
 * GET /api/admin/ai-memories — List AI memories for the clinic
 * DELETE /api/admin/ai-memories — Delete a specific memory by ID
 *
 * Clinic-scoped: memories belong to the authenticated clinic only.
 * Access: clinic_admin, super_admin
 */

import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createScopedAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";

export const GET = withAuth(
  async (_request: NextRequest, _auth: AuthContext) => {
    const tenant = await requireTenant();

    try {
      const supabase = createUntypedAdminClient("ai-memory", tenant.clinicId);
      const { data, error } = await supabase
        .from("ai_memories")
        .select("id, clinic_id, agent_type, content, confidence, last_used_at, created_at")
        .eq("clinic_id", tenant.clinicId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        logger.error("Failed to fetch AI memories", {
          context: "admin/ai-memories",
          clinicId: tenant.clinicId,
          error: error.message,
        });
        return apiError("Erreur lors du chargement des mémoires", 500);
      }

      return apiSuccess({ memories: data ?? [] });
    } catch (err) {
      logger.error("AI memories list error", {
        context: "admin/ai-memories",
        error: err instanceof Error ? err.message : String(err),
      });
      return apiError("Erreur interne", 500);
    }
  },
  ["super_admin", "clinic_admin"],
);

export const DELETE = withAuth(
  async (request: NextRequest, _auth: AuthContext) => {
    const tenant = await requireTenant();

    let body: { id?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return apiError("Corps JSON invalide", 400, "INVALID_JSON");
    }

    if (!body.id || typeof body.id !== "string") {
      return apiError("L'identifiant de la mémoire est requis", 400, "MISSING_ID");
    }

    try {
      const supabase = createUntypedAdminClient("ai-memory", tenant.clinicId);

      // Delete only if it belongs to this clinic (defense in depth)
      const { error } = await supabase
        .from("ai_memories")
        .delete()
        .eq("id", body.id)
        .eq("clinic_id", tenant.clinicId);

      if (error) {
        logger.error("Failed to delete AI memory", {
          context: "admin/ai-memories",
          clinicId: tenant.clinicId,
          error: error.message,
        });
        return apiError("Erreur lors de la suppression", 500);
      }

      // Audit the deletion
      const auditClient = createScopedAdminClient("ai-memory", tenant.clinicId);
      await logAuditEvent({
        supabase: auditClient,
        action: "ai_memory_deleted",
        type: "admin",
        clinicId: tenant.clinicId,
        description: `Memory ${body.id} deleted by admin`,
        metadata: { memoryId: body.id },
      });

      return apiSuccess({ deleted: true });
    } catch (err) {
      logger.error("AI memory delete error", {
        context: "admin/ai-memories",
        error: err instanceof Error ? err.message : String(err),
      });
      return apiError("Erreur interne", 500);
    }
  },
  ["super_admin", "clinic_admin"],
);
