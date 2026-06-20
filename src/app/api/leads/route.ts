/**
 * POST /api/leads — Capture a demo-request lead from the public marketing
 * landing page (oltigo CTA).
 *
 * Public + unauthenticated: prospective clinics submit this before they are
 * tenants, so there is no session and no clinic context. The route is listed
 * in PUBLIC_API_ROUTES; middleware still applies rate limiting and security
 * headers. Input is Zod-validated via `withValidation` (body-size + JSON
 * depth caps included).
 *
 * Persistence: writes to the platform-level `demo_leads` table (migration
 * 00191) via the service-role client. The table has no clinic_id — these are
 * cross-tenant sales leads — so this route is intentionally on the
 * check-tenant-scoping ALLOWLIST.
 */

import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase-server";
import { demoLeadSchema } from "@/lib/validations/leads";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

export const POST = withValidation(demoLeadSchema, async (data) => {
  try {
    // demo_leads is not in the generated Database types yet; use the
    // service-role client (public intake, no session) at an untyped boundary.
    const supabase = createServiceClient() as unknown as SupabaseUntyped;

    const { error } = await supabase.from("demo_leads").insert({
      clinic_name: data.clinic,
      contact_name: data.doctor,
      phone: data.phone,
      email: data.email,
      city: data.city ?? null,
      locale: data.locale ?? null,
      source: "landing_demo_cta",
      status: "new",
    });

    if (error) {
      logger.error("Failed to persist demo lead", { context: "api/leads", error });
      return apiInternalError("Could not submit your request. Please try again.");
    }

    logger.info("Demo lead captured", { context: "api/leads", city: data.city ?? null });
    return apiSuccess({ received: true }, 201);
  } catch (err) {
    logger.error("Unexpected error capturing demo lead", { context: "api/leads", error: err });
    return apiInternalError("Could not submit your request. Please try again.");
  }
});
