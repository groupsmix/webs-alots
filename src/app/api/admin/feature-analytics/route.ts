/**
 * GET /api/admin/feature-analytics — Feature adoption & chatbot usage by plan tier
 *
 * Feature Task 5: Returns per-plan feature adoption rates, chatbot usage by
 * intelligence level, and top/underutilized features for business intelligence.
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

interface ChatbotStats {
  total: number;
  enabled: number;
  byIntelligence: Record<string, number>;
}

interface TierBreakdown {
  tier: string;
  clinicCount: number;
  chatbotEnabled: number;
  chatbotAdoptionPct: number;
}

async function handleGet(_request: NextRequest, _auth: AuthContext) {
  try {
    // nosemgrep: semgrep.tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    // 1. Chatbot adoption overview
    // nosemgrep: semgrep.tenant-scoping
    const { data: chatbotRows, error: chatbotErr } = await supabase
      .from("chatbot_config")
      .select("clinic_id, enabled, intelligence");

    if (chatbotErr) {
      logger.error("Failed to fetch chatbot configs", {
        context: "feature-analytics",
        error: chatbotErr,
      });
      return apiInternalError("Failed to fetch feature analytics");
    }

    const chatbotStats: ChatbotStats = {
      total: chatbotRows?.length ?? 0,
      enabled: 0,
      byIntelligence: {},
    };

    for (const row of chatbotRows ?? []) {
      if (row.enabled) {
        chatbotStats.enabled++;
        const level = row.intelligence ?? "unknown";
        chatbotStats.byIntelligence[level] = (chatbotStats.byIntelligence[level] ?? 0) + 1;
      }
    }

    // 2. Per-tier breakdown
    // nosemgrep: semgrep.tenant-scoping
    const { data: clinics, error: clinicsErr } = await supabase.from("clinics").select("id, tier");

    if (clinicsErr) {
      logger.error("Failed to fetch clinics for tier breakdown", {
        context: "feature-analytics",
        error: clinicsErr,
      });
      return apiInternalError("Failed to fetch feature analytics");
    }

    // Build set of clinic IDs with chatbot enabled
    const chatbotEnabledSet = new Set(
      (chatbotRows ?? []).filter((r) => r.enabled).map((r) => r.clinic_id),
    );

    // Group clinics by tier
    const tierGroups: Record<string, string[]> = {};
    for (const clinic of clinics ?? []) {
      const tier = (clinic.tier as string) ?? "unknown";
      if (!tierGroups[tier]) tierGroups[tier] = [];
      tierGroups[tier].push(clinic.id as string);
    }

    const tierBreakdown: TierBreakdown[] = Object.entries(tierGroups)
      .map(([tier, ids]) => {
        const chatbotEnabled = ids.filter((id) => chatbotEnabledSet.has(id)).length;
        return {
          tier,
          clinicCount: ids.length,
          chatbotEnabled,
          chatbotAdoptionPct: ids.length > 0 ? Math.round((chatbotEnabled / ids.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.clinicCount - a.clinicCount);

    // 3. Total clinic count for context
    const totalClinics = clinics?.length ?? 0;

    return apiSuccess({
      totalClinics,
      chatbot: chatbotStats,
      tierBreakdown,
    });
  } catch (err) {
    logger.error("Unexpected error in feature analytics", {
      context: "feature-analytics",
      error: err,
    });
    return apiInternalError("Failed to fetch feature analytics");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
