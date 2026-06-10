/**
 * GET /api/cron/ai-memory-consolidate
 *
 * Weekly consolidation cron: per clinic, reviews all AI memories,
 * merges duplicates, rewrites vague entries, deletes stale/low-confidence.
 * Logs a diff to audit log.
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 *
 * OWASP A04: Scoped per-clinic — no cross-tenant data.
 * OWASP A07: Rate-limited by cron infrastructure.
 */

import { type NextRequest } from "next/server";
import { consolidateMemories } from "@/lib/ai/memory";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import {
  createAdminClient,
  createScopedAdminClient,
  createUntypedAdminClient,
} from "@/lib/supabase-server";

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    // Cross-tenant by design: cron iterates all active clinics.
    const supabase = createAdminClient("ai-memory-consolidate"); // nosemgrep: semgrep.admin-client-guard

    // Get all active clinics
    const { data: clinics, error: clinicsErr } = await supabase
      .from("clinics")
      .select("id")
      .eq("status", "active");

    if (clinicsErr || !clinics) {
      logger.error("Failed to fetch clinics for memory consolidation", {
        context: "cron/ai-memory-consolidate",
        error: clinicsErr?.message,
      });
      return apiInternalError("Failed to fetch clinics");
    }

    let totalMerged = 0;
    let totalDeleted = 0;
    let totalRewritten = 0;

    for (const clinic of clinics) {
      // Untyped for ai_memories (not in generated types)
      const untypedClient = createUntypedAdminClient("ai-memory-consolidate", clinic.id);
      // Typed for audit log
      const scopedClient = createScopedAdminClient("ai-memory-consolidate", clinic.id);

      const stats = await consolidateMemories(untypedClient, clinic.id);

      if (stats.merged > 0 || stats.deleted > 0 || stats.rewritten > 0) {
        totalMerged += stats.merged;
        totalDeleted += stats.deleted;
        totalRewritten += stats.rewritten;

        // Audit log the consolidation
        await logAuditEvent({
          supabase: scopedClient,
          action: "ai_memory_consolidated",
          type: "admin",
          clinicId: clinic.id,
          description: `Memory consolidation: ${stats.merged} merged, ${stats.deleted} deleted, ${stats.rewritten} rewritten`,
          metadata: stats,
        });
      }
    }

    logger.info("Memory consolidation cron completed", {
      context: "cron/ai-memory-consolidate",
      totalMerged,
      totalDeleted,
      totalRewritten,
    });

    return apiSuccess({
      merged: totalMerged,
      deleted: totalDeleted,
      rewritten: totalRewritten,
      message: `Consolidation: ${totalMerged} merged, ${totalDeleted} deleted, ${totalRewritten} rewritten`,
    });
  } catch (err) {
    logger.error("Memory consolidation cron failed", {
      context: "cron/ai-memory-consolidate",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("Memory consolidation cron failed");
  }
}

// Runs weekly on Sunday at 03:00 UTC
export const GET = withSentryCron("ai-memory-consolidate", "0 3 * * 0", handler);
