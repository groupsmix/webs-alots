/**
 * Veterinary vertical definition.
 *
 * Covers veterinary clinics, animal hospitals, pet grooming, and pet care.
 * Unique feature: pet_profiles — tracks animal name, species, breed, weight, age.
 */

import type { VerticalDefinition } from "@/lib/config/verticals";

export const veterinaryVertical: VerticalDefinition = {
  id: "veterinary",
  nameEn: "Veterinary",
  nameFr: "Vétérinaire",
  nameAr: "بيطري",
  icon: "PawPrint",
  categories: ["veterinary"],
  defaultFeatures: [
    "appointments",
    "prescriptions",
    "consultations",
    "vaccination",
    "stock",
    "pet_profiles",
    "consent_forms",
  ],
  defaultServices: [
    { name: "Consultation générale", duration_minutes: 30, price: 250 },
    { name: "Vaccination", duration_minutes: 15, price: 200 },
    { name: "Stérilisation", duration_minutes: 90, price: 1200 },
    { name: "Détartrage", duration_minutes: 30, price: 400 },
    { name: "Toilettage", duration_minutes: 45, price: 150 },
    { name: "Chirurgie", duration_minutes: 120, price: 2000 },
    { name: "Radiologie", duration_minutes: 20, price: 350 },
    { name: "Analyses", duration_minutes: 15, price: 300 },
    { name: "Urgences", duration_minutes: 30, price: 500 },
  ],
  terminology: {
    client: "propriétaire",
    provider: "vétérinaire",
    appointment: "consultation",
    location: "clinique vétérinaire",
  },
  templatePresets: [
    "vet-modern",
    "vet-classic",
  ],
  requiredDbTables: ["pet_profiles"],
};
