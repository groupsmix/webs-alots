/**
 * A200: Minor patient detection and guardian-consent helpers.
 *
 * Morocco's Law 09-08 and GDPR Art. 8 require parental/guardian consent
 * for processing personal data of minors (under 18 in Morocco).
 */

/** Age of majority under Moroccan Law 09-08. */
export const MINOR_AGE_THRESHOLD = 18;

/** Returns true if the given age (in years) is below the age of majority. */
export function isMinorByAge(age: number): boolean {
  return Number.isFinite(age) && age >= 0 && age < MINOR_AGE_THRESHOLD;
}

/**
 * Returns true if a date-of-birth string (YYYY-MM-DD or ISO-8601)
 * indicates the person is currently under 18.
 */
export function isMinorByDob(dateOfBirth: string | Date): boolean {
  const dob = typeof dateOfBirth === "string" ? new Date(dateOfBirth) : dateOfBirth;
  if (isNaN(dob.getTime())) return false;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 && age < MINOR_AGE_THRESHOLD;
}
