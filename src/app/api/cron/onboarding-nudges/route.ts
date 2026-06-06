import { NextRequest } from "next/server";
import { loadProviderConfigs, routeAIRequest, AllProvidersFailedError } from "@/lib/ai/router";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { syncClinicOnboardingState } from "@/lib/onboarding/state";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import { sendTextMessage } from "@/lib/whatsapp";

type StalledOnboarding = {
  clinic_id: string;
  clinic_name: string;
  specialty: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  current_step: string;
  status: string;
  completion_percentage: number;
  nudge_count: number;
  step_entered_at: string;
};

const STALLED_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const MIN_GAP_BETWEEN_NUDGES_MS = 2 * 24 * 60 * 60 * 1000;

function buildFallbackNudge(row: StalledOnboarding, daysStuck: number): string {
  const stepLabel = row.current_step.replace(/_/g, " ");
  const contactName = row.contact_name?.trim() || row.clinic_name;
  return [
    `Bonjour ${contactName},`,
    `votre onboarding Oltigo est bloqué sur l'étape "${stepLabel}" depuis ${daysStuck} jour(s).`,
    "Si vous répondez aujourd'hui, nous pouvons vous aider à finaliser la configuration et accélérer votre mise en ligne.",
    "Répondez simplement à ce message ou contactez votre interlocuteur Oltigo pour la prochaine action.",
  ].join(" ");
}

async function generateNudge(
  admin: ReturnType<typeof createUntypedAdminClient>,
  row: StalledOnboarding,
  daysStuck: number,
): Promise<string> {
  const fallback = buildFallbackNudge(row, daysStuck);

  try {
    const configs = await loadProviderConfigs(admin);
    const aiResponse = await routeAIRequest(
      {
        task: "summarize",
        complexity: "simple",
        prompt: `Rédige un nudge d'onboarding en français pour une clinique Oltigo.\n\nContexte:\n${JSON.stringify(
          {
            clinicName: row.clinic_name,
            specialty: row.specialty,
            contactName: row.contact_name,
            currentStep: row.current_step,
            completionPercentage: row.completion_percentage,
            daysStuck,
            previousNudges: row.nudge_count,
          },
          null,
          2,
        )}\n\nContraintes:\n- 2 à 4 phrases maximum\n- ton professionnel et chaleureux\n- une seule action claire\n- pas de PHI\n- pas de promesse non vérifiable`,
        systemPrompt:
          "You are a SaaS onboarding assistant. Use only the provided data. Respond in French.",
        maxTokens: 180,
        temperature: 0.3,
        context: "onboarding-nudges",
      },
      configs,
      admin,
    );

    return aiResponse.text.trim() || fallback;
  } catch (error) {
    if (!(error instanceof AllProvidersFailedError)) {
      logger.warn("AI onboarding nudge failed, using fallback", {
        context: "cron/onboarding-nudges",
        clinicId: row.clinic_id,
        error,
      });
    }
    return fallback;
  }
}

async function sendNudge(
  row: StalledOnboarding,
  message: string,
): Promise<"whatsapp" | "email" | "skipped"> {
  if (row.contact_phone) {
    await sendTextMessage(row.contact_phone, message);
    return "whatsapp";
  }

  if (row.contact_email) {
    await sendEmail({
      to: row.contact_email,
      subject: `Onboarding Oltigo — prochaine étape pour ${row.clinic_name}`,
      html: `<p>${message}</p>`,
    });
    return "email";
  }

  return "skipped";
}

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const admin = createUntypedAdminClient("cron");
  const auditClient = createAdminClient("cron");

  try {
    const { data, error } = await admin
      .from("clinic_onboardings")
      .select(
        "clinic_id, clinic_name, specialty, contact_name, contact_phone, contact_email, current_step, status, completion_percentage, nudge_count, step_entered_at, last_nudge_at",
      )
      .in("status", ["pending", "in_progress"])
      .lt("step_entered_at", new Date(Date.now() - STALLED_AFTER_MS).toISOString())
      .or(
        `last_nudge_at.is.null,last_nudge_at.lt.${new Date(Date.now() - MIN_GAP_BETWEEN_NUDGES_MS).toISOString()}`,
      )
      .order("step_entered_at", { ascending: true })
      .limit(50);

    if (error) {
      logger.error("Failed to load stalled onboardings", {
        context: "cron/onboarding-nudges",
        error: error.message,
      });
      return apiInternalError("Failed to load stalled onboardings");
    }

    const rows = (data ?? []) as StalledOnboarding[];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      const daysStuck = Math.max(
        1,
        Math.round((Date.now() - new Date(row.step_entered_at).getTime()) / (24 * 60 * 60 * 1000)),
      );

      try {
        const message = await generateNudge(admin, row, daysStuck);
        const channel = await sendNudge(row, message);

        if (channel === "skipped") {
          skipped++;
          continue;
        }

        await syncClinicOnboardingState({
          supabase: admin,
          clinicId: row.clinic_id,
          clinicName: row.clinic_name,
          specialty: row.specialty,
          contactName: row.contact_name,
          contactPhone: row.contact_phone,
          contactEmail: row.contact_email,
          currentStep: row.current_step,
          status: row.status === "pending" ? "pending" : "in_progress",
          completionPercentage: row.completion_percentage,
          nudgeCountDelta: 1,
          lastNudgeAt: new Date().toISOString(),
          goLiveMessage: message,
        });

        await logAuditEvent({
          supabase: auditClient,
          action: "clinic_onboarding_nudged",
          type: "admin",
          actor: "system",
          clinicId: row.clinic_id,
          description: `Sent onboarding nudge via ${channel}`,
          metadata: {
            currentStep: row.current_step,
            daysStuck,
            channel,
          },
        });

        sent++;
      } catch (sendError) {
        failed++;
        logger.warn("Failed to send onboarding nudge", {
          context: "cron/onboarding-nudges",
          clinicId: row.clinic_id,
          error: sendError,
        });
      }
    }

    return apiSuccess({ processed: rows.length, sent, skipped, failed });
  } catch (error) {
    logger.error("Onboarding nudges cron failed", {
      context: "cron/onboarding-nudges",
      error,
    });
    return apiInternalError("Failed to process onboarding nudges");
  }
}

export const GET = withSentryCron("onboarding-nudges", "0 8 * * *", handler);
