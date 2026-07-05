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
    title: "Nutritionniste",
    icon: Apple,
    accentColor: "green-600",
    featureKey: "meal_plans",
    moduleName: "Nutrition",
    navItems: [
      { href: "/nutritionist/dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/nutritionist/meal-plans",
        label: "Meal Plans",
        icon: Apple,
        requiredFeature: "meal_plans",
      },
      {
        href: "/nutritionist/measurements",
        label: "Body Measurements",
        icon: Scale,
        requiredFeature: "body_measurements",
      },
      { href: "/nutritionist/bmi", label: "BMI Calculator", icon: Calculator },
    ],
    mobileTabs: [
      { href: "/nutritionist/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/nutritionist/meal-plans", label: "Meals", icon: Apple },
      { href: "/nutritionist/measurements", label: "Measures", icon: Scale },
      { href: "/nutritionist/bmi", label: "BMI", icon: Calculator },
    ],
  },
  optician: {
    title: "Opticien",
    icon: Glasses,
    accentColor: "blue-600",
    featureKey: "lens_inventory",
    moduleName: "Optician",
    navItems: [
      { href: "/optician/dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/optician/lens-inventory",
        label: "Lens Inventory",
        icon: Package,
        requiredFeature: "lens_inventory",
      },
      {
        href: "/optician/frame-catalog",
        label: "Frame Catalog",
        icon: Glasses,
        requiredFeature: "frame_catalog",
      },
      {
        href: "/optician/prescriptions",
        label: "Prescriptions",
        icon: FileText,
        requiredFeature: "optical_prescriptions",
      },
    ],
    mobileTabs: [
      { href: "/optician/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/optician/lens-inventory", label: "Lenses", icon: Package },
      { href: "/optician/frame-catalog", label: "Frames", icon: Glasses },
      { href: "/optician/prescriptions", label: "Rx", icon: FileText },
    ],
  },
  parapharmacy: {
    title: "Parapharmacy",
    icon: ShoppingBag,
    accentColor: "pink-600",
    featureKey: "parapharmacy",
    moduleName: "Parapharmacy",
    navItems: [
      { href: "/parapharmacy/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/parapharmacy/catalog", label: "Product Catalog", icon: ShoppingBag },
      { href: "/parapharmacy/sales", label: "Sales", icon: Receipt },
      { href: "/parapharmacy/inventory", label: "Inventory", icon: Package },
    ],
    mobileTabs: [
      { href: "/parapharmacy/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/parapharmacy/catalog", label: "Catalog", icon: ShoppingBag },
      { href: "/parapharmacy/sales", label: "Sales", icon: Receipt },
      { href: "/parapharmacy/inventory", label: "Inventory", icon: Package },
    ],
  },
  physiotherapist: {
    title: "Kinésithérapeute",
    icon: Dumbbell,
    accentColor: "teal-600",
    featureKey: "physio_sessions",
    moduleName: "Physiotherapy",
    navItems: [
      { href: "/physiotherapist/dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/physiotherapist/exercise-programs",
        label: "Exercise Programs",
        icon: Dumbbell,
        requiredFeature: "exercise_programs",
      },
      {
        href: "/physiotherapist/sessions",
        label: "Session Tracking",
        icon: ClipboardList,
        requiredFeature: "physio_sessions",
      },
      {
        href: "/physiotherapist/progress-photos",
        label: "Progress Photos",
        icon: Camera,
        requiredFeature: "progress_photos",
      },
    ],
    mobileTabs: [
      { href: "/physiotherapist/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/physiotherapist/exercise-programs", label: "Exercises", icon: Dumbbell },
      { href: "/physiotherapist/sessions", label: "Sessions", icon: ClipboardList },
      { href: "/physiotherapist/progress-photos", label: "Photos", icon: Camera },
    ],
  },
  psychologist: {
    title: "Psychologue",
    icon: Brain,
    accentColor: "purple-600",
    featureKey: "therapy_notes",
    moduleName: "Psychology",
    navItems: [
      { href: "/psychologist/dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/psychologist/session-notes",
        label: "Session Notes",
        icon: Brain,
        requiredFeature: "therapy_notes",
      },
      {
        href: "/psychologist/therapy-plans",
        label: "Therapy Plans",
        icon: Target,
        requiredFeature: "therapy_plans",
      },
      { href: "/psychologist/progress", label: "Progress Tracking", icon: TrendingUp },
    ],
    mobileTabs: [
      { href: "/psychologist/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/psychologist/session-notes", label: "Notes", icon: Brain },
      { href: "/psychologist/therapy-plans", label: "Plans", icon: Target },
      { href: "/psychologist/progress", label: "Progress", icon: TrendingUp },
    ],
  },
  "speech-therapist": {
    title: "Orthophoniste",
    icon: ClipboardList,
    accentColor: "orange-600",
    featureKey: "speech_sessions",
    moduleName: "Speech Therapy",
    navItems: [
      { href: "/speech-therapist/dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/speech-therapist/sessions",
        label: "Sessions",
        icon: ClipboardList,
        requiredFeature: "speech_sessions",
      },
      {
        href: "/speech-therapist/exercise-library",
        label: "Exercise Library",
        icon: BookOpen,
        requiredFeature: "speech_exercises",
      },
      {
        href: "/speech-therapist/reports",
        label: "Progress Reports",
        icon: FileText,
        requiredFeature: "speech_reports",
      },
    ],
    mobileTabs: [
      { href: "/speech-therapist/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/speech-therapist/sessions", label: "Sessions", icon: ClipboardList },
      { href: "/speech-therapist/exercise-library", label: "Exercises", icon: BookOpen },
      { href: "/speech-therapist/reports", label: "Reports", icon: FileText },
    ],
  },
  radiology: {
    title: "Radiology",
    shortTitle: "Radiology Center",
    icon: Scan,
    accentColor: "indigo-600",
    featureKey: "radiology_reports",
    moduleName: "Radiology",
    navItems: [
      { href: "/radiology/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/radiology/orders", label: "Study Orders", icon: ClipboardList },
      { href: "/radiology/images", label: "Image Gallery", icon: Image },
      { href: "/radiology/viewer", label: "DICOM Viewer", icon: Eye },
      { href: "/radiology/reports", label: "Reports", icon: FileText },
      { href: "/radiology/templates", label: "Report Templates", icon: FileStack },
    ],
    mobileTabs: [
      { href: "/radiology/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/radiology/orders", label: "Orders", icon: ClipboardList },
      { href: "/radiology/images", label: "Images", icon: Image },
      { href: "/radiology/reports", label: "Reports", icon: FileText },
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
