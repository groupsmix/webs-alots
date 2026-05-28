/**
 * Morocco-Specific Utilities
 *
 * Core utilities for Moroccan business logic:
 * - Phone number formatting (+212)
 * - Moroccan cities list
 */

// ---- Phone Number Formatting ----

/**
 * Converts phone to WhatsApp-compatible format (no + or spaces).
 * Input: "+212 6 12 34 56 78" → "212612345678"
 */
export function phoneToWhatsApp(phone: string): string {
  const cleaned = phone.replace(/[\s\-().+]/g, "");
  if (cleaned.startsWith("0")) {
    return "212" + cleaned.slice(1);
  }
  return cleaned;
}

// ---- Moroccan Cities ----

export const MOROCCAN_CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Fès",
  "Tanger",
  "Agadir",
  "Meknès",
  "Oujda",
  "Kénitra",
  "Tétouan",
  "Salé",
  "Temara",
  "Safi",
  "Mohammedia",
  "El Jadida",
  "Béni Mellal",
  "Nador",
  "Taza",
  "Settat",
  "Berrechid",
  "Khouribga",
  "Khémisset",
  "Larache",
  "Guelmim",
  "Errachidia",
  "Ifrane",
] as const;
