/**
 * Specialist dashboard configuration registry.
 *
 * Maps specialist-type URL slugs to their ClinicDashboardConfig.
 * Used by the consolidated (specialist) route group layout to render
 * the correct sidebar, nav items, and feature gates per specialist type.
 */

import {
  LayoutDashboard,
  // Nutritionist
  Apple,
  Scale,
  Calculator,
  // Optician
  Glasses,
  FileText,
  // Parapharmacy
  ShoppingBag,
  Receipt,
  // Physiotherapist
  Dumbbell,
  ClipboardList,
  Camera,
  // Psychologist
  Brain,
  Target,
  TrendingUp,
  // Speech Therapist
  BookOpen,
  // Radiology
  Scan,
  Image,
  Eye,
  FileStack,
  // Shared
  Package,
} from "lucide-react";
import type { ClinicDashboardConfig } from "@/components/layouts/clinic-dashboard-layout";
import { capabilityForSlug } from "@/lib/config/capabilities";

/**
 * P3: Specialist dashboards key off the canonical capability slugs defined in
 * `src/lib/config/capabilities.ts`. This registry covers the subset of
 * specialist surfaces that ship a dashboard config today; the canonical slug
 * spellings (incl. `speech-therapist`) come from that single source of truth.
 *
 * Not every capability slug needs a dashboard entry here (e.g. `pharmacist`
 * and `equipment` are gated surfaces without a config in this registry), but
 * every key below MUST be a valid canonical specialist slug — enforced by
 * `assertRegistrySlugsAreCanonical()` and the capabilities unit test.
 */
type SpecialistSlug =
  | "nutritionist"
  | "optician"
  | "parapharmacy"
  | "physiotherapist"
  | "psychologist"
  | "speech-therapist"
  | "radiology";

