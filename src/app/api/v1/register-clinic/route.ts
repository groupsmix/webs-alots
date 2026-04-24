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
import { createAdminClient } from "@/lib/supabase-server";
import { safeParse } from "@/lib/validations";
import { sendTextMessage } from "@/lib/whatsapp";

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
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
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
    // Cast to any since register_new_clinic is not yet in the generated types
    const { data: clinicId, error: rpcError } = await (supabase.rpc as any)("register_new_clinic", {
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
