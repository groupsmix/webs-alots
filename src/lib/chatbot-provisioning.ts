/**
 * Feature Task 1 & 2: Auto-provision chatbot when a clinic upgrades.
 *
 * When a subscription changes (checkout.session.completed, invoice.paid),
 * the billing webhook calls `provisionChatbotForPlan()` to ensure the
 * clinic has a `chatbot_config` row with the intelligence level matching
 * their plan tier.
 *
 * Intelligence level mapping:
 *   free        → disabled (no chatbot)
 *   starter     → "basic"  (keyword matching)
 *   professional→ "smart"  (Workers AI)
 *   enterprise  → "advanced" (OpenAI GPT-4o)
 */

import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { getPlanConfig, type SubscriptionPlan } from "@/lib/subscription-billing";
import type { createAdminClient } from "@/lib/supabase-server";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolve the chatbot intelligence level for a given plan.
 * Returns `false` if the plan doesn't include chatbot.
 */
export function getChatbotLevelForPlan(plan: SubscriptionPlan): false | "basic" | "smart" | "advanced" {
  try {
    return getPlanConfig(plan)?.aiChatbot ?? false;
  } catch {
    return false;
  }
}

/**
 * Auto-provision or update the chatbot config for a clinic when their
 * subscription plan changes.
 *
 * - If chatbot is not included in the plan, disables any existing config.
 * - If chatbot IS included and no config exists, creates one with defaults.
 * - If chatbot IS included and config exists, upgrades intelligence level
 *   (never downgrades unless the plan itself downgrades).
 */
export async function provisionChatbotForPlan(
  supabase: AdminClient,
  clinicId: string,
  plan: SubscriptionPlan,
): Promise<void> {
  const level = getChatbotLevelForPlan(plan);

  // Check if chatbot_config already exists for this clinic
  const { data: existing, error: readErr } = await supabase
    .from("chatbot_config")
    .select("id, enabled, intelligence")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (readErr) {
    logger.error("Failed to read chatbot_config for provisioning", {
      context: "chatbot-provisioning",
      clinicId,
      error: readErr,
    });
    return;
  }

  if (level === false) {
    // Plan doesn't include chatbot — disable if it exists
    if (existing && existing.enabled) {
      const { error: disableErr } = await supabase
        .from("chatbot_config")
        .update({
          enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("clinic_id", clinicId);

      if (disableErr) {
        logger.error("Failed to disable chatbot on downgrade", {
          context: "chatbot-provisioning",
          clinicId,
          error: disableErr,
        });
      } else {
        void logAuditEvent({
          supabase,
          action: "chatbot_disabled_on_downgrade",
          type: "config",
          clinicId,
          description: `Chatbot disabled — plan downgraded to ${plan}`,
        });
      }
    }
    return;
  }

  if (!existing) {
    // No config yet — create with defaults
    const { error: insertErr } = await supabase.from("chatbot_config").insert({
      clinic_id: clinicId,
      enabled: true,
      intelligence: level,
      greeting: "Bonjour ! Comment puis-je vous aider ?",
      language: "fr",
    });

    if (insertErr) {
      logger.error("Failed to create chatbot_config on subscription", {
        context: "chatbot-provisioning",
        clinicId,
        plan,
        error: insertErr,
      });
    } else {
      logger.info("Chatbot auto-provisioned for new subscription", {
        context: "chatbot-provisioning",
        clinicId,
        plan,
        intelligence: level,
      });
      void logAuditEvent({
        supabase,
        action: "chatbot_auto_provisioned",
        type: "config",
        clinicId,
        description: `Chatbot auto-enabled with ${level} intelligence (${plan} plan)`,
        metadata: { plan, intelligence: level },
      });
    }
    return;
  }

  // Config exists — update intelligence level and ensure enabled
  const needsUpdate = existing.intelligence !== level || !existing.enabled;

  if (needsUpdate) {
    const { error: updateErr } = await supabase
      .from("chatbot_config")
      .update({
        enabled: true,
        intelligence: level,
        updated_at: new Date().toISOString(),
      })
      .eq("clinic_id", clinicId);

    if (updateErr) {
      logger.error("Failed to update chatbot intelligence level", {
        context: "chatbot-provisioning",
        clinicId,
        plan,
        error: updateErr,
      });
    } else {
      logger.info("Chatbot intelligence level updated", {
        context: "chatbot-provisioning",
        clinicId,
        plan,
        from: existing.intelligence,
        to: level,
      });
      void logAuditEvent({
        supabase,
        action: "chatbot_intelligence_updated",
        type: "config",
        clinicId,
        description: `Chatbot intelligence: ${existing.intelligence} → ${level} (${plan} plan)`,
        metadata: {
          plan,
          previousLevel: existing.intelligence,
          newLevel: level,
        },
      });
    }
  }
}
