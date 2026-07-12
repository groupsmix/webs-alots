/**
 * Gestion du consentement RGPD/Loi 09-08 pour les interactions WhatsApp
 *
 * Adapté du pattern whatsapp-receptionist (GDPR Art.15/17 + audit logging).
 * Implémente la gestion du consentement pour les communications WhatsApp
 * conformément à:
 * - RGPD (Règlement Général sur la Protection des Données)
 * - Loi marocaine 09-08 relative à la protection des personnes physiques
 *   à l'égard du traitement des données à caractère personnel
 *
 * Fonctionnalités:
 * 1. Enregistrement du consentement avec horodatage et IP
 * 2. Révocation du consentement (opt-out)
 * 3. Vérification du statut de consentement avant envoi
 * 4. Export des données de consentement (Art. 15 RGPD / Art. 7 Loi 09-08)
 * 5. Suppression des données (Art. 17 RGPD / Art. 8 Loi 09-08)
 * 6. Audit trail complet
 */

import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { sendTextMessage } from "@/lib/whatsapp";

// ── Types ──

type ConsentStatus = "granted" | "revoked" | "pending" | "expired";

export interface WhatsAppConsentRecord {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_phone: string;
  status: ConsentStatus;
  granted_at: string | null;
  revoked_at: string | null;
  ip_address: string | null;
  consent_method: "whatsapp_reply" | "web_form" | "in_person" | "api";
  consent_version: string;
  data_categories: string[];
}

export interface ConsentClient {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        val: unknown,
      ): {
        eq(
          col2: string,
          val2: unknown,
        ): {
          single(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          order(
            col3: string,
            opts: { ascending: boolean },
          ): Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
        };
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        order(
          col2: string,
          opts: { ascending: boolean },
        ): Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
      };
    };
    upsert(
      row: Record<string, unknown>,
      opts?: { onConflict: string },
    ): Promise<{ error: unknown }>;
    insert(row: Record<string, unknown>): {
      select(): Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
    };
    update(row: Record<string, unknown>): {
      eq(
        col: string,
        val: unknown,
      ): {
        eq(col2: string, val2: unknown): Promise<{ error: unknown }>;
      };
    };
    delete(): {
      eq(
        col: string,
        val: unknown,
      ): {
        eq(col2: string, val2: unknown): Promise<{ error: unknown }>;
      };
    };
  };
}

// ── Constantes ──

const CONSENT_VERSION = "1.0";
const DEFAULT_DATA_CATEGORIES = [
  "appointment_notifications",
  "prescription_alerts",
  "lab_results",
  "payment_reminders",
  "general_communications",
];

// ── Gestion du consentement ──

/**
 * Enregistrer le consentement WhatsApp d'un patient.
 */
export async function grantWhatsAppConsent(
  supabase: ConsentClient,
  params: {
    clinicId: string;
    clinicName: string;
    patientId: string;
    patientPhone: string;
    method: WhatsAppConsentRecord["consent_method"];
    ipAddress?: string;
    dataCategories?: string[];
  },
): Promise<{ success: boolean; error?: string }> {
  const { clinicId, clinicName, patientId, patientPhone, method, ipAddress, dataCategories } =
    params;

  const now = new Date().toISOString();

  const { error } = await supabase.from("whatsapp_consent").upsert(
    {
      clinic_id: clinicId,
      patient_id: patientId,
      patient_phone: patientPhone,
      status: "granted",
      granted_at: now,
      revoked_at: null,
      ip_address: ipAddress ?? null,
      consent_method: method,
      consent_version: CONSENT_VERSION,
      data_categories: dataCategories ?? DEFAULT_DATA_CATEGORIES,
      updated_at: now,
    },
    { onConflict: "clinic_id,patient_id" },
  );

  if (error) {
    logger.warn("Échec de l'enregistrement du consentement WhatsApp", {
      context: "whatsapp/consent",
      clinicId,
      error,
    });
    return { success: false, error: "Échec de l'enregistrement du consentement" };
  }

  // Enregistrer dans le journal d'audit
  const auditClient = supabase as unknown as Parameters<typeof logAuditEvent>[0]["supabase"];
  await logAuditEvent({
    supabase: auditClient,
    action: "whatsapp_consent_granted",
    type: "patient",
    clinicId,
    clinicName,
    actor: patientId,
    description: `Consentement WhatsApp accordé via ${method}`,
    ipAddress: ipAddress ?? null,
  });

  // Enregistrer dans consent_logs aussi pour compliance
  await supabase
    .from("consent_logs")
    .insert({
      clinic_id: clinicId,
      user_id: patientId,
      consent_type: "whatsapp_communications",
      granted: true,
      ip_address: ipAddress ?? null,
    })
    .select();

  logger.info("Consentement WhatsApp accordé", {
    context: "whatsapp/consent",
    clinicId,
    method,
  });

  return { success: true };
}

/**
 * Révoquer le consentement WhatsApp d'un patient.
 */