/** Registry of specialist dashboard configs keyed by URL slug. */
const specialistRegistry: Record<SpecialistSlug, ClinicDashboardConfig> = {
  nutritionist: {
    title: "spec.title.nutritionist",
    icon: Apple,
    accentColor: "green-600",
    featureKey: "meal_plans",
    moduleName: "Nutrition",
    navItems: [
      { href: "/nutritionist/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      {
        href: "/nutritionist/meal-plans",
        label: "spec.nav.mealPlans",
        icon: Apple,
        requiredFeature: "meal_plans",
      },
      {
        href: "/nutritionist/measurements",
        label: "spec.nav.bodyMeasurements",
        icon: Scale,
        requiredFeature: "body_measurements",
      },
      { href: "/nutritionist/bmi", label: "spec.nav.bmiCalculator", icon: Calculator },
    ],
    mobileTabs: [
      { href: "/nutritionist/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      { href: "/nutritionist/meal-plans", label: "spec.tab.meals", icon: Apple },
      { href: "/nutritionist/measurements", label: "spec.tab.measures", icon: Scale },
      { href: "/nutritionist/bmi", label: "spec.tab.bmi", icon: Calculator },
    ],
  },
  optician: {
    title: "spec.title.optician",
    icon: Glasses,
    accentColor: "blue-600",
    featureKey: "lens_inventory",
    moduleName: "Optician",
    navItems: [
      { href: "/optician/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      {
        href: "/optician/lens-inventory",
        label: "spec.nav.lensInventory",
        icon: Package,
        requiredFeature: "lens_inventory",
      },
      {
        href: "/optician/frame-catalog",
        label: "spec.nav.frameCatalog",
        icon: Glasses,
        requiredFeature: "frame_catalog",
      },
      {
        href: "/optician/prescriptions",
        label: "spec.nav.prescriptions",
        icon: FileText,
        requiredFeature: "optical_prescriptions",
      },
    ],
    mobileTabs: [
      { href: "/optician/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      { href: "/optician/lens-inventory", label: "spec.tab.lenses", icon: Package },
      { href: "/optician/frame-catalog", label: "spec.tab.frames", icon: Glasses },
      { href: "/optician/prescriptions", label: "spec.tab.rx", icon: FileText },
    ],
  },
  parapharmacy: {
    title: "spec.title.parapharmacy",
    icon: ShoppingBag,
    accentColor: "pink-600",
    featureKey: "parapharmacy",
    moduleName: "Parapharmacy",
    navItems: [
      { href: "/parapharmacy/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      { href: "/parapharmacy/catalog", label: "spec.nav.productCatalog", icon: ShoppingBag },
      { href: "/parapharmacy/sales", label: "spec.nav.sales", icon: Receipt },
      { href: "/parapharmacy/inventory", label: "spec.nav.inventory", icon: Package },
    ],
    mobileTabs: [
      { href: "/parapharmacy/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      { href: "/parapharmacy/catalog", label: "spec.tab.catalog", icon: ShoppingBag },
      { href: "/parapharmacy/sales", label: "spec.nav.sales", icon: Receipt },
      { href: "/parapharmacy/inventory", label: "spec.nav.inventory", icon: Package },
    ],
  },
  physiotherapist: {
    title: "spec.title.physiotherapist",
    icon: Dumbbell,
    accentColor: "teal-600",
    featureKey: "physio_sessions",
    moduleName: "Physiotherapy",
    navItems: [
      { href: "/physiotherapist/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      {
        href: "/physiotherapist/exercise-programs",
        label: "spec.nav.exercisePrograms",
        icon: Dumbbell,
        requiredFeature: "exercise_programs",
      },
      {
        href: "/physiotherapist/sessions",
        label: "spec.nav.sessionTracking",
        icon: ClipboardList,
        requiredFeature: "physio_sessions",
      },
      {
        href: "/physiotherapist/progress-photos",
        label: "spec.nav.progressPhotos",
        icon: Camera,
        requiredFeature: "progress_photos",
      },
    ],
    mobileTabs: [
      { href: "/physiotherapist/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      { href: "/physiotherapist/exercise-programs", label: "spec.tab.exercises", icon: Dumbbell },
      { href: "/physiotherapist/sessions", label: "spec.nav.sessions", icon: ClipboardList },
      { href: "/physiotherapist/progress-photos", label: "spec.tab.photos", icon: Camera },
    ],
  },
  psychologist: {
    title: "spec.title.psychologist",
    icon: Brain,
    accentColor: "purple-600",
    featureKey: "therapy_notes",
    moduleName: "Psychology",
    navItems: [
      { href: "/psychologist/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      {
        href: "/psychologist/session-notes",
        label: "spec.nav.sessionNotes",
        icon: Brain,
        requiredFeature: "therapy_notes",
      },
      {
        href: "/psychologist/therapy-plans",
        label: "spec.nav.therapyPlans",
        icon: Target,
        requiredFeature: "therapy_plans",
      },
      { href: "/psychologist/progress", label: "spec.nav.progressTracking", icon: TrendingUp },
    ],
    mobileTabs: [
      { href: "/psychologist/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      { href: "/psychologist/session-notes", label: "spec.tab.notes", icon: Brain },
      { href: "/psychologist/therapy-plans", label: "spec.tab.plans", icon: Target },
      { href: "/psychologist/progress", label: "spec.tab.progress", icon: TrendingUp },
    ],
  },
  "speech-therapist": {
    title: "spec.title.speechTherapist",
    icon: ClipboardList,
    accentColor: "orange-600",
    featureKey: "speech_sessions",
    moduleName: "Speech Therapy",
    navItems: [
      { href: "/speech-therapist/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      {
        href: "/speech-therapist/sessions",
        label: "spec.nav.sessions",
        icon: ClipboardList,
        requiredFeature: "speech_sessions",
      },
      {
        href: "/speech-therapist/exercise-library",
        label: "spec.nav.exerciseLibrary",
        icon: BookOpen,
        requiredFeature: "speech_exercises",
      },
      {
        href: "/speech-therapist/reports",
        label: "spec.nav.progressReports",
        icon: FileText,
        requiredFeature: "speech_reports",
      },
    ],
    mobileTabs: [
      { href: "/speech-therapist/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      { href: "/speech-therapist/sessions", label: "spec.nav.sessions", icon: ClipboardList },
      { href: "/speech-therapist/exercise-library", label: "spec.tab.exercises", icon: BookOpen },
      { href: "/speech-therapist/reports", label: "spec.nav.reports", icon: FileText },
    ],
  },
  radiology: {
    title: "spec.title.radiology",
    shortTitle: "spec.shortTitle.radiologyCenter",
    icon: Scan,
    accentColor: "indigo-600",
    featureKey: "radiology_reports",
    moduleName: "Radiology",
    navItems: [
      { href: "/radiology/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      { href: "/radiology/orders", label: "spec.nav.studyOrders", icon: ClipboardList },
      { href: "/radiology/images", label: "spec.nav.imageGallery", icon: Image },
      { href: "/radiology/viewer", label: "spec.nav.dicomViewer", icon: Eye },
      { href: "/radiology/reports", label: "spec.nav.reports", icon: FileText },
      { href: "/radiology/templates", label: "spec.nav.reportTemplates", icon: FileStack },
    ],
    mobileTabs: [
      { href: "/radiology/dashboard", label: "spec.nav.dashboard", icon: LayoutDashboard },
      { href: "/radiology/orders", label: "spec.tab.orders", icon: ClipboardList },
      { href: "/radiology/images", label: "spec.tab.images", icon: Image },
      { href: "/radiology/reports", label: "spec.nav.reports", icon: FileText },
    ],
  },
};

/**
 * Look up the specialist config for a given pathname.
 * Extracts the first URL segment and checks the registry.
 */
export function getSpecialistConfigFromPathname(pathname: string): ClinicDashboardConfig | null {
  // pathname looks like "/nutritionist/dashboard" → extract "nutritionist"
  const segments = pathname.split("/").filter(Boolean);
  const slug = segments[0] as SpecialistSlug;
  return specialistRegistry[slug] ?? null;
}

/** The specialist slugs that have a dashboard config in this registry. */
const REGISTRY_SPECIALIST_SLUGS = Object.keys(specialistRegistry) as SpecialistSlug[];

/**
 * Invariant guard: every slug with a dashboard config must resolve to exactly
 * one canonical capability in `capabilities.ts`.
 *
 * The authoritative enforcement of this invariant is the build-time test
 * `src/lib/__tests__/capabilities.test.ts`. This runtime check is a
 * DEV-ONLY belt-and-suspenders: it throws in development/test so drift is
 * caught immediately while iterating, but is a no-op in production so a small
 * config drift can never turn into a boot-time crash across the whole
 * dashboard surface. Returns the offending slug (or `null`) for testability.
 */
export function findNonCanonicalRegistrySlug(): string | null {
  for (const slug of REGISTRY_SPECIALIST_SLUGS) {
    if (capabilityForSlug(slug) === null) return slug;
  }
  return null;
}

// Dev-only fail-fast. In production this is skipped entirely; the unit test is
// the source of truth for the invariant.
// This module is imported from client components ("use client" layout shells),
// so it must not import the server-only `@/lib/env` module. `NODE_ENV` is
// inlined at build time by Next.js, making this a build-time constant check.
// nosemgrep: semgrep.env-access
if (process.env.NODE_ENV !== "production") {
  const bad = findNonCanonicalRegistrySlug();
  if (bad !== null) {
    throw new Error(
      `specialist-registry: slug "${bad}" is not a canonical capability slug ` +
        `in capabilities.ts (P3 drift).`,
    );
  }
}
