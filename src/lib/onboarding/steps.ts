/**
 * Onboarding wizard step definitions.
 *
 * Provides a structured multi-step onboarding flow for new clinics,
 * tracking completion state per clinic.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type OnboardingStepId =
  | "clinic_profile"
  | "working_hours"
  | "staff_invite"
  | "services_setup"
  | "payment_config"
  | "notification_config"
  | "first_appointment";

export type StepStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  required: boolean;
  order: number;
  estimatedMinutes: number;
}

export interface OnboardingProgress {
  clinicId: string;
  steps: Record<OnboardingStepId, StepStatus>;
  startedAt: string;
  completedAt: string | null;
  completionPercent: number;
}

// ─── Step Definitions ────────────────────────────────────────────────────────

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "clinic_profile",
    title: "Profil de la clinique",
    description: "Configurez le nom, l'adresse, et les coordonnées de votre clinique",
    required: true,
    order: 1,
    estimatedMinutes: 3,
  },
  {
    id: "working_hours",
    title: "Horaires de travail",
    description: "Définissez les horaires d'ouverture et les créneaux de consultation",
    required: true,
    order: 2,
    estimatedMinutes: 5,
  },
  {
    id: "staff_invite",
    title: "Inviter l'équipe",
    description: "Ajoutez vos médecins, réceptionnistes et autres membres",
    required: true,
    order: 3,
    estimatedMinutes: 5,
  },
  {
    id: "services_setup",
    title: "Services et tarifs",
    description: "Configurez les types de consultation et leurs tarifs",
    required: true,
    order: 4,
    estimatedMinutes: 10,
  },
  {
    id: "payment_config",
    title: "Configuration paiement",
    description: "Connectez votre compte Stripe ou CMI pour les paiements en ligne",
    required: false,
    order: 5,
    estimatedMinutes: 5,
  },
  {
    id: "notification_config",
    title: "Notifications",
    description: "Configurez les rappels WhatsApp et emails pour vos patients",
    required: false,
    order: 6,
    estimatedMinutes: 5,
  },
  {
    id: "first_appointment",
    title: "Premier rendez-vous",
    description: "Créez votre premier rendez-vous pour valider le système",
    required: true,
    order: 7,
    estimatedMinutes: 2,
  },
];

// ─── Implementation ──────────────────────────────────────────────────────────

export function createOnboardingProgress(clinicId: string): OnboardingProgress {
  const steps: Record<string, StepStatus> = {};
  for (const step of ONBOARDING_STEPS) {
    steps[step.id] = "pending";
  }

  return {
    clinicId,
    steps: steps as Record<OnboardingStepId, StepStatus>,
    startedAt: new Date().toISOString(),
    completedAt: null,
    completionPercent: 0,
  };
}

export function updateStepStatus(
  progress: OnboardingProgress,
  stepId: OnboardingStepId,
  status: StepStatus,
): OnboardingProgress {
  const updated = { ...progress, steps: { ...progress.steps, [stepId]: status } };
  updated.completionPercent = calculateCompletion(updated);

  const allRequired = ONBOARDING_STEPS.filter((s) => s.required);
  const allRequiredDone = allRequired.every(
    (s) => updated.steps[s.id] === "completed" || updated.steps[s.id] === "skipped",
  );

  if (allRequiredDone && !updated.completedAt) {
    updated.completedAt = new Date().toISOString();
  }

  return updated;
}

export function getNextStep(progress: OnboardingProgress): OnboardingStep | null {
  for (const step of ONBOARDING_STEPS) {
    if (progress.steps[step.id] === "pending") {
      return step;
    }
  }
  return null;
}

export function calculateCompletion(progress: OnboardingProgress): number {
  const total = ONBOARDING_STEPS.length;
  const done = Object.values(progress.steps).filter(
    (s) => s === "completed" || s === "skipped",
  ).length;
  return Math.round((done / total) * 100);
}

export function getEstimatedRemainingMinutes(progress: OnboardingProgress): number {
  return ONBOARDING_STEPS.filter(
    (s) => progress.steps[s.id] === "pending" || progress.steps[s.id] === "in_progress",
  ).reduce((sum, s) => sum + s.estimatedMinutes, 0);
}
