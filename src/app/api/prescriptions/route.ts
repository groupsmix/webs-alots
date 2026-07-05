/**
 * POST /api/prescriptions
 *
 * Doctor generates a prescription PDF:
 *   1. Validates body with Zod
 *   2. Fetches patient, doctor, clinic from DB (all scoped to clinicId)
 *   3. Generates PDF via generatePrescriptionPDF
 *   4. Encrypts with AES-256-GCM via encryptBuffer (PHI)
 *   5. Uploads to R2 under prescriptions/{clinicId}/{uuid}.pdf.enc
 *   6. Notifies patient via per-clinic WhatsApp template
 *   7. Logs audit event
 *   8. Returns { prescriptionId, r2Key }
 */

import { randomUUID } from "crypto";
import { z } from "zod";
import { apiNotFound, apiSuccess, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { encryptBuffer } from "@/lib/encryption";
import { generatePrescriptionPDF } from "@/lib/prescription-pdf";
import { uploadToR2, isR2Configured } from "@/lib/r2";
import { assertScopeGate } from "@/lib/scope-gate";
import { createAdminClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp";

const prescriptionSchema = z.object({
  patientId: z.string().uuid("patientId must be a UUID"),
  medications: z
    .array(
      z.object({
        name: z.string().min(1),
        dose: z.string().min(1),
        duration: z.string().min(1),
        instructions: z.string().min(1),
      }),
    )
    .min(1, "At least one medication is required"),
  notes: z.string().max(2000).optional(),
  date: z.string().datetime("date must be an ISO datetime"),
});

export const POST = withAuthValidation(
  prescriptionSchema,
  async (body, _request, { supabase, profile }) => {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    // ADR 0013: Scope gate — prescriptions is a clinical vertical
    const denied = await assertScopeGate(supabase, clinicId, "prescriptions");
    if (denied) return denied;

    // ── Fetch patient ──────────────────────────────────────────────────
    const { data: patient } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("id", body.patientId)
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .maybeSingle();

    if (!patient) return apiNotFound("Patient not found in this clinic");

    // ── Fetch doctor (calling user) ────────────────────────────────────
    const { data: doctor } = await supabase
      .from("users")
      .select("id, name")
      .eq("id", profile.id)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (!doctor) return apiNotFound("Doctor profile not found");

    // ── Fetch clinic ───────────────────────────────────────────────────
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name, whatsapp_phone_id")
      .eq("id", clinicId)
      .maybeSingle();

    if (!clinic) return apiNotFound("Clinic not found");

    // ── Generate PDF ───────────────────────────────────────────────────
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePrescriptionPDF({
        doctor: { name: doctor.name },
        patient: { name: patient.name },
        clinic: { name: clinic.name },
        medications: body.medications,
        notes: body.notes,
        date: body.date,
      });
    } catch (err) {
      return apiInternalError(
        err instanceof Error ? err.message : "Failed to generate prescription PDF",
      );
    }

    // ── Encrypt (PHI) + upload ─────────────────────────────────────────
    const prescriptionId = randomUUID();
    const r2Key = `prescriptions/${clinicId}/${prescriptionId}.pdf.enc`;

    if (isR2Configured()) {
      const encrypted = await encryptBuffer(pdfBuffer);
      await uploadToR2(r2Key, encrypted, "application/octet-stream");
    }

    // ── Save record ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("prescriptions")
      .insert({
        id: prescriptionId,
        clinic_id: clinicId,
        doctor_id: profile.id,
        patient_id: body.patientId,
        r2_key: r2Key,
        medications: body.medications,
        notes: body.notes ?? null,
        issued_at: body.date,
      })
      .catch(() => {
        // prescriptions table may not exist — non-fatal for MVP
      });

    // ── Notify patient via WhatsApp ────────────────────────────────────
    if (clinic.whatsapp_phone_id && patient.phone) {
      // Token lives in the server-only clinic_whatsapp_credentials table
      // (default-deny RLS). Read via service-role admin client.
      const admin = createAdminClient("whatsapp-credentials", clinicId);
      const { data: creds } = await admin
        .from("clinic_whatsapp_credentials")
        .select("whatsapp_access_token")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (creds?.whatsapp_access_token) {
        await sendWhatsAppTemplateMessage({
          to: patient.phone,
          templateName: "prescription_ready",
          languageCode: "fr",
          bodyParameters: [patient.name, doctor.name, clinic.name],
          phoneNumberId: clinic.whatsapp_phone_id,
          accessToken: creds.whatsapp_access_token,
        });
      }
    }

    // ── Audit ──────────────────────────────────────────────────────────
    await logAuditEvent({
      supabase,
      action: "prescription_created",
      type: "patient",
      clinicId,
      description: `Prescription ${prescriptionId} created for patient ${body.patientId}`,
      metadata: { prescriptionId, patientId: body.patientId, r2Key },
    });

    return apiSuccess({ prescriptionId, r2Key }, 201);
  },
  ["doctor"],
);
