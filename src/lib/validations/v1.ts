import { z } from "zod";
import { isMinorByDob, MINOR_AGE_THRESHOLD } from "@/lib/minors";
import { phoneNumber } from "@/lib/validations/primitives";

/**
 * Adult-only gating (A200): Oltigo does not yet implement a parental/guardian
 * consent flow, and clinical AI on patient health has been removed, so minors
 * must not be registered. When a date of birth is supplied and it indicates the
 * person is under {@link MINOR_AGE_THRESHOLD}, reject it. Absent or
 * unparseable dates pass here (age cannot be determined) — DOB stays optional.
 */
const ADULT_ONLY_MESSAGE = `Patient must be at least ${MINOR_AGE_THRESHOLD}. Registering minors is not supported until a parental-consent flow is available (Loi 09-08 / RGPD Art. 8).`;

function isNotMinorDob(dob: string | undefined | null): boolean {
  if (!dob) return true;
  return !isMinorByDob(dob);
}

export const v1AppointmentCreateSchema = z.object({
  patient_id: z.string().min(1).max(100),
  doctor_id: z.string().min(1).max(100),
  appointment_date: z.string().min(1).max(10),
  start_time: z.string().min(1).max(8),
  end_time: z.string().max(8).optional(),
  status: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const v1PatientCreateSchema = z
  .object({
    full_name: z.string().min(1).max(200),
    email: z.string().email().max(254).optional().or(z.literal("")),
    phone: phoneNumber.optional(),
    date_of_birth: z.string().optional(),
    gender: z.string().max(20).optional(),
    insurance_type: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
  })
  .refine((data) => isNotMinorDob(data.date_of_birth), {
    message: ADULT_ONLY_MESSAGE,
    path: ["date_of_birth"],
  });
