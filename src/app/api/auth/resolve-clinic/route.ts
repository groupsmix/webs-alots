/**
 * POST /api/auth/resolve-clinic
 *
 * Root-domain login funnel helper. Given an email, resolves the clinic
 * subdomain(s) the user belongs to so the root `oltigo.com/login` page can
 * redirect staff/patients to `{clinic}.oltigo.com/login` without them having
 * to remember their clinic's subdomain.
 *
 * Security / privacy:
 *   - Service-role lookup (the `users` table is RLS-protected and there is no
 *     session on the root domain). Returns ONLY the subdomain + display name —
 *     never any other tenant data.
 *   - Rate-limited (also covered by the `/api/auth/` middleware limiter).
 *   - Never logs the email or any PII.
 *   - Always returns 200 with a `clinics` array (empty when there is no match)
 *     so response shape/timing does not confirm whether an email has an account.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiSuccess,
  apiValidationError,
  apiRateLimited,
  apiInternalError,
} from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { loginLimiter, extractClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase-server";
import { safeParse } from "@/lib/validations";

const resolveClinicSchema = z.object({
  email: z.string().email(),
});

/** Public shape returned to the client — deliberately minimal. */
interface ResolvedClinic {
  subdomain: string;
  name: string;
}

export async function POST(request: NextRequest) {
  const clientIp = extractClientIp(request);
  const allowed = await loginLimiter.check(`resolve-clinic:${clientIp}`);
  if (!allowed) {
    return apiRateLimited("Too many attempts. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const result = safeParse(resolveClinicSchema, body);
  if (!result.success) {
    return apiValidationError(result.error);
  }

  const email = result.data.email.trim().toLowerCase();

  try {
    // Intentional cross-tenant read: the root login funnel resolves WHICH clinic(s)
    // an email belongs to, so there is no single clinic_id to scope to and no user
    // session on the root domain. The lookup below exists precisely to discover the
    // clinic_id, so it cannot filter by one.
    // nosemgrep: semgrep.admin-client-guard
    const supabase = createAdminClient("resolve_clinic");

    // nosemgrep: semgrep.tenant-scoping
    const { data: profiles, error: usersError } = await supabase
      .from("users")
      .select("clinic_id")
      .ilike("email", email)
      .eq("is_active", true);

    if (usersError) {
      logger.error("resolve-clinic user lookup failed", {
        context: "resolve-clinic",
        error: usersError,
      });
      return apiInternalError();
    }

    const clinicIds = Array.from(
      new Set((profiles ?? []).map((p) => p.clinic_id).filter((id): id is string => Boolean(id))),
    );

    if (clinicIds.length === 0) {
      return apiSuccess({ clinics: [] as ResolvedClinic[] });
    }

    const { data: clinics, error: clinicsError } = await supabase
      .from("clinics")
      .select("subdomain, name")
      .in("id", clinicIds)
      .eq("is_active", true)
      .is("deleted_at", null)
      .not("subdomain", "is", null);

    if (clinicsError) {
      logger.error("resolve-clinic clinic lookup failed", {
        context: "resolve-clinic",
        error: clinicsError,
      });
      return apiInternalError();
    }

    const resolved: ResolvedClinic[] = (clinics ?? [])
      .filter((c): c is { subdomain: string; name: string } => Boolean(c.subdomain))
      .map((c) => ({ subdomain: c.subdomain, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return apiSuccess({ clinics: resolved });
  } catch (err) {
    logger.error("Unhandled error in resolve-clinic", {
      context: "resolve-clinic",
      error: err,
    });
    return apiInternalError();
  }
}
