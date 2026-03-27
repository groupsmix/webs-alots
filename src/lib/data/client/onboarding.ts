"use client";

import { createClient } from "@/lib/supabase-client";
import { getCurrentUser } from "./_core";
import type { Database } from "@/lib/types/database";

type Json = Database["public"]["Tables"]["users"]["Row"]["metadata"];

// ─────────────────────────────────────────────
// Onboarding state (stored in user metadata)
// ─────────────────────────────────────────────

export interface OnboardingState {
  hasCompletedOnboarding: boolean;
  tourDismissed: boolean;
  completedSteps: OnboardingStepId[];
}

export type OnboardingStepId =
  | "clinic_profile"
  | "add_services"
  | "add_doctors"
  | "set_working_hours"
  | "customize_website";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  checkLabel: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "clinic_profile",
    title: "Set up clinic profile",
    description: "Add your clinic name, address, phone number, and logo.",
    href: "/admin/settings",
    checkLabel: "Clinic profile configured",
  },
  {
    id: "add_services",
    title: "Add services & prices",
    description: "Define the medical services you offer and their pricing.",
    href: "/admin/services",
    checkLabel: "At least one service added",
  },
  {
    id: "add_doctors",
    title: "Add your doctors",
    description: "Add doctor profiles with specialties and consultation fees.",
    href: "/admin/doctors",
    checkLabel: "At least one doctor added",
  },
  {
    id: "set_working_hours",
    title: "Set working hours",
    description: "Configure your clinic's opening hours and availability.",
    href: "/admin/working-hours",
    checkLabel: "Working hours configured",
  },
  {
    id: "customize_website",
    title: "Customize your website",
    description: "Choose your branding, colors, and layout for your public site.",
    href: "/admin/branding",
    checkLabel: "Website customized",
  },
];

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  hasCompletedOnboarding: false,
  tourDismissed: false,
  completedSteps: [],
};

export async function fetchOnboardingState(): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) return DEFAULT_ONBOARDING_STATE;

  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", user.id)
    .single();

  const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
  const onboarding = (metadata.onboarding ?? {}) as Record<string, unknown>;

  return {
    hasCompletedOnboarding: (onboarding.has_completed_onboarding as boolean) ?? false,
    tourDismissed: (onboarding.tour_dismissed as boolean) ?? false,
    completedSteps: (onboarding.completed_steps as OnboardingStepId[]) ?? [],
  };
}

export async function updateOnboardingState(
  updates: Partial<OnboardingState>,
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = createClient();

  // Fetch current metadata first
  const { data: current } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", user.id)
    .single();

  const metadata = (current?.metadata ?? {}) as Record<string, unknown>;
  const onboarding = (metadata.onboarding ?? {}) as Record<string, unknown>;

  // Merge updates
  if (updates.hasCompletedOnboarding !== undefined) {
    onboarding.has_completed_onboarding = updates.hasCompletedOnboarding;
  }
  if (updates.tourDismissed !== undefined) {
    onboarding.tour_dismissed = updates.tourDismissed;
  }
  if (updates.completedSteps !== undefined) {
    onboarding.completed_steps = updates.completedSteps;
  }

  metadata.onboarding = onboarding;

  const { error } = await supabase
    .from("users")
    .update({ metadata: metadata as Json })
    .eq("id", user.id);

  return !error;
}

export async function markStepComplete(stepId: OnboardingStepId): Promise<boolean> {
  const state = await fetchOnboardingState();
  if (state.completedSteps.includes(stepId)) return true;

  const completedSteps = [...state.completedSteps, stepId];
  const allComplete = ONBOARDING_STEPS.every((s) => completedSteps.includes(s.id));

  return updateOnboardingState({
    completedSteps,
    hasCompletedOnboarding: allComplete,
  });
}

export async function dismissTour(): Promise<boolean> {
  return updateOnboardingState({ tourDismissed: true });
}

export async function resetTour(): Promise<boolean> {
  return updateOnboardingState({ tourDismissed: false });
}

/**
 * Auto-detect completed onboarding steps by checking existing data.
 * This avoids requiring the user to re-do steps they already completed.
 */
export async function autoDetectCompletedSteps(clinicId: string): Promise<OnboardingStepId[]> {
  const supabase = createClient();
  const completed: OnboardingStepId[] = [];

  const [clinicRes, servicesRes, doctorsRes] = await Promise.all([
    supabase.from("clinics").select("name, phone, address").eq("id", clinicId).single(),
    supabase.from("services").select("id").eq("clinic_id", clinicId).limit(1),
    supabase.from("users").select("id").eq("clinic_id", clinicId).eq("role", "doctor").limit(1),
  ]);

  // Check clinic profile
  const clinic = clinicRes.data as { name: string; phone: string | null; address: string | null } | null;
  if (clinic?.name && (clinic.phone || clinic.address)) {
    completed.push("clinic_profile");
  }

  // Check services
  if ((servicesRes.data?.length ?? 0) > 0) {
    completed.push("add_services");
  }

  // Check doctors
  if ((doctorsRes.data?.length ?? 0) > 0) {
    completed.push("add_doctors");
  }

  return completed;
}
