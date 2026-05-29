/**
 * FHIR API request validation schemas.
 */

import { z } from "zod";

export const fhirSearchSchema = z.object({
  type: z.enum(["Patient", "Observation"]),
  name: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  id: z.string().uuid().optional(),
  patient: z.string().uuid().optional(),
  _count: z.coerce.number().int().min(1).max(200).optional(),
});

export const fhirImportPatientSchema = z.object({
  resourceType: z.literal("Patient"),
  name: z
    .array(
      z.object({
        use: z.enum(["official", "usual", "nickname"]).optional(),
        family: z.string().max(200).optional(),
        given: z.array(z.string().max(100)).optional(),
      }),
    )
    .optional(),
  telecom: z
    .array(
      z.object({
        system: z.enum(["phone", "email", "fax"]).optional(),
        value: z.string().max(254).optional(),
        use: z.enum(["home", "work", "mobile"]).optional(),
      }),
    )
    .optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  birthDate: z.string().max(10).optional(),
  address: z
    .array(
      z.object({
        line: z.array(z.string().max(500)).optional(),
        city: z.string().max(200).optional(),
        postalCode: z.string().max(20).optional(),
        country: z.string().max(3).optional(),
      }),
    )
    .optional(),
});

export const prescriptionTransitionSchema = z.object({
  prescription_id: z.string().uuid(),
  new_status: z.enum([
    "draft",
    "pending_review",
    "approved",
    "rejected",
    "dispensed",
    "completed",
    "cancelled",
  ]),
  reason: z.string().max(1000).optional(),
  pharmacist_notes: z.string().max(2000).optional(),
});

export const prescriptionCreateSchema = z.object({
  patient_id: z.string().uuid(),
  medications: z
    .array(
      z.object({
        drug_name: z.string().min(1).max(200),
        dosage: z.string().min(1).max(100),
        frequency: z.string().min(1).max(200),
        duration: z.string().min(1).max(100),
        quantity: z.number().int().min(1).max(9999),
        instructions: z.string().max(500).optional(),
        is_generic_allowed: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(20),
  diagnosis: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});