export async function revokeWhatsAppConsent(
  supabase: ConsentClient,
  params: {
    clinicId: string;
    clinicName: string;
    patientId: string;
    ipAddress?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const { clinicId, clinicName, patientId, ipAddress } = params;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("whatsapp_consent")
    .update({
      status: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (error) {
    logger.warn("Échec de la révocation du consentement WhatsApp", {
      context: "whatsapp/consent",
      clinicId,
      error,
    });
    return { success: false, error: "Échec de la révocation du consentement" };
  }

  const auditClient = supabase as unknown as Parameters<typeof logAuditEvent>[0]["supabase"];
  await logAuditEvent({
    supabase: auditClient,
    action: "whatsapp_consent_revoked",
    type: "patient",
    clinicId,
    clinicName,
    actor: patientId,
    description: "Consentement WhatsApp révoqué par le patient",
    ipAddress: ipAddress ?? null,
  });

  await supabase
    .from("consent_logs")
    .insert({
      clinic_id: clinicId,
      user_id: patientId,
      consent_type: "whatsapp_communications",
      granted: false,
      ip_address: ipAddress ?? null,
    })
    .select();

  return { success: true };
}

/**
 * Vérifier si un patient a donné son consentement WhatsApp pour une clinique.
 */
export async function hasWhatsAppConsent(
  supabase: ConsentClient,
  clinicId: string,
  patientId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_consent")
    .select("status")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .maybeSingle();

  return data?.status === "granted";
}

/**
 * Obtenir le statut complet de consentement WhatsApp.
 */
export async function getConsentStatus(
  supabase: ConsentClient,
  clinicId: string,
  patientId: string,
): Promise<WhatsAppConsentRecord | null> {
  const { data } = await supabase
    .from("whatsapp_consent")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    clinic_id: data.clinic_id as string,
    patient_id: data.patient_id as string,
    patient_phone: data.patient_phone as string,
    status: data.status as ConsentStatus,
    granted_at: data.granted_at as string | null,
    revoked_at: data.revoked_at as string | null,
    ip_address: data.ip_address as string | null,
    consent_method: data.consent_method as WhatsAppConsentRecord["consent_method"],
    consent_version: data.consent_version as string,
    data_categories: data.data_categories as string[],
  };
}

// ── Export des données (Art. 15 RGPD / Art. 7 Loi 09-08) ──

export interface ConsentDataExport {
  consent: WhatsAppConsentRecord | null;
  consentHistory: Array<{
    action: string;
    timestamp: string;
    method: string;
  }>;
}

/**
 * Exporter toutes les données de consentement WhatsApp d'un patient
 * pour une clinique (droit d'accès RGPD Art. 15).
 */
export async function exportConsentData(
  supabase: ConsentClient,
  clinicId: string,
  patientId: string,
): Promise<ConsentDataExport> {
  const consent = await getConsentStatus(supabase, clinicId, patientId);

  const { data: history } = await supabase
    .from("consent_logs")
    .select("consent_type, granted, created_at")
    .eq("clinic_id", clinicId)
    .eq("user_id", patientId)
    .order("created_at", { ascending: false });

  const consentHistory = (history ?? []).map((h: Record<string, unknown>) => ({
    action: h.granted ? "granted" : "revoked",
    timestamp: h.created_at as string,
    method: "whatsapp_communications",
  }));

  return { consent, consentHistory };
}

// ── Suppression des données (Art. 17 RGPD / Art. 8 Loi 09-08) ──

/**
 * Supprimer toutes les données de consentement et conversations WhatsApp
 * d'un patient pour une clinique (droit à l'effacement RGPD Art. 17).
 */
export async function deletePatientWhatsAppData(
  supabase: ConsentClient,
  params: {
    clinicId: string;
    clinicName: string;
    patientId: string;
  },
): Promise<{ success: boolean; deletedRecords: number }> {
  const { clinicId, clinicName, patientId } = params;
  let deletedCount = 0;

  // Supprimer le consentement
  const { error: consentErr } = await supabase
    .from("whatsapp_consent")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (!consentErr) deletedCount++;

  // Supprimer les conversations WhatsApp
  const { error: convErr } = await supabase
    .from("whatsapp_conversations")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (!convErr) deletedCount++;

  // Supprimer les transcriptions vocales
  const { error: voiceErr } = await supabase
    .from("whatsapp_voice_transcriptions")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (!voiceErr) deletedCount++;

  const auditClient = supabase as unknown as Parameters<typeof logAuditEvent>[0]["supabase"];
  await logAuditEvent({
    supabase: auditClient,
    action: "whatsapp_patient_data_deleted",
    type: "patient",
    clinicId,
    clinicName,
    actor: patientId,
    description: `Données WhatsApp supprimées (Art. 17 RGPD): ${deletedCount} catégories`,
  });

  return { success: true, deletedRecords: deletedCount };
}

// ── Traitement du consentement via WhatsApp ──

/**
 * Traiter une réponse de consentement reçue via WhatsApp (OUI/NON).
 * Utilisé dans le webhook handler quand un patient répond à une
 * demande de consentement.
 */
export async function handleConsentReply(
  supabase: ConsentClient,
  params: {
    clinicId: string;
    clinicName: string;
    patientId: string;
    patientPhone: string;
    replyText: string;
  },
): Promise<boolean> {
  const { clinicId, clinicName, patientId, patientPhone, replyText } = params;
  const upper = replyText.trim().toUpperCase();

  if (upper === "OUI" || upper === "YES" || upper === "نعم") {
    const result = await grantWhatsAppConsent(supabase, {
      clinicId,
      clinicName,
      patientId,
      patientPhone,
      method: "whatsapp_reply",
    });

    if (result.success) {
      await sendTextMessage(
        patientPhone,
        `Merci! Votre consentement a été enregistré. ` +
          `Vous pouvez révoquer votre consentement à tout moment en envoyant "STOP".\n\n` +
          `— ${clinicName}`,
        clinicId,
      );
      return true;
    }
  } else if (upper === "NON" || upper === "NO" || upper === "لا" || upper === "STOP") {
    const result = await revokeWhatsAppConsent(supabase, {
      clinicId,
      clinicName,
      patientId,
    });

    if (result.success) {
      await sendTextMessage(
        patientPhone,
        `Votre consentement a été révoqué. Nous ne vous enverrons plus de messages WhatsApp.\n\n` +
          `Si vous changez d'avis, contactez votre clinique.\n\n` +
          `— ${clinicName}`,
        clinicId,
      );
      return true;
    }
  }

  return false;
}
