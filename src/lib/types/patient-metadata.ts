/**
 * Shape of the `users.metadata` JSONB column for patient records.
 *
 * Used across AI routes (drug-check, prescription, patient-summary)
 * and anywhere patient metadata is read from the database.
 */
export interface PatientMetadata {
  date_of_birth?: string;
  gender?: "M" | "F" | string;
  age?: number;
  weight?: number;
  allergies?: string[];
  chronicConditions?: string[];
  currentMedications?: string[];
  ai_summary?: {
    text: string;
    generated_at: string;
    generated_by?: string;
  };
  [key: string]: unknown;
}
