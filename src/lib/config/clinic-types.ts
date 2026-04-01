/**
 * Clinic Type Registry — Static data for the onboarding UI.
 *
 * Mirrors the seed data in 00009_clinic_types.sql so the front-end
 * can render categories and types without a database round-trip.
 */

import type { ClinicTypeCategory } from "@/lib/types/database";

// ---- Category metadata ----

export interface ClinicCategory {
  key: ClinicTypeCategory;
  name_fr: string;
  name_ar: string;
  description_fr: string;
  icon: string;
  color: string;
}

export const CLINIC_CATEGORIES: ClinicCategory[] = [
  {
    key: "medical",
    name_fr: "Médical",
    name_ar: "طبي",
    description_fr: "Cabinets et spécialités médicales",
    icon: "Stethoscope",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    key: "para_medical",
    name_fr: "Paramédical",
    name_ar: "شبه طبي",
    description_fr: "Professions paramédicales et rééducation",
    icon: "HeartPulse",
    color: "bg-green-50 border-green-200 text-green-700",
  },
  {
    key: "diagnostic",
    name_fr: "Diagnostic",
    name_ar: "تشخيصي",
    description_fr: "Laboratoires et centres d'imagerie",
    icon: "ScanLine",
    color: "bg-purple-50 border-purple-200 text-purple-700",
  },
  {
    key: "pharmacy_retail",
    name_fr: "Pharmacie & Vente",
    name_ar: "صيدلة وبيع",
    description_fr: "Pharmacies, parapharmacies et matériel médical",
    icon: "Pill",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    key: "clinics_centers",
    name_fr: "Cliniques & Centres",
    name_ar: "عيادات ومراكز",
    description_fr: "Cliniques spécialisées et centres de soins",
    icon: "Hospital",
    color: "bg-rose-50 border-rose-200 text-rose-700",
  },
  {
    key: "veterinary",
    name_fr: "Vétérinaire",
    name_ar: "بيطري",
    description_fr: "Cliniques vétérinaires et soins aux animaux",
    icon: "PawPrint",
    color: "bg-teal-50 border-teal-200 text-teal-700",
  },
  {
    key: "restaurant",
    name_fr: "Restaurant",
    name_ar: "مطعم",
    description_fr: "Restaurants, cafés et services de restauration",
    icon: "UtensilsCrossed",
    color: "bg-orange-50 border-orange-200 text-orange-700",
  },
];

// ---- Individual clinic types ----

export interface ClinicTypeEntry {
  type_key: string;
  name_fr: string;
  name_ar: string;
  category: ClinicTypeCategory;
  icon: string;
  /** The business vertical this clinic type belongs to */
  vertical_id?: string;
}

