"use client";

import {
  LayoutDashboard, Apple, Scale, Calculator,
} from "lucide-react";
import {
  ClinicDashboardLayout,
  type ClinicDashboardConfig,
} from "@/components/layouts/clinic-dashboard-layout";

const config: ClinicDashboardConfig = {
  title: "Nutritionniste",
  icon: Apple,
  accentColor: "green-600",
  featureKey: "meal_plans",
  moduleName: "Nutrition",
  navItems: [
    { href: "/nutritionist/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/nutritionist/meal-plans", label: "Meal Plans", icon: Apple, requiredFeature: "meal_plans" },
    { href: "/nutritionist/measurements", label: "Body Measurements", icon: Scale, requiredFeature: "body_measurements" },
    { href: "/nutritionist/bmi", label: "BMI Calculator", icon: Calculator },
  ],
};

export default function NutritionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClinicDashboardLayout config={config}>
      {children}
    </ClinicDashboardLayout>
  );
}
