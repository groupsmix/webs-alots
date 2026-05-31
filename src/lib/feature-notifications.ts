/**
 * Feature Task 3: Feature Activation Notifications
 *
 * Sends in-app notifications to clinic admins when features are
 * activated, deactivated, or upgraded for their clinic.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";

type FeatureAction = "enabled" | "disabled" | "upgraded" | "downgraded";

interface FeatureNotificationParams {
  supabase: SupabaseClient<Database>;
  clinicId: string;
  featureName: string;
  action: FeatureAction;
  details?: string;
}

const ACTION_TITLES: Record<FeatureAction, string> = {
  enabled: "Nouvelle fonctionnalité disponible",
  disabled: "Fonctionnalité désactivée",
  upgraded: "Fonctionnalité améliorée",
  downgraded: "Fonctionnalité rétrogradée",
};

/**
 * Send in-app notification to all clinic_admin users in a clinic
 * when a feature is activated/deactivated/changed.
 */
export async function notifyFeatureChange(params: FeatureNotificationParams): Promise<void> {
  const { supabase, clinicId, featureName, action, details } = params;

  try {
    // Find all clinic_admin users for this clinic
    const { data: admins, error: adminErr } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("role", "clinic_admin");

    if (adminErr || !admins?.length) {
      logger.warn("No clinic admins found for feature notification", {
        context: "feature-notifications",
        clinicId,
        error: adminErr,
      });
      return;
    }

    const title = ACTION_TITLES[action];
    const body = details
      ? `${featureName}: ${details}`
      : `${featureName} a été ${action === "enabled" ? "activée" : action === "disabled" ? "désactivée" : action === "upgraded" ? "améliorée" : "rétrogradée"} pour votre clinique.`;

    // Insert one notification per admin
    const rows = admins.map((admin) => ({
      clinic_id: clinicId,
      user_id: admin.id,
      type: "feature_change",
      channel: "in_app" as const,
      title,
      body,
      is_read: false,
      sent_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await supabase.from("notifications").insert(rows);

    if (insertErr) {
      logger.error("Failed to insert feature notifications", {
        context: "feature-notifications",
        clinicId,
        featureName,
        error: insertErr,
      });
      return;
    }

    logger.info("Feature change notifications sent", {
      context: "feature-notifications",
      clinicId,
      featureName,
      action,
      recipientCount: admins.length,
    });
  } catch (err) {
    logger.error("Feature notification dispatch failed", {
      context: "feature-notifications",
      clinicId,
      error: err,
    });
  }
}
