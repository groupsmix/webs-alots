/**
 * Waitlist promotion logic.
 *
 * Called after an appointment is cancelled. Finds the oldest un-notified
 * waitlist entry for the cancelled doctor + clinic, marks it as notified,
 * and sends a WhatsApp template message with a 2-hour claim link.
 */

import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp";

export interface PromoteWaitlistParams {
  doctorId: string;
  clinicId: string;
  /** ISO timestamp of the freed slot */
  cancelledSlot: string;
}

export async function promoteWaitlist(params: PromoteWaitlistParams): Promise<void> {
  const supabase = await createClient();

  // Oldest un-notified entry for this doctor/clinic
  const { data: entry } = await supabase
    .from("waitlist")
    .select(
      `
      id,
      patient_id,
      clinic_id,
      patient:users!patient_id ( name, phone ),
      clinic:clinics ( name, whatsapp_phone_id )
    `,
    )
    .eq("doctor_id", params.doctorId)
    .eq("clinic_id", params.clinicId)
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!entry) return; // no one waiting

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1_000); // 2 h

  await supabase
    .from("waitlist")
    .update({
      notified_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", entry.id)
    .eq("clinic_id", params.clinicId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patient = (entry as any).patient as { name: string; phone: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clinic = (entry as any).clinic as {
    name: string;
    whatsapp_phone_id: string | null;
  } | null;

  if (!patient?.phone) {
    logger.warn("promoteWaitlist: patient has no phone, skipping WhatsApp", {
      context: "waitlist",
      entryId: entry.id,
    });
    return;
  }

  const claimUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/booking/claim/${entry.id}`;
  const slotLabel = new Date(params.cancelledSlot).toLocaleString("fr-MA", {
    timeZone: "Africa/Casablanca",
    dateStyle: "full",
    timeStyle: "short",
  });

  if (clinic?.whatsapp_phone_id) {
    // Token lives in the server-only clinic_whatsapp_credentials table
    // (default-deny RLS). Use the admin client to read it.
    const admin = createAdminClient("whatsapp-credentials", params.clinicId);
    const { data: creds } = await admin
      .from("clinic_whatsapp_credentials")
      .select("whatsapp_access_token")
      .eq("clinic_id", params.clinicId)
      .maybeSingle();

    if (creds?.whatsapp_access_token) {
      await sendWhatsAppTemplateMessage({
        to: patient.phone,
        templateName: "slot_available",
        languageCode: "fr",
        bodyParameters: [patient.name, slotLabel, claimUrl, "2 heures"],
        phoneNumberId: clinic.whatsapp_phone_id,
        accessToken: creds.whatsapp_access_token,
      });
    } else {
      logger.warn("promoteWaitlist: clinic has no WhatsApp credentials configured", {
        context: "waitlist",
        clinicId: params.clinicId,
      });
    }
  }

  await logAuditEvent({
    supabase,
    action: "waitlist_patient_notified",
    type: "booking",
    clinicId: params.clinicId,
    description: `Waitlist entry ${entry.id} promoted after slot ${params.cancelledSlot} freed`,
    metadata: { entryId: entry.id, patientId: entry.patient_id },
  });
}
