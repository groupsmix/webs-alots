/**
 * POST /api/v1/register-clinic
 *
 * Self-service clinic registration endpoint (no auth required).
 * Creates a new clinic + admin auth user + assigns the free "vitrine" plan
 * + generates a subdomain + sends a WhatsApp welcome message.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiValidationError, apiInternalError } from "@/lib/api-response";
import { generateSubdomain } from "@/lib/generate-subdomain";
import { logger } from "@/lib/logger";
import { phoneToWhatsApp } from "@/lib/morocco";
import { createRateLimiter, extractClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase-server";
import { safeParse } from "@/lib/validations";
import { sendTextMessage } from "@/lib/whatsapp";

// ---------------------------------------------------------------------------
// Anti-Abuse Rate Limiter
// ---------------------------------------------------------------------------
// Extremely strict rate limit for public registration (2 per hour per IP)
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 2 });

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const registerClinicSchema = z.object({
  clinic_name: z.string().min(2, "Le nom de la clinique est requis").max(200),
  doctor_name: z.string().min(2, "Le nom du docteur est requis").max(200),
  email: z.string().email("Email invalide").max(254),
  phone: z.string().min(8, "Numéro de téléphone invalide").max(30),
  specialty: z.string().min(1, "La spécialité est requise").max(200),
  city: z.string().max(200).optional(),
  // F-28: Cloudflare Turnstile token for bot protection
  turnstile_token: z.string().min(1, "Turnstile verification required").optional(),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Check feature flag first
  if (process.env.SELF_SERVICE_REGISTRATION_ENABLED !== "true") {
    return apiError("Self-service registration is currently disabled.", 403);
  }

  // Rate limiting (IP-based)
  const clientIp = extractClientIp(request);
  if (!(await registerLimiter.check(`register_${clientIp}`))) {
    logger.warn("Public registration rate-limit exceeded", { context: "register-clinic", ip: clientIp });
    return apiError("Too many registration attempts. Please try again later.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const result = safeParse(registerClinicSchema, body);
  if (!result.success) {
    return apiValidationError(result.error);
  }

  const data = result.data;

  // F-28: Verify Cloudflare Turnstile token if configured
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!data.turnstile_token) {
      return apiError("Turnstile verification is required", 400);
    }
    try {
      const verifyRes = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: data.turnstile_token,
            remoteip: clientIp,
          }),
        },
      );
      const verifyData = (await verifyRes.json()) as { success: boolean };
      if (!verifyData.success) {
        logger.warn("Turnstile verification failed", {
          context: "register-clinic",
          ip: clientIp,
        });
        return apiError("Bot verification failed. Please try again.", 403);
      }
    } catch (err) {
      logger.error("Turnstile verification request failed", {
        context: "register-clinic",
        error: err,
      });
      // Fail open on Turnstile service outage to avoid blocking all registrations
    }
  }

  try {
    const supabase = createAdminClient();

    // 1. Check if email is already registered.
    // Querying our own "users" table is O(1) and safe for admin.
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .ilike("email", data.email)
      .maybeSingle();

    if (existingUser) {
      return apiError(
        "Un compte existe déjà avec cet email. Veuillez vous connecter.",
        409,
        "EMAIL_EXISTS",
      );
    }

    // 2. Generate subdomain and check uniqueness
    let subdomain = generateSubdomain(data.clinic_name);

    const { data: existingClinic } = await supabase
      .from("clinics")
      .select("id")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (existingClinic) {
      // Extremely unlikely with random suffix, but handle it
      subdomain = generateSubdomain(data.clinic_name);
    }

    // 3. Create the auth user with a random password (user will reset via email)
    // We must do this first since the RPC transaction needs the auth_id
    const tempPassword = crypto.randomUUID();
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.doctor_name,
      },
    });

    if (authError || !authUser?.user) {
      logger.error("Failed to create auth user during self-service registration", {
        context: "register-clinic",
        error: authError,
      });
      return apiInternalError("Impossible de créer le compte. Veuillez réessayer.");
    }

    // 4. Create the clinic and user profile atomically (Audit 5.6 Fix)
    const rpc = supabase.rpc as (
      fn: "register_new_clinic",
      args: {
        p_clinic_name: string;
        p_subdomain: string;
        p_phone: string;
        p_doctor_name: string;
        p_email: string;
        p_city: string | null;
        p_specialty: string;
        p_auth_id: string;
      }
    ) => ReturnType<typeof supabase.rpc>;

    const { data: clinicId, error: rpcError } = await rpc("register_new_clinic", {
      p_clinic_name: data.clinic_name,
      p_subdomain: subdomain,
      p_phone: data.phone,
      p_doctor_name: data.doctor_name,
      p_email: data.email,
      p_city: data.city ?? null,
      p_specialty: data.specialty,
      p_auth_id: authUser.user.id,
    });

    if (rpcError || !clinicId) {
      logger.error("Failed to execute atomic registration RPC", {
        context: "register-clinic",
        error: rpcError,
      });
      // The RPC rolled back the DB, but we still need to delete the orphaned auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return apiInternalError("Impossible de créer la clinique et le profil. Veuillez réessayer.");
    }

    // Update the auth user metadata with the newly generated clinic_id
    await supabase.auth.admin.updateUserById(authUser.user.id, {
      user_metadata: {
        full_name: data.doctor_name,
        clinic_id: clinicId,
      }
    });

    // 6. Send WhatsApp welcome message (non-blocking, best-effort)
    const clinicUrl = `https://${subdomain}.oltigo.com`;
    const whatsappPhone = phoneToWhatsApp(data.phone);
    const welcomeMessage =
      `Bienvenue sur Oltigo, Dr ${data.doctor_name} ! 🎉\n\n` +
      `Votre clinique "${data.clinic_name}" est créée.\n` +
      `Votre site : ${clinicUrl}\n\n` +
      `Connectez-vous pour compléter la configuration de votre cabinet :\n` +
      `https://oltigo.com/login\n\n` +
      `À bientôt !`;

    sendTextMessage(whatsappPhone, welcomeMessage).catch((err) => {
      logger.warn("WhatsApp welcome message failed during registration", {
        context: "register-clinic",
        error: err,
      });
    });

    logger.info("New clinic registered successfully", {
      context: "register-clinic",
      clinicId,
      subdomain,
      clientIp,
    });

    return apiSuccess(
      {
        status: "created",
        message: "Clinique créée avec succès",
        clinic_id: clinicId,
        subdomain,
        clinic_url: clinicUrl,
      },
      201,
    );
  } catch (err) {
    logger.error("Unhandled error in register-clinic", {
      context: "register-clinic",
      error: err,
    });
    return apiInternalError();
  }
}
