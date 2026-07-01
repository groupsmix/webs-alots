import { z } from "zod";
import { phoneNumber, safeName } from "./primitives";

/**
 * Demo-request lead submitted from the public marketing landing page
 * (oltigo landing CTA). These are prospective clinics, not yet tenants,
 * so the payload carries no clinic_id — leads live in the platform-level
 * `demo_leads` table.
 *
 * `city` is optional (the form does not require it). `locale` lets us
 * record which language the prospect submitted in so sales can follow up
 * appropriately (fr / ar / en / dar).
 */
export const demoLeadSchema = z.object({
  clinic: safeName.pipe(z.string().min(1, "Clinic name is required").max(160)),
  doctor: safeName.pipe(z.string().min(1, "Contact name is required").max(160)),
  phone: phoneNumber,
  email: z.string().email("Invalid email").max(254),
  city: safeName.pipe(z.string().max(120)).optional(),
  locale: z.enum(["fr", "ar", "en", "dar"]).optional(),
});
