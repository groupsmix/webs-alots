/**
 * Beauty vertical definition.
 *
 * Covers salons, spas, aesthetic clinics, and cosmetic services.
 */

import type { VerticalDefinition } from "@/lib/config/verticals";

export const beautyVertical: VerticalDefinition = {
  id: "beauty",
  nameEn: "Beauty & Wellness",
  nameFr: "Beauté & Bien-être",
  nameAr: "الجمال والعناية",
  icon: "Sparkles",
  categories: ["clinics_centers", "para_medical"],
  defaultFeatures: [
    "appointments",
    "before_after_photos",
    "treatment_packages",
    "consultation_photos",
    "consent_forms",
  ],
  defaultServices: [
    { name: "Soin du visage", duration_minutes: 60, price: 400 },
    { name: "Massage relaxant", duration_minutes: 45, price: 350 },
    { name: "Épilation laser", duration_minutes: 30, price: 500 },
    { name: "Manucure", duration_minutes: 30, price: 150 },
    { name: "Consultation esthétique", duration_minutes: 20, price: 200 },
  ],
  terminology: {
    client: "client",
    provider: "stylist",
    appointment: "appointment",
    location: "salon",
  },
  templatePresets: [
    "beauty-elegant",
    "beauty-modern",
    "beauty-bold",
  ],
};
