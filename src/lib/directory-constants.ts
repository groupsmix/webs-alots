/**
 * Directory Constants
 *
 * Static data for the public doctor directory (/annuaire).
 * Cities, specialties, and slug-mapping utilities used by
 * directory pages and sitemap generation.
 */

// ── Moroccan Cities with French slugs ──

export interface DirectoryCity {
  name: string;
  slug: string;
  nameAr: string;
  region: string;
}

export const DIRECTORY_CITIES: DirectoryCity[] = [
  { name: "Casablanca", slug: "casablanca", nameAr: "الدار البيضاء", region: "Casablanca-Settat" },
  { name: "Rabat", slug: "rabat", nameAr: "الرباط", region: "Rabat-Salé-Kénitra" },
  { name: "Marrakech", slug: "marrakech", nameAr: "مراكش", region: "Marrakech-Safi" },
  { name: "Fès", slug: "fes", nameAr: "فاس", region: "Fès-Meknès" },
  { name: "Tanger", slug: "tanger", nameAr: "طنجة", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Agadir", slug: "agadir", nameAr: "أكادير", region: "Souss-Massa" },
  { name: "Meknès", slug: "meknes", nameAr: "مكناس", region: "Fès-Meknès" },
  { name: "Oujda", slug: "oujda", nameAr: "وجدة", region: "Oriental" },
  { name: "Kénitra", slug: "kenitra", nameAr: "القنيطرة", region: "Rabat-Salé-Kénitra" },
  { name: "Tétouan", slug: "tetouan", nameAr: "تطوان", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Salé", slug: "sale", nameAr: "سلا", region: "Rabat-Salé-Kénitra" },
  { name: "Temara", slug: "temara", nameAr: "تمارة", region: "Rabat-Salé-Kénitra" },
  { name: "Safi", slug: "safi", nameAr: "آسفي", region: "Marrakech-Safi" },
  { name: "Mohammedia", slug: "mohammedia", nameAr: "المحمدية", region: "Casablanca-Settat" },
  { name: "El Jadida", slug: "el-jadida", nameAr: "الجديدة", region: "Casablanca-Settat" },
  { name: "Béni Mellal", slug: "beni-mellal", nameAr: "بني ملال", region: "Béni Mellal-Khénifra" },
  { name: "Nador", slug: "nador", nameAr: "الناظور", region: "Oriental" },
  { name: "Taza", slug: "taza", nameAr: "تازة", region: "Fès-Meknès" },
  { name: "Settat", slug: "settat", nameAr: "سطات", region: "Casablanca-Settat" },
  { name: "Berrechid", slug: "berrechid", nameAr: "برشيد", region: "Casablanca-Settat" },
  { name: "Khouribga", slug: "khouribga", nameAr: "خريبكة", region: "Béni Mellal-Khénifra" },
  { name: "Khémisset", slug: "khemisset", nameAr: "الخميسات", region: "Rabat-Salé-Kénitra" },
  { name: "Larache", slug: "larache", nameAr: "العرائش", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Guelmim", slug: "guelmim", nameAr: "كلميم", region: "Guelmim-Oued Noun" },
  { name: "Errachidia", slug: "errachidia", nameAr: "الراشيدية", region: "Drâa-Tafilalet" },
  { name: "Ifrane", slug: "ifrane", nameAr: "إفران", region: "Fès-Meknès" },
];

// ── Medical Specialties with French slugs ──

export interface DirectorySpecialty {
  name: string;
  slug: string;
  nameAr: string;
  nameFr: string;
  description: string;
}

export const DIRECTORY_SPECIALTIES: DirectorySpecialty[] = [
  { name: "General Practitioner", slug: "medecin-generaliste", nameAr: "طبيب عام", nameFr: "Médecin généraliste", description: "Consultations de médecine générale et suivi médical" },
  { name: "Dentist", slug: "dentiste", nameAr: "طبيب أسنان", nameFr: "Dentiste", description: "Soins dentaires, orthodontie et chirurgie buccale" },
  { name: "Pediatrician", slug: "pediatre", nameAr: "طبيب أطفال", nameFr: "Pédiatre", description: "Suivi médical des nourrissons, enfants et adolescents" },
  { name: "Gynecologist", slug: "gynecologue", nameAr: "طبيب نساء وتوليد", nameFr: "Gynécologue", description: "Gynécologie, obstétrique et suivi de grossesse" },
  { name: "Ophthalmologist", slug: "ophtalmologue", nameAr: "طبيب عيون", nameFr: "Ophtalmologue", description: "Soins des yeux, examens de la vue et chirurgie ophtalmique" },
  { name: "Cardiologist", slug: "cardiologue", nameAr: "طبيب قلب", nameFr: "Cardiologue", description: "Diagnostic et traitement des maladies cardiovasculaires" },
  { name: "Dermatologist", slug: "dermatologue", nameAr: "طبيب جلد", nameFr: "Dermatologue", description: "Soins de la peau, dermatologie esthétique et allergies cutanées" },
  { name: "Orthopedist", slug: "orthopediste", nameAr: "طبيب عظام", nameFr: "Orthopédiste", description: "Traumatologie, chirurgie orthopédique et rhumatologie" },
  { name: "Neurologist", slug: "neurologue", nameAr: "طبيب أعصاب", nameFr: "Neurologue", description: "Diagnostic et traitement des maladies du système nerveux" },
  { name: "Psychiatrist", slug: "psychiatre", nameAr: "طبيب نفسي", nameFr: "Psychiatre", description: "Santé mentale, troubles psychologiques et thérapies" },
  { name: "Physiotherapist", slug: "kinesitherapeute", nameAr: "معالج طبيعي", nameFr: "Kinésithérapeute", description: "Rééducation fonctionnelle et kinésithérapie" },
  { name: "Radiologist", slug: "radiologue", nameAr: "طبيب أشعة", nameFr: "Radiologue", description: "Imagerie médicale, radiologie et échographie" },
  { name: "Nutritionist", slug: "nutritionniste", nameAr: "أخصائي تغذية", nameFr: "Nutritionniste", description: "Nutrition, diététique et suivi alimentaire" },
  { name: "ENT Specialist", slug: "orl", nameAr: "طبيب أنف أذن حنجرة", nameFr: "ORL", description: "Oto-rhino-laryngologie — nez, oreilles et gorge" },
  { name: "Urologist", slug: "urologue", nameAr: "طبيب مسالك بولية", nameFr: "Urologue", description: "Appareil urinaire et troubles urologiques" },
  { name: "Pulmonologist", slug: "pneumologue", nameAr: "طبيب رئة", nameFr: "Pneumologue", description: "Maladies respiratoires et pneumologie" },
  { name: "Endocrinologist", slug: "endocrinologue", nameAr: "طبيب غدد", nameFr: "Endocrinologue", description: "Diabète, thyroïde et troubles hormonaux" },
  { name: "Rheumatologist", slug: "rhumatologue", nameAr: "طبيب روماتيزم", nameFr: "Rhumatologue", description: "Rhumatismes, arthrose et maladies articulaires" },
  { name: "Gastroenterologist", slug: "gastro-enterologue", nameAr: "طبيب جهاز هضمي", nameFr: "Gastro-entérologue", description: "Maladies de l'appareil digestif et hépatologie" },
  { name: "Nephrologist", slug: "nephrologue", nameAr: "طبيب كلى", nameFr: "Néphrologue", description: "Maladies rénales et dialyse" },
  { name: "Pharmacist", slug: "pharmacien", nameAr: "صيدلي", nameFr: "Pharmacien", description: "Pharmacie, conseil pharmaceutique et parapharmacie" },
  { name: "Optician", slug: "opticien", nameAr: "بصري", nameFr: "Opticien", description: "Lunettes, lentilles de contact et optique" },
  { name: "Speech Therapist", slug: "orthophoniste", nameAr: "أخصائي نطق", nameFr: "Orthophoniste", description: "Rééducation de la parole et du langage" },
  { name: "Psychologist", slug: "psychologue", nameAr: "أخصائي نفسي", nameFr: "Psychologue", description: "Accompagnement psychologique et thérapies comportementales" },
];

// ── Top city+specialty combos for SSG (generateStaticParams) ──

/** Top 50 city+specialty combinations for static generation */
export const TOP_CITY_SPECIALTY_COMBOS: { city: string; specialty: string }[] = [
  // Casablanca — largest city, all major specialties
  { city: "casablanca", specialty: "dentiste" },
  { city: "casablanca", specialty: "medecin-generaliste" },
  { city: "casablanca", specialty: "gynecologue" },
  { city: "casablanca", specialty: "pediatre" },
  { city: "casablanca", specialty: "cardiologue" },
  { city: "casablanca", specialty: "dermatologue" },
  { city: "casablanca", specialty: "ophtalmologue" },
  { city: "casablanca", specialty: "orthopediste" },
  { city: "casablanca", specialty: "orl" },
  { city: "casablanca", specialty: "kinesitherapeute" },
  // Rabat
  { city: "rabat", specialty: "dentiste" },
  { city: "rabat", specialty: "medecin-generaliste" },
  { city: "rabat", specialty: "gynecologue" },
  { city: "rabat", specialty: "pediatre" },
  { city: "rabat", specialty: "cardiologue" },
  { city: "rabat", specialty: "dermatologue" },
  { city: "rabat", specialty: "ophtalmologue" },
  // Marrakech
  { city: "marrakech", specialty: "dentiste" },
  { city: "marrakech", specialty: "medecin-generaliste" },
  { city: "marrakech", specialty: "gynecologue" },
  { city: "marrakech", specialty: "pediatre" },
  { city: "marrakech", specialty: "cardiologue" },
  { city: "marrakech", specialty: "dermatologue" },
  // Fès
  { city: "fes", specialty: "dentiste" },
  { city: "fes", specialty: "medecin-generaliste" },
  { city: "fes", specialty: "gynecologue" },
  { city: "fes", specialty: "pediatre" },
  { city: "fes", specialty: "cardiologue" },
  // Tanger
  { city: "tanger", specialty: "dentiste" },
  { city: "tanger", specialty: "medecin-generaliste" },
  { city: "tanger", specialty: "gynecologue" },
  { city: "tanger", specialty: "pediatre" },
  { city: "tanger", specialty: "cardiologue" },
  // Agadir
  { city: "agadir", specialty: "dentiste" },
  { city: "agadir", specialty: "medecin-generaliste" },
  { city: "agadir", specialty: "gynecologue" },
  { city: "agadir", specialty: "pediatre" },
  // Meknès
  { city: "meknes", specialty: "dentiste" },
  { city: "meknes", specialty: "medecin-generaliste" },
  { city: "meknes", specialty: "gynecologue" },
  // Oujda
  { city: "oujda", specialty: "dentiste" },
  { city: "oujda", specialty: "medecin-generaliste" },
  { city: "oujda", specialty: "gynecologue" },
  // Kénitra
  { city: "kenitra", specialty: "dentiste" },
  { city: "kenitra", specialty: "medecin-generaliste" },
  // Tétouan
  { city: "tetouan", specialty: "dentiste" },
  { city: "tetouan", specialty: "medecin-generaliste" },
  // Salé
  { city: "sale", specialty: "dentiste" },
  { city: "sale", specialty: "medecin-generaliste" },
  // Safi
  { city: "safi", specialty: "dentiste" },
];

// ── Lookup helpers ──

export function getCityBySlug(slug: string): DirectoryCity | undefined {
  return DIRECTORY_CITIES.find((c) => c.slug === slug);
}

export function getSpecialtyBySlug(slug: string): DirectorySpecialty | undefined {
  return DIRECTORY_SPECIALTIES.find((s) => s.slug === slug);
}

/**
 * Generate a doctor slug from their name.
 * e.g. "Dr. Ahmed El Fassi" → "dr-ahmed-el-fassi"
 */
export function doctorNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^(?!dr-)/, "dr-"); // ensure dr- prefix
}
