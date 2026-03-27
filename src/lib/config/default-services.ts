/**
 * Default services pre-populated by clinic type during onboarding.
 *
 * Each clinic type key maps to an array of suggested services with
 * name (French), duration in minutes, and price in MAD.
 */

export interface DefaultService {
  name: string;
  duration_minutes: number;
  price: number;
}

const GP_SERVICES: DefaultService[] = [
  { name: "Consultation générale", duration_minutes: 30, price: 200 },
  { name: "Consultation de suivi", duration_minutes: 20, price: 150 },
  { name: "Certificat médical", duration_minutes: 15, price: 100 },
  { name: "Bilan de santé", duration_minutes: 45, price: 350 },
];

const CARDIOLOGY_SERVICES: DefaultService[] = [
  { name: "Consultation cardiologie", duration_minutes: 30, price: 400 },
  { name: "Électrocardiogramme (ECG)", duration_minutes: 20, price: 200 },
  { name: "Échocardiographie", duration_minutes: 45, price: 600 },
  { name: "Holter ECG 24h", duration_minutes: 30, price: 500 },
];

const DERMATOLOGY_SERVICES: DefaultService[] = [
  { name: "Consultation dermatologie", duration_minutes: 30, price: 350 },
  { name: "Dermoscopie", duration_minutes: 20, price: 250 },
  { name: "Cryothérapie", duration_minutes: 15, price: 300 },
  { name: "Laser dermatologique", duration_minutes: 30, price: 500 },
];

const PEDIATRICS_SERVICES: DefaultService[] = [
  { name: "Consultation pédiatrique", duration_minutes: 30, price: 250 },
  { name: "Vaccination", duration_minutes: 15, price: 200 },
  { name: "Bilan de croissance", duration_minutes: 30, price: 300 },
];

const GYNECOLOGY_SERVICES: DefaultService[] = [
  { name: "Consultation gynécologie", duration_minutes: 30, price: 350 },
  { name: "Échographie obstétricale", duration_minutes: 30, price: 400 },
  { name: "Frottis cervical", duration_minutes: 20, price: 250 },
  { name: "Suivi de grossesse", duration_minutes: 30, price: 300 },
];

const OPHTHALMOLOGY_SERVICES: DefaultService[] = [
  { name: "Consultation ophtalmologie", duration_minutes: 30, price: 300 },
  { name: "Examen de vue complet", duration_minutes: 30, price: 250 },
  { name: "Fond d'œil", duration_minutes: 20, price: 200 },
  { name: "Champ visuel", duration_minutes: 30, price: 300 },
];

const DENTAL_SERVICES: DefaultService[] = [
  { name: "Consultation dentaire", duration_minutes: 30, price: 200 },
  { name: "Détartrage", duration_minutes: 30, price: 300 },
  { name: "Extraction dentaire", duration_minutes: 30, price: 400 },
  { name: "Blanchiment dentaire", duration_minutes: 60, price: 1500 },
  { name: "Plombage", duration_minutes: 30, price: 350 },
];

const PHYSIOTHERAPY_SERVICES: DefaultService[] = [
  { name: "Séance de kinésithérapie", duration_minutes: 30, price: 200 },
  { name: "Rééducation fonctionnelle", duration_minutes: 45, price: 250 },
  { name: "Massage thérapeutique", duration_minutes: 30, price: 200 },
  { name: "Bilan kinésithérapique", duration_minutes: 45, price: 300 },
];

const NUTRITION_SERVICES: DefaultService[] = [
  { name: "Consultation diététique", duration_minutes: 45, price: 300 },
  { name: "Bilan nutritionnel", duration_minutes: 60, price: 400 },
  { name: "Suivi diététique", duration_minutes: 30, price: 200 },
];

const PSYCHOLOGY_SERVICES: DefaultService[] = [
  { name: "Consultation psychologique", duration_minutes: 45, price: 400 },
  { name: "Thérapie individuelle", duration_minutes: 60, price: 500 },
  { name: "Bilan psychologique", duration_minutes: 90, price: 600 },
];

const PHARMACY_SERVICES: DefaultService[] = [
  { name: "Conseil pharmaceutique", duration_minutes: 15, price: 0 },
  { name: "Prise de tension", duration_minutes: 10, price: 0 },
  { name: "Test de glycémie", duration_minutes: 10, price: 50 },
];

const DEFAULT_MEDICAL: DefaultService[] = [
  { name: "Consultation", duration_minutes: 30, price: 300 },
  { name: "Consultation de suivi", duration_minutes: 20, price: 200 },
  { name: "Bilan complet", duration_minutes: 45, price: 500 },
];

const DEFAULT_PARAMEDICAL: DefaultService[] = [
  { name: "Séance", duration_minutes: 30, price: 200 },
  { name: "Bilan initial", duration_minutes: 45, price: 300 },
  { name: "Séance de suivi", duration_minutes: 30, price: 200 },
];

const DEFAULT_DIAGNOSTIC: DefaultService[] = [
  { name: "Analyse standard", duration_minutes: 15, price: 200 },
  { name: "Bilan complet", duration_minutes: 30, price: 500 },
];

const DEFAULT_GENERIC: DefaultService[] = [
  { name: "Consultation", duration_minutes: 30, price: 200 },
  { name: "Suivi", duration_minutes: 20, price: 150 },
];

/** Type-key specific service defaults */
const TYPE_SERVICES: Record<string, DefaultService[]> = {
  general_medicine: GP_SERVICES,
  cardiology: CARDIOLOGY_SERVICES,
  dermatology: DERMATOLOGY_SERVICES,
  pediatrics: PEDIATRICS_SERVICES,
  gynecology: GYNECOLOGY_SERVICES,
  ophthalmology: OPHTHALMOLOGY_SERVICES,
  dental_clinic: DENTAL_SERVICES,
  physiotherapy: PHYSIOTHERAPY_SERVICES,
  nutrition: NUTRITION_SERVICES,
  psychology: PSYCHOLOGY_SERVICES,
  pharmacy: PHARMACY_SERVICES,
  parapharmacy: PHARMACY_SERVICES,
};

/** Category-level fallback defaults */
const CATEGORY_SERVICES: Record<string, DefaultService[]> = {
  medical: DEFAULT_MEDICAL,
  para_medical: DEFAULT_PARAMEDICAL,
  diagnostic: DEFAULT_DIAGNOSTIC,
  pharmacy_retail: PHARMACY_SERVICES,
  clinics_centers: DENTAL_SERVICES,
};

/**
 * Get default services for a given clinic type and category.
 * First checks for type-specific services, then falls back to category defaults.
 */
export function getDefaultServices(
  typeKey: string,
  category?: string,
): DefaultService[] {
  if (TYPE_SERVICES[typeKey]) {
    return TYPE_SERVICES[typeKey];
  }
  if (category && CATEGORY_SERVICES[category]) {
    return CATEGORY_SERVICES[category];
  }
  return DEFAULT_GENERIC;
}
