/**
 * POST /api/auth/demo-login
 *
 * One-click demo login — signs in as a pre-seeded demo user.
 * Uses the Supabase admin client to create a session without a real password.
 *
 * Only works for emails belonging to the demo tenant.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-server";
import { DEMO_USERS, DEMO_CLINIC_ID } from "@/lib/demo";
import { apiError, apiSuccess, apiValidationError, apiInternalError, apiForbidden, apiRateLimited } from "@/lib/api-response";
import { safeParse } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { loginLimiter, extractClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase-server";

const demoLoginSchema = z.object({
  email: z.string().email(),
});

/** Emails allowed for demo login. */
const ALLOWED_DEMO_EMAILS: Set<string> = new Set(
  Object.values(DEMO_USERS).map((u) => u.email),
);

export async function POST(request: NextRequest) {
  // AUTH-01: Verify the demo clinic actually exists in the database before
  // allowing demo login. This prevents authentication bypass in production
  // environments where the demo tenant has been removed or was never seeded.
  const supabaseCheck = await createClient();
  const { data: demoClinic } = await supabaseCheck
    .from("clinics")
    .select("id")
    .eq("id", DEMO_CLINIC_ID)
    .maybeSingle();

  if (!demoClinic) {
    return apiForbidden("Demo mode is not available");
  }

  // Rate limit demo login to prevent abuse (same limits as regular login)
  const clientIp = extractClientIp(request);
  const allowed = await loginLimiter.check(`demo-login:${clientIp}`);
  if (!allowed) {
    return apiRateLimited("Too many demo login attempts. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const result = safeParse(demoLoginSchema, body);
  if (!result.success) {
    return apiValidationError(result.error);
  }

  const { email } = result.data;

  if (!ALLOWED_DEMO_EMAILS.has(email)) {
    return apiError("Email non autorisé pour le mode démo", 403);
  }

  try {
    const supabase = createAdminClient();

    // Ensure the demo auth user exists (idempotent)
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create the demo auth user
      const demoUser = Object.values(DEMO_USERS).find((u) => u.email === email);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: {
          full_name: demoUser?.name ?? "Demo User",
          is_demo: true,
        },
      });

      if (createError || !newUser?.user) {
        logger.error("Failed to create demo auth user", {
          context: "demo-login",
          error: createError,
        });
        return apiInternalError("Impossible de créer le compte démo");
      }

      userId = newUser.user.id;

      // Link auth user to the existing demo profile
      if (demoUser) {
        await supabase
          .from("users")
          .update({ auth_id: userId })
          .eq("id", demoUser.id);
      }
    }

    // Generate a magic link token for the demo user
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    if (linkError || !linkData) {
      logger.error("Failed to generate demo magic link", {
        context: "demo-login",
        error: linkError,
      });
      return apiInternalError("Impossible de générer le lien de connexion démo");
    }

    // Return the token hash and verification type for client-side verification
    const url = new URL(linkData.properties.action_link);
    const tokenHash = url.searchParams.get("token_hash") ?? url.hash;
    const type = url.searchParams.get("type") ?? "magiclink";

    return apiSuccess({
      token_hash: tokenHash,
      type,
      user_id: userId,
      user_id: userId,
    });
  } catch (err) {
    logger.error("Unhandled error in demo-login", {
      context: "demo-login",
      error: err,
    });
    return apiInternalError();
  }
}
