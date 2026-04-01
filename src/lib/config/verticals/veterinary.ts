/**
 * Veterinary vertical definition.
 *
 * Covers veterinary clinics, animal hospitals, and pet care.
 */

import type { VerticalDefinition } from "@/lib/config/verticals";

export const veterinaryVertical: VerticalDefinition = {
  id: "veterinary",
  nameEn: "Veterinary",
  nameFr: "Vétérinaire",
  nameAr: "بيطري",
  icon: "PawPrint",
  categories: ["clinics_centers"],
  defaultFeatures: [
    "appointments",
    "prescriptions",
    "consultations",
    "vaccination",
    "consent_forms",
  ],
  defaultServices: [
    { name: "Consultation vétérinaire", duration_minutes: 30, price: 250 },
    { name: "Vaccination", duration_minutes: 15, price: 200 },
    { name: "Chirurgie mineure", duration_minutes: 60, price: 800 },
    { name: "Toilettage", duration_minutes: 45, price: 150 },
    { name: "Détartrage", duration_minutes: 30, price: 400 },
  ],
  terminology: {
    client: "client",
    provider: "doctor",
    appointment: "appointment",
    location: "clinic",
  },
  templatePresets: [
    "vet-modern",
    "vet-classic",
  ],
};
