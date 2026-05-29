import { z } from "zod";

/** Create a telemedicine session — adapted from MedCore telemedicine patterns. */
export const telemedicineCreateSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  scheduled_at: z.string().datetime(),
  consultation_notes: z.string().max(10000).optional(),
});

/** Update telemedicine session status. */
export const telemedicineUpdateSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  consultation_notes: z.string().max(10000).optional(),
  room_url: z.string().url().optional(),
  duration_minutes: z.number().int().positive().max(480).optional(),
});

/** Query telemedicine sessions. */
export const telemedicineQuerySchema = z.object({
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  doctor_id: z.string().uuid().optional(),
  patient_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
