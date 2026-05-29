/**
 * CDSS Validation Schemas
 *
 * Zod schemas for CDSS endpoints — drug interaction check,
 * dose validation, and NEWS2 scoring.
 */

import { z } from "zod";

export const cdssCheckRequestSchema = z.object({
  newDrug: z.string().min(1).max(200),
  currentMedications: z.array(z.string().max(200)).optional(),
  allergies: z.array(z.string().max(200)).optional(),
  dose: z.number().positive().optional(),
  route: z.enum(["oral", "iv", "im", "sc", "topical"]).optional(),
  patientWeight: z.number().positive().max(500).optional(),
  patientAge: z.number().int().min(0).max(150).optional(),
  renalFunction: z.number().min(0).max(200).optional(),
  patientId: z.string().min(1).optional(),
});

export const news2RequestSchema = z.object({
  respiratoryRate: z.number().min(0).max(60),
  oxygenSaturation: z.number().min(0).max(100),
  supplementalOxygen: z.boolean(),
  temperature: z.number().min(25).max(45),
  systolicBP: z.number().min(0).max(300),
  heartRate: z.number().min(0).max(300),
  consciousness: z.enum(["alert", "voice", "pain", "unresponsive"]),
});

export const doseValidationRequestSchema = z.object({
  drug: z.string().min(1).max(200),
  dose: z.number().positive(),
  route: z.enum(["oral", "iv", "im", "sc", "topical"]),
  patientWeight: z.number().positive().max(500).optional(),
  patientAge: z.number().int().min(0).max(150).optional(),
  renalFunction: z.number().min(0).max(200).optional(),
});
