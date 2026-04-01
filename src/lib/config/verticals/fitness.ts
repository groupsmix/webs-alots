/**
 * Fitness vertical definition.
 *
 * Covers gyms, personal training, yoga studios, and sports facilities.
 */

import type { VerticalDefinition } from "@/lib/config/verticals";

export const fitnessVertical: VerticalDefinition = {
  id: "fitness",
  nameEn: "Fitness",
  nameFr: "Fitness & Sport",
  nameAr: "اللياقة البدنية",
  icon: "Dumbbell",
  categories: ["para_medical"],
  defaultFeatures: [
    "appointments",
    "exercise_programs",
    "meal_plans",
    "body_measurements",
    "progress_photos",
  ],
  defaultServices: [
    { name: "Séance coaching personnel", duration_minutes: 60, price: 300 },
    { name: "Cours collectif", duration_minutes: 45, price: 100 },
    { name: "Bilan forme", duration_minutes: 30, price: 200 },
    { name: "Programme personnalisé", duration_minutes: 60, price: 500 },
  ],
  terminology: {
    client: "member",
    provider: "trainer",
    appointment: "session",
    location: "gym",
  },
  templatePresets: [
    "fitness-bold",
    "fitness-modern",
  ],
};
