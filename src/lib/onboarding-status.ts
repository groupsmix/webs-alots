/**
 * Onboarding status tracking utilities.
 *
 * Extends the existing onboarding infrastructure to track
 * the 5-step setup wizard completion state.
 */

import type { OnboardingStepId } from "@/lib/data/client/onboarding";

// ---------------------------------------------------------------------------
// Step mapping — maps wizard steps to the existing OnboardingStepId enum
// ---------------------------------------------------------------------------

export const WIZARD_STEP_MAP: Record<string, OnboardingStepId> = {
  profile: "add_doctors",
  branding: "customize_website",
  services: "add_services",
  schedule: "set_working_hours",
  invite: "clinic_profile", // receptionist invite maps to clinic_profile completion
};

export const WIZARD_STEPS = [
  { id: "profile", label: "Profil du docteur", onboardingId: "add_doctors" as OnboardingStepId },
  { id: "branding", label: "Identité visuelle", onboardingId: "customize_website" as OnboardingStepId },
  { id: "services", label: "Services & tarifs", onboardingId: "add_services" as OnboardingStepId },
  { id: "schedule", label: "Horaires de travail", onboardingId: "set_working_hours" as OnboardingStepId },
  { id: "invite", label: "Inviter un(e) assistant(e)", onboardingId: "clinic_profile" as OnboardingStepId },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate onboarding completion percentage from completed step IDs.
 */
export function getOnboardingProgress(completedSteps: OnboardingStepId[]): number {
  if (completedSteps.length === 0) return 0;

  const totalSteps = WIZARD_STEPS.length;
  const completed = WIZARD_STEPS.filter((step) =>
    completedSteps.includes(step.onboardingId),
  ).length;

  return Math.round((completed / totalSteps) * 100);
}

/**
 * Check if onboarding is fully complete.
 */
export function isOnboardingComplete(completedSteps: OnboardingStepId[]): boolean {
  return getOnboardingProgress(completedSteps) === 100;
}

/**
 * Get the next incomplete step (for resuming the wizard).
 */
export function getNextIncompleteStep(
  completedSteps: OnboardingStepId[],
): (typeof WIZARD_STEPS)[number] | null {
  for (const step of WIZARD_STEPS) {
    if (!completedSteps.includes(step.onboardingId)) {
      return step;
    }
  }
  return null;
}

/**
 * Get a summary of onboarding status for dashboard display.
 */
export function getOnboardingStatusSummary(completedSteps: OnboardingStepId[]) {
  const progress = getOnboardingProgress(completedSteps);
  const isComplete = progress === 100;
  const nextStep = isComplete ? null : getNextIncompleteStep(completedSteps);

  return {
    progress,
    isComplete,
    nextStep,
    completedCount: WIZARD_STEPS.filter((s) =>
      completedSteps.includes(s.onboardingId),
    ).length,
    totalSteps: WIZARD_STEPS.length,
    steps: WIZARD_STEPS.map((step) => ({
      ...step,
      completed: completedSteps.includes(step.onboardingId),
    })),
  };
}
