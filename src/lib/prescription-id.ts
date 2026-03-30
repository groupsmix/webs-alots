/**
 * Prescription ID Generator
 *
 * Generates unique prescription identifiers in the format:
 *   RX-YYYY-XXXXXX
 *
 * Where YYYY is the current year and XXXXXX is a zero-padded
 * sequential number. The sequence resets each calendar year.
 *
 * On the client side (no DB access) we use a timestamp-based
 * fallback that is unique enough for single-user scenarios.
 * The server/DB should use the `prescription_number_seq` sequence
 * created in migration 00052 for true sequential numbering.
 */

/**
 * Generate a prescription number using a timestamp-based approach.
 * Suitable for client-side generation when DB sequence is not available.
 *
 * Format: RX-YYYY-XXXXXX
 */
export function generatePrescriptionNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  // Use last 6 digits of timestamp for uniqueness
  const seq = now.getTime() % 1_000_000;
  return `RX-${year}-${seq.toString().padStart(6, "0")}`;
}

/**
 * Generate a prescription number from a DB sequence value.
 * Use this on the server side after calling nextval('prescription_number_seq').
 */
export function formatPrescriptionNumber(year: number, sequence: number): string {
  return `RX-${year}-${sequence.toString().padStart(6, "0")}`;
}

/**
 * Validate that a string matches the prescription number format.
 */
export function isValidPrescriptionNumber(value: string): boolean {
  return /^RX-\d{4}-\d{6}$/.test(value);
}