export const CLINIC_TYPES: ClinicTypeEntry[] = [
  // ---- MEDICAL ----
  { type_key: "general_medicine",  name_fr: "Médecine Générale",           name_ar: "الطب العام",                    category: "medical", icon: "Stethoscope" },
  { type_key: "cardiology",        name_fr: "Cardiologie",                  name_ar: "أمراض القلب",                   category: "medical", icon: "Heart" },
  { type_key: "dermatology",       name_fr: "Dermatologie",                 name_ar: "الأمراض الجلدية",               category: "medical", icon: "Scan" },
  { type_key: "pediatrics",        name_fr: "Pédiatrie",                    name_ar: "طب الأطفال",                    category: "medical", icon: "Baby" },
  { type_key: "gynecology",        name_fr: "Gynécologie-Obstétrique",      name_ar: "أمراض النساء والتوليد",          category: "medical", icon: "HeartHandshake" },
  { type_key: "ophthalmology",     name_fr: "Ophtalmologie",                name_ar: "طب العيون",                     category: "medical", icon: "Eye" },
  { type_key: "ent",               name_fr: "ORL",                          name_ar: "أمراض الأنف والأذن والحنجرة",   category: "medical", icon: "Ear" },
  { type_key: "neurology",         name_fr: "Neurologie",                   name_ar: "طب الأعصاب",                    category: "medical", icon: "Brain" },
  { type_key: "psychiatry",        name_fr: "Psychiatrie",                  name_ar: "الطب النفسي",                   category: "medical", icon: "BrainCircuit" },
  { type_key: "orthopedics",       name_fr: "Orthopédie",                   name_ar: "جراحة العظام",                  category: "medical", icon: "Bone" },
  { type_key: "urology",           name_fr: "Urologie",                     name_ar: "المسالك البولية",               category: "medical", icon: "Activity" },
  { type_key: "gastroenterology",  name_fr: "Gastro-entérologie",           name_ar: "أمراض الجهاز الهضمي",           category: "medical", icon: "Apple" },
  { type_key: "pulmonology",       name_fr: "Pneumologie",                  name_ar: "أمراض الرئة",                   category: "medical", icon: "Wind" },
  { type_key: "endocrinology",     name_fr: "Endocrinologie",               name_ar: "الغدد الصماء والسكري",          category: "medical", icon: "Droplets" },
  { type_key: "rheumatology",      name_fr: "Rhumatologie",                 name_ar: "أمراض الروماتيزم",              category: "medical", icon: "Accessibility" },

  // ---- PARA-MEDICAL ----
  { type_key: "physiotherapy",     name_fr: "Kinésithérapie",               name_ar: "العلاج الطبيعي",                category: "para_medical", icon: "Dumbbell" },
  { type_key: "speech_therapy",    name_fr: "Orthophonie",                  name_ar: "النطق والتخاطب",                category: "para_medical", icon: "MessageCircle" },
  { type_key: "nutrition",         name_fr: "Diététique et Nutrition",      name_ar: "التغذية",                        category: "para_medical", icon: "Salad" },
  { type_key: "psychology",        name_fr: "Psychologie",                  name_ar: "علم النفس",                      category: "para_medical", icon: "HeartPulse" },
  { type_key: "nursing",           name_fr: "Soins Infirmiers",             name_ar: "التمريض",                        category: "para_medical", icon: "Syringe" },
  { type_key: "optician",          name_fr: "Opticien",                     name_ar: "البصريات",                       category: "para_medical", icon: "Glasses" },
  { type_key: "podiatry",          name_fr: "Podologie",                    name_ar: "طب القدم",                       category: "para_medical", icon: "Footprints" },
  { type_key: "osteopathy",        name_fr: "Ostéopathie",                  name_ar: "تقويم العظام",                   category: "para_medical", icon: "PersonStanding" },

  // ---- DIAGNOSTIC ----
  { type_key: "radiology",         name_fr: "Radiologie",                   name_ar: "الأشعة",                         category: "diagnostic", icon: "ScanLine" },
  { type_key: "medical_lab",       name_fr: "Laboratoire d'Analyses",       name_ar: "مختبر التحاليل الطبية",          category: "diagnostic", icon: "TestTube" },
  { type_key: "medical_imaging",   name_fr: "Imagerie Médicale",            name_ar: "التصوير الطبي",                  category: "diagnostic", icon: "MonitorCheck" },
  { type_key: "pathology",         name_fr: "Anatomie Pathologique",        name_ar: "التشريح المرضي",                 category: "diagnostic", icon: "Microscope" },

  // ---- PHARMACY & RETAIL ----
  { type_key: "pharmacy",          name_fr: "Pharmacie",                    name_ar: "صيدلية",                         category: "pharmacy_retail", icon: "Pill" },
  { type_key: "parapharmacy",      name_fr: "Parapharmacie",                name_ar: "شبه صيدلية",                    category: "pharmacy_retail", icon: "ShoppingBag" },
  { type_key: "medical_equipment", name_fr: "Matériel Médical",             name_ar: "المعدات الطبية",                 category: "pharmacy_retail", icon: "Wrench" },
  { type_key: "orthopedic_supply", name_fr: "Orthopédie et Appareillage",   name_ar: "تقويم العظام والأجهزة",          category: "pharmacy_retail", icon: "Cog" },

  // ---- CLINICS & CENTERS ----
  { type_key: "dental_clinic",     name_fr: "Cabinet Dentaire",             name_ar: "عيادة الأسنان",                  category: "clinics_centers", icon: "Smile" },
  { type_key: "polyclinic",        name_fr: "Polyclinique",                 name_ar: "عيادة متعددة التخصصات",          category: "clinics_centers", icon: "Building2" },
  { type_key: "medical_center",    name_fr: "Centre Médical",               name_ar: "مركز طبي",                       category: "clinics_centers", icon: "Hospital" },
  { type_key: "dialysis_center",   name_fr: "Centre d'Hémodialyse",         name_ar: "مركز غسيل الكلى",                category: "clinics_centers", icon: "Droplet" },
  { type_key: "rehabilitation",    name_fr: "Centre de Rééducation",        name_ar: "مركز إعادة التأهيل",             category: "clinics_centers", icon: "StretchVertical" },
  { type_key: "aesthetic_clinic",  name_fr: "Clinique Esthétique",          name_ar: "عيادة التجميل",                  category: "clinics_centers", icon: "Sparkles" },

  // ---- VETERINARY ----
  { type_key: "vet_general",       name_fr: "Vétérinaire Généraliste",      name_ar: "طبيب بيطري عام",                 category: "veterinary", icon: "PawPrint",    vertical_id: "veterinary" },
  { type_key: "vet_specialist",    name_fr: "Vétérinaire Spécialiste",      name_ar: "طبيب بيطري متخصص",               category: "veterinary", icon: "Stethoscope", vertical_id: "veterinary" },
  { type_key: "vet_emergency",     name_fr: "Urgences Vétérinaires",        name_ar: "طوارئ بيطرية",                   category: "veterinary", icon: "Siren",       vertical_id: "veterinary" },
  { type_key: "pet_grooming",      name_fr: "Toilettage Animaux",           name_ar: "تنظيف الحيوانات",                category: "veterinary", icon: "Scissors",    vertical_id: "veterinary" },

  // ---- RESTAURANT ----
  { type_key: "restaurant_traditional", name_fr: "Restaurant Traditionnel",  name_ar: "مطعم تقليدي",                    category: "restaurant", icon: "UtensilsCrossed", vertical_id: "restaurant" },
  { type_key: "restaurant_fast_food",   name_fr: "Restauration Rapide",      name_ar: "مطعم وجبات سريعة",               category: "restaurant", icon: "Sandwich",        vertical_id: "restaurant" },
  { type_key: "restaurant_cafe",        name_fr: "Café & Salon de Thé",      name_ar: "مقهى وصالون شاي",                category: "restaurant", icon: "Coffee",          vertical_id: "restaurant" },
  { type_key: "restaurant_catering",    name_fr: "Traiteur & Événementiel",  name_ar: "تموين ومناسبات",                 category: "restaurant", icon: "ChefHat",         vertical_id: "restaurant" },
];

/** Get all clinic types for a given category */
export function getTypesByCategory(category: ClinicTypeCategory): ClinicTypeEntry[] {
  return CLINIC_TYPES.filter((t) => t.category === category);
}

/** Find a single clinic type by its key */
export function getClinicType(typeKey: string): ClinicTypeEntry | undefined {
  return CLINIC_TYPES.find((t) => t.type_key === typeKey);
}

/** Find the category metadata for a given category key */
export function getCategoryMeta(category: ClinicTypeCategory): ClinicCategory | undefined {
  return CLINIC_CATEGORIES.find((c) => c.key === category);
}
