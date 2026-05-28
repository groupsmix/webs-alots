import { z } from "zod";
import { phoneNumber } from "@/lib/validations/primitives";

export const v1AppointmentCreateSchema = z.object({
  patient_id: z.string().min(1).max(100),
  doctor_id: z.string().min(1).max(100),
  appointment_date: z.string().min(1).max(10),
  start_time: z.string().min(1).max(8),
  end_time: z.string().max(8).optional(),
  status: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const v1PatientCreateSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(254).optional().or(z.literal("")),
  phone: phoneNumber.optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().max(20).optional(),
  insurance_type: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
});
