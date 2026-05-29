import { z } from "zod";

/** Admission create schema — adapted from MedCore ADT workflow. */
export const admissionCreateSchema = z.object({
  patient_id: z.string().uuid(),
  bed_id: z.string().uuid(),
  department_id: z.string().uuid().optional(),
  admitting_doctor_id: z.string().uuid().optional(),
  diagnosis: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
});

/** Discharge schema — records discharge details. */
export const dischargeSchema = z.object({
  notes: z.string().max(5000).optional(),
});

/** Transfer schema — moves patient to another department/ward. */
export const transferSchema = z.object({
  department_id: z.string().uuid().optional(),
  bed_id: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
});

/** ADT status filter for list queries. */
export const admissionQuerySchema = z.object({
  status: z.enum(["admitted", "discharged", "transferred"]).optional(),
  patient_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
