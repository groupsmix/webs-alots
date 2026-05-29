import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import { staffInviteSchema } from "@/lib/validations/staff-invitations";
import { withAuth } from "@/lib/with-auth";

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

/**
 * GET /api/staff-invitations
 * Liste des invitations du personnel. Supporte ?status=... &page=... &limit=...
 */
export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  if (!clinicId) return apiError("Contexte clinique requis", 403);

  const url = request.nextUrl;
  const status = url.searchParams.get("status");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  let query = supabase
    .from("staff_invitations")
    .select("*", { count: "exact" })
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) {
    logger.error("Échec du chargement des invitations", {
      context: "staff-invitations/list",
      error,
    });
    return apiError("Échec du chargement des invitations", 500);
  }

  return apiSuccess({ invitations: data, total: count ?? 0, page, limit });
}, ADMIN_ROLES);

/**
 * POST /api/staff-invitations
 * Inviter un membre du personnel par email (adapté de MediFlow).
 */
export const POST = withAuthValidation(
  staffInviteSchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Contexte clinique requis", 403);

    const { email, role } = body;

    const { data: existing } = await supabase
      .from("staff_invitations")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return apiError("Une invitation est déjà en attente pour cet email", 409, "CONFLICT");
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error } = await supabase
      .from("staff_invitations")
      .insert({
        clinic_id: clinicId,
        email,
        role,
        invited_by: profile.id,
        token,
        status: "pending",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      logger.error("Échec de la création de l'invitation", {
        context: "staff-invitations/create",
        error,
      });
      return apiError("Échec de la création de l'invitation", 500);
    }

    const roleLabels: Record<string, string> = {
      clinic_admin: "Administrateur",
      receptionist: "Réceptionniste",
      doctor: "Médecin",
    };

    await sendEmail({
      to: email,
      subject: "Invitation à rejoindre Oltigo Health",
      html: `
        <h2>Vous êtes invité(e) à rejoindre une clinique sur Oltigo Health</h2>
        <p>Vous avez été invité(e) en tant que <strong>${roleLabels[role] ?? role}</strong>.</p>
        <p>Cliquez sur le lien ci-dessous pour accepter l'invitation :</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://oltigo.com"}/auth/accept-invite?token=${token}">
          Accepter l'invitation
        </a></p>
        <p>Ce lien expire dans 7 jours.</p>
      `,
    });

    await logAuditEvent({
      supabase,
      action: "staff_invitation.create",
      type: "admin",
      clinicId,
      actor: profile.id,
      description: `Invitation envoyée à ${email} en tant que ${role}`,
      metadata: { invitation_id: invitation.id, email, role },
    });

    return apiSuccess({ invitation }, 201);
  },
  ADMIN_ROLES,
);
