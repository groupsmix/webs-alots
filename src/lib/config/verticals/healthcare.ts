/**
 * Healthcare vertical definition.
 *
 * Covers all medical specialties, dental, diagnostics, and pharmacy.
 */

import type { VerticalDefinition } from "@/lib/config/verticals";

export const healthcareVertical: VerticalDefinition = {
  id: "healthcare",
  nameEn: "Healthcare",
  nameFr: "Santé",
  nameAr: "الرعاية الصحية",
  icon: "Stethoscope",
  categories: [
    "medical",
    "para_medical",
    "diagnostic",
    "pharmacy_retail",
    "clinics_centers",
  ],
  defaultFeatures: [
    "appointments",
    "prescriptions",
    "consultations",
    "lab_results",
    "imaging",
    "departments",
    "consent_forms",
  ],
  defaultServices: [
    { name: "Consultation", duration_minutes: 30, price: 300 },
    { name: "Consultation de suivi", duration_minutes: 20, price: 200 },
    { name: "Bilan complet", duration_minutes: 45, price: 500 },
    { name: "Certificat médical", duration_minutes: 15, price: 100 },
  ],
  terminology: {
    client: "patient",
    provider: "doctor",
    appointment: "appointment",
    location: "clinic",
  },
  templatePresets: [
    "doctor-modern",
    "doctor-elegant",
    "doctor-bold",
    "dentist-modern",
    "dentist-bold",
  ],
};
