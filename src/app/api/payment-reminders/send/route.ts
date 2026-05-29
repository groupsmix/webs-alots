import { apiSuccess, apiError, apiNotFound } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import {
  invoicesTable,
  paymentPlansTable,
  paymentPlanInstallmentsTable,
  paymentRemindersTable,
} from "@/lib/billing-db";
import { logger } from "@/lib/logger";
import { reminderSendSchema } from "@/lib/validations/billing";
import { sendTextMessage } from "@/lib/whatsapp";

/**
 * POST /api/payment-reminders/send
 * Manually send a payment reminder via WhatsApp.
 */
export const POST = withAuthValidation(
  reminderSendSchema,
  async (body, _request, { supabase, profile }) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiError("Clinic context required", 403);

    const { invoice_id, installment_id, reminder_type } = body;

    let patientId: string | null = null;
    let amountCentimes = 0;
    let invoiceNumber = "";

    if (invoice_id) {
      // nosemgrep: semgrep.tenant-scoping
      const { data: invoice, error } = await invoicesTable(supabase)
        .select("id, patient_id, total_centimes, amount_paid_centimes, invoice_number") // nosemgrep: semgrep.tenant-scoping
        .eq("id", invoice_id)
        .eq("clinic_id", clinicId)
        .single();

      if (error || !invoice) return apiNotFound("Invoice not found");
      patientId = invoice.patient_id;
      amountCentimes = invoice.total_centimes - invoice.amount_paid_centimes;
      invoiceNumber = invoice.invoice_number;
    }

    if (installment_id) {
      // nosemgrep: semgrep.tenant-scoping
      const { data: installment, error } = await paymentPlanInstallmentsTable(supabase)
        .select("id, amount_centimes, plan_id") // nosemgrep: semgrep.tenant-scoping
        .eq("id", installment_id)
        .eq("clinic_id", clinicId)
        .single();

      if (error || !installment) return apiNotFound("Installment not found");
      amountCentimes = installment.amount_centimes;

      // nosemgrep: semgrep.tenant-scoping
      const { data: plan } = await paymentPlansTable(supabase)
        .select("patient_id, invoice_id") // nosemgrep: semgrep.tenant-scoping
        .eq("id", installment.plan_id)
        .eq("clinic_id", clinicId)
        .single();

      if (plan) {
        patientId = plan.patient_id;
        // nosemgrep: semgrep.tenant-scoping
        const { data: inv } = await invoicesTable(supabase)
          .select("invoice_number") // nosemgrep: semgrep.tenant-scoping
          .eq("id", plan.invoice_id)
          .eq("clinic_id", clinicId)
          .single();
        if (inv) invoiceNumber = inv.invoice_number;
      }
    }

    if (!patientId) return apiError("Could not resolve patient for reminder", 400);

    const { data: patient } = await supabase
      .from("users")
      .select("id, phone, name")
      .eq("id", patientId)
      .single();

    if (!patient?.phone) {
      return apiError("Patient has no phone number", 400, "NO_PHONE");
    }

    const amountMad = (amountCentimes / 100).toFixed(2);
    const message = buildReminderMessage(
      reminder_type,
      patient.name ?? "Patient",
      amountMad,
      invoiceNumber,
    );

    // nosemgrep: semgrep.tenant-scoping
    const { data: reminder, error: reminderError } = await paymentRemindersTable(supabase)
      .insert({
        clinic_id: clinicId,
        invoice_id: invoice_id ?? null,
        installment_id: installment_id ?? null,
        patient_id: patientId,
        reminder_type,
        channel: "whatsapp",
        status: "pending",
      })
      .select() // nosemgrep: semgrep.tenant-scoping
      .single();

    if (reminderError) {
      logger.error("Failed to create reminder", {
        context: "payment-reminders/create",
        error: reminderError,
      });
      return apiError("Failed to create reminder", 500);
    }

    const result = await sendTextMessage(patient.phone, message);

    const updateFields = result.success
      ? { status: "sent" as const, sent_at: new Date().toISOString() }
      : { status: "failed" as const, error_message: result.error ?? "Unknown error" };

    // nosemgrep: semgrep.tenant-scoping
    await paymentRemindersTable(supabase)
      .update(updateFields)
      .eq("id", reminder.id)
      .eq("clinic_id", clinicId);

    if (!result.success) {
      logger.warn("Payment reminder WhatsApp send failed", {
        context: "payment-reminders/send",
        reminderId: reminder.id,
        error: result.error,
      });
    }

    await logAuditEvent({
      supabase,
      action: "payment_reminder.sent",
      type: "payment",
      clinicId,
      actor: profile.id,
      description: `Payment reminder (${reminder_type}) sent to ${patient.name}`,
      metadata: {
        reminder_id: reminder.id,
        reminder_type,
        success: result.success,
      },
    });

    return apiSuccess({
      reminder_id: reminder.id,
      sent: result.success,
      error: result.error ?? null,
    });
  },
  STAFF_ROLES,
);

function buildReminderMessage(
  type: string,
  patientName: string,
  amountMad: string,
  invoiceNumber: string,
): string {
  const base = `مرحبا ${patientName}،`;
  switch (type) {
    case "overdue_3d":
      return `${base} عندك فاتورة ${invoiceNumber} ما خلصتهاش. المبلغ: ${amountMad} MAD. من فضلك خلص في أقرب وقت.`;
    case "overdue_7d":
      return `${base} تذكير: فاتورة ${invoiceNumber} فات عليها 7 أيام. المبلغ: ${amountMad} MAD.`;
    case "overdue_14d":
      return `${base} تذكير أخير: فاتورة ${invoiceNumber} فات عليها 14 يوم. المبلغ: ${amountMad} MAD. من فضلك تواصل معانا.`;
    case "installment_upcoming":
      return `${base} عندك قسط قادم ديال ${amountMad} MAD (فاتورة ${invoiceNumber}). من فضلك خلص في الوقت.`;
    case "installment_overdue":
      return `${base} القسط ديالك ديال ${amountMad} MAD (فاتورة ${invoiceNumber}) فات عليه الوقت. من فضلك خلص في أقرب وقت.`;
    default:
      return `${base} عندك مبلغ ${amountMad} MAD خاصك تخلصو (فاتورة ${invoiceNumber}).`;
  }
}
