import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  getOnboardingProgress,
  type ClinicSpecialty,
} from "@/lib/onboarding/flows";

type UntypedSupabase = SupabaseClient<any, any, any>;

type OwnerOnboardingStatus = "pending" | "in_progress" | "completed" | "abandoned";

type ExistingOnboardingRow = {
  id: string;
  current_step: string;
  completed_steps: string[] | null;
  nudge_count: number | null;
};

export interface SyncClinicOnboardingStateInput {
  supabase: SupabaseClient;
  clinicId: string;
  clinicName: string;
  specialty?: ClinicSpecialty | string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  completedSteps?: string[];
  currentStep?: string | null;
  status?: OwnerOnboardingStatus;
  completionPercentage?: number;
  legalDocUploaded?: boolean;
  extractedLegalData?: Record<string, unknown> | null;
  goLiveMessage?: string | null;
  assignedAccountManager?: string | null;
  nudgeCountDelta?: number;
  lastNudgeAt?: string | null;
}

function onboardingTable(supabase: SupabaseClient) {
  return (supabase as UntypedSupabase).from("clinic_onboardings");
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSpecialty(value?: string | null): ClinicSpecialty | undefined {
  switch (value) {
    case "general_medicine":
    case "dental":
    case "cardiology":
    case "pediatrics":
    case "pharmacy":
    case "dermatology":
    case "other":
      return value;
    default:
      return undefined;
  }
}

export async function syncClinicOnboardingState({
  supabase,
  clinicId,
  clinicName,
  specialty,
  contactName,
  contactPhone,
  contactEmail,
  completedSteps = [],
  currentStep,
  status,
  completionPercentage,
  legalDocUploaded,
  extractedLegalData,
  goLiveMessage,
  assignedAccountManager,
  nudgeCountDelta = 0,
  lastNudgeAt,
}: SyncClinicOnboardingStateInput): Promise<void> {
  const table = onboardingTable(supabase);
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await table
    .select("id, current_step, completed_steps, nudge_count")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    logger.warn("Failed to load onboarding state", {
      context: "onboarding/state",
      clinicId,
      error: existingError.message,
    });
  }

  const existingRow = (existing as ExistingOnboardingRow | null) ?? null;
  const mergedCompletedSteps = [
    ...new Set([...(existingRow?.completed_steps ?? []), ...completedSteps].filter(Boolean)),
  ];
  const normalizedSpecialty = normalizeSpecialty(specialty);
  const progress = getOnboardingProgress(mergedCompletedSteps, normalizedSpecialty);

  const resolvedCurrentStep = currentStep ?? progress.nextStep?.id ?? "go_live";
  const resolvedStatus = status ?? (progress.nextStep ? "in_progress" : "completed");
  const resolvedCompletionPercentage = clampPercentage(
    completionPercentage ?? (resolvedStatus === "completed" ? 100 : progress.percentage),
  );
  const nudgeCount = Math.max(0, Number(existingRow?.nudge_count ?? 0) + nudgeCountDelta);

  const payload: Record<string, unknown> = {
    clinic_id: clinicId,
    clinic_name: clinicName,
    specialty: specialty ?? null,
    contact_name: contactName ?? null,
    contact_phone: contactPhone ?? null,
    contact_email: contactEmail ?? null,
    current_step: resolvedCurrentStep,
    completed_steps: mergedCompletedSteps,
    status: resolvedStatus,
    completion_percentage: resolvedCompletionPercentage,
    nudge_count: nudgeCount,
    updated_at: now,
  };

  if (!existingRow || existingRow.current_step !== resolvedCurrentStep) {
    payload.step_entered_at = now;
  }
  if (typeof legalDocUploaded === "boolean") {
    payload.legal_doc_uploaded = legalDocUploaded;
  }
  if (extractedLegalData !== undefined) {
    payload.extracted_legal_data = extractedLegalData;
  }
  if (goLiveMessage !== undefined) {
    payload.go_live_message = goLiveMessage;
  }
  if (assignedAccountManager !== undefined) {
    payload.assigned_account_manager = assignedAccountManager;
  }
  if (lastNudgeAt !== undefined) {
    payload.last_nudge_at = lastNudgeAt;
  }

  if (existingRow) {
    const { error: updateError } = await table.update(payload).eq("id", existingRow.id);
    if (updateError) {
      logger.warn("Failed to update onboarding state", {
        context: "onboarding/state",
        clinicId,
        error: updateError.message,
      });
    }
    return;
  }

  const { error: insertError } = await table.insert({
    ...payload,
    created_at: now,
  });

  if (insertError) {
    logger.warn("Failed to create onboarding state", {
      context: "onboarding/state",
      clinicId,
      error: insertError.message,
    });
  }
}
