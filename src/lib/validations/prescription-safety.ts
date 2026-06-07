/**
 * Validation schemas for AI prescription safety checks.
 *
 * OWASP A03: All string fields bounded and sanitized before AI prompt injection.
 * OWASP A04: patientId must be a UUID and verified against clinic membership.
 */
import { z } from "zod";

const prescriptionItemSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  dosage: z.string().max(100).trim().optional(),
  frequency: z.string().max(100).trim().optional(),
  duration: z.string().max(100).trim().optional(),
});

export const prescriptionSafetySchema = z.object({
  /** Medications currently being prescribed (new) */
  currentPrescriptions: z
    .array(prescriptionItemSchema)
    .min(1, "At least one prescription is required")
    .max(20, "Maximum 20 medications per check"),
  /** Patient UUID — verified against clinic ownership in handler */
  patientId: z.string().uuid("Invalid patient ID"),
  /** Patient's existing/chronic medications */
  existingMedications: z.array(z.string().max(200).trim()).max(30).default([]),
  /** Patient clinical profile for safety analysis */
  patientHistory: z
    .object({
      age: z.number().int().min(0).max(150).optional(),
      weight: z.number().min(0).max(500).optional(),
      conditions: z.array(z.string().max(200).trim()).max(20).default([]),
      allergies: z.array(z.string().max(200).trim()).max(20).default([]),
      pregnancy: z.boolean().optional(),
      renalImpairment: z.boolean().optional(),
      hepaticImpairment: z.boolean().optional(),
    })
    .default({}),
});

export type PrescriptionSafetyInput = z.infer<typeof prescriptionSafetySchema>;
