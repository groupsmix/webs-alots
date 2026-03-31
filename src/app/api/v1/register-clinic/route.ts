/**
 * POST /api/v1/register-clinic
 *
 * Self-service clinic registration endpoint (no auth required).
 * Creates a new clinic + admin auth user + assigns the free "vitrine" plan
 * + generates a subdomain + sends a WhatsApp welcome message.
 */

import { z } from "zod";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { generateSubdomain } from "@/lib/generate-subdomain";
import { sendTextMessage } from "@/lib/whatsapp";
import { phoneToWhatsApp } from "@/lib/morocco";
import { apiSuccess, apiError, apiValidationError, apiInternalError } from "@/lib/api-response";
import { safeParse } from "@/lib/validations";
import { logger } from "@/lib/logger";

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

    // 1. Check if email is already registered
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
    );
    if (emailExists) {
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

    // 3. Create the clinic with free "vitrine" tier
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .insert({
        name: data.clinic_name,
        type: "doctor",
        tier: "vitrine",
        status: "active",
        subdomain,
        phone: data.phone,
        owner_name: data.doctor_name,
        owner_email: data.email,
        city: data.city ?? null,
        config: {
          specialty: data.specialty,
          city: data.city ?? null,
          phone: data.phone,
          email: data.email,
          onboarding_completed: false,
        },
      })
      .select("id")
      .single();

    if (clinicError || !clinic) {
      logger.error("Failed to create clinic during self-service registration", {
        context: "register-clinic",
        error: clinicError,
      });
      return apiInternalError("Impossible de créer la clinique. Veuillez réessayer.");
    }

    // 4. Create the auth user with a random password (user will reset via email)
    const tempPassword = crypto.randomUUID();
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.doctor_name,
        clinic_id: clinic.id,
      },
    });

    if (authError || !authUser?.user) {
      logger.error("Failed to create auth user during self-service registration", {
        context: "register-clinic",
        error: authError,
      });
      // Rollback clinic
      await supabase.from("clinics").delete().eq("id", clinic.id);
      return apiInternalError("Impossible de créer le compte. Veuillez réessayer.");
    }

    // 5. Create the clinic admin user record
    const { error: userError } = await supabase.from("users").insert({
      auth_id: authUser.user.id,
      clinic_id: clinic.id,
      role: "clinic_admin",
      name: data.doctor_name,
      phone: data.phone,
      email: data.email,
    });

    if (userError) {
      logger.error("Failed to create user profile during self-service registration", {
        context: "register-clinic",
        error: userError,
      });
      // Rollback auth user and clinic
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase.from("clinics").delete().eq("id", clinic.id);
      return apiInternalError("Impossible de créer le profil. Veuillez réessayer.");
    }

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
        clinic_id: clinic.id,
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
