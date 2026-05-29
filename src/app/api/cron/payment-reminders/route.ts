import { NextResponse } from "next/server";
import { untypedClient } from "@/lib/billing-db";
import { logger } from "@/lib/logger";
import { sendTextMessage } from "@/lib/whatsapp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedTable = { from(table: string): any };

/**
 * POST /api/cron/payment-reminders
 * Automated cron job to send payment reminders for overdue invoices and upcoming installments.
 * Iterates per-clinic as required by AGENTS.md.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { createAdminClient } = await import("@/lib/supabase-server");
  const supabase = createAdminClient("cron");
  const db = untypedClient(supabase);

  const { data: clinics, error: clinicsError } = await supabase.from("clinics").select("id, name");

  if (clinicsError || !clinics) {
    logger.error("Failed to fetch clinics for payment reminders cron", {
      context: "cron/payment-reminders",
      error: clinicsError,
    });
    return NextResponse.json({ error: "Failed to fetch clinics" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const clinic of clinics) {
    try {
      await processClinicReminders(db, supabase, clinic.id, today, results);
    } catch (err) {
      logger.error("Error processing payment reminders for clinic", {
        context: "cron/payment-reminders",
        clinicId: clinic.id,
        error: err,
      });
    }
  }

  logger.info("Payment reminders cron completed", {
    context: "cron/payment-reminders",
    results,
  });

  return NextResponse.json({ ok: true, results });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

async function processClinicReminders(
  db: UntypedTable,
  supabase: AdminClient,
  clinicId: string,
  today: string,
  results: { sent: number; failed: number; skipped: number },
): Promise<void> {
  const overdueDays = [
    { days: 3, type: "overdue_3d" },
    { days: 7, type: "overdue_7d" },
    { days: 14, type: "overdue_14d" },
  ] as const;

  for (const { days, type } of overdueDays) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    // nosemgrep: semgrep.tenant-scoping
    const { data: overdueInvoices } = await db
      .from("invoices") // nosemgrep: semgrep.tenant-scoping
      .select("id, patient_id, total_centimes, amount_paid_centimes, invoice_number") // nosemgrep: semgrep.tenant-scoping
      .eq("clinic_id", clinicId)
      .in("status", ["sent", "overdue", "partially_paid"])
      .eq("due_date", targetDateStr);

    if (!overdueInvoices) continue;

    for (const invoice of overdueInvoices) {
      // nosemgrep: semgrep.tenant-scoping
      const { count: existingCount } = await db
        .from("payment_reminders") // nosemgrep: semgrep.tenant-scoping
        .select("id", { count: "exact", head: true }) // nosemgrep: semgrep.tenant-scoping
        .eq("clinic_id", clinicId)
        .eq("invoice_id", invoice.id)
        .eq("reminder_type", type);

      if (existingCount && existingCount > 0) {
        results.skipped++;
        continue;
      }

      await sendReminderForInvoice(db, supabase, clinicId, invoice, type, results);
    }
  }

  // Upcoming installments — 1 day before due
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // nosemgrep: semgrep.tenant-scoping
  const { data: upcomingInstallments } = await db
    .from("payment_plan_installments") // nosemgrep: semgrep.tenant-scoping
    .select("id, plan_id, amount_centimes, due_date") // nosemgrep: semgrep.tenant-scoping
    .eq("clinic_id", clinicId)
    .eq("status", "pending")
    .eq("due_date", tomorrowStr);

  if (upcomingInstallments) {
    for (const installment of upcomingInstallments) {
      // nosemgrep: semgrep.tenant-scoping
      const { count: existingCount } = await db
        .from("payment_reminders") // nosemgrep: semgrep.tenant-scoping
        .select("id", { count: "exact", head: true }) // nosemgrep: semgrep.tenant-scoping
        .eq("clinic_id", clinicId)
        .eq("installment_id", installment.id)
        .eq("reminder_type", "installment_upcoming");

      if (existingCount && existingCount > 0) {
        results.skipped++;
        continue;
      }

      // nosemgrep: semgrep.tenant-scoping
      const { data: plan } = await db
        .from("payment_plans") // nosemgrep: semgrep.tenant-scoping
        .select("patient_id, invoice_id") // nosemgrep: semgrep.tenant-scoping
        .eq("id", installment.plan_id)
        .eq("clinic_id", clinicId)
        .single();

      if (!plan) continue;

      const { data: patient } = await supabase
        .from("users")
        .select("id, phone, name")
        .eq("id", plan.patient_id)
        .single();

      if (!patient?.phone) {
        results.skipped++;
        continue;
      }

      const amountMad = (installment.amount_centimes / 100).toFixed(2);
      const message = `مرحبا ${patient.name ?? "Patient"}، عندك قسط قادم ديال ${amountMad} MAD غدا. من فضلك خلص في الوقت.`;

      await sendAndRecordReminder(
        db,
        clinicId,
        null,
        installment.id,
        plan.patient_id,
        "installment_upcoming",
        patient.phone,
        message,
        results,
      );
    }
  }

  // Overdue installments
  // nosemgrep: semgrep.tenant-scoping
  const { data: overdueInstallments } = await db
    .from("payment_plan_installments") // nosemgrep: semgrep.tenant-scoping
    .select("id, plan_id, amount_centimes, due_date") // nosemgrep: semgrep.tenant-scoping
    .eq("clinic_id", clinicId)
    .eq("status", "pending")
    .lt("due_date", today);

  if (overdueInstallments) {
    for (const installment of overdueInstallments) {
      // nosemgrep: semgrep.tenant-scoping
      await db
        .from("payment_plan_installments") // nosemgrep: semgrep.tenant-scoping
        .update({ status: "overdue", updated_at: new Date().toISOString() })
        .eq("id", installment.id)
        .eq("clinic_id", clinicId);

      // nosemgrep: semgrep.tenant-scoping
      const { count: existingCount } = await db
        .from("payment_reminders") // nosemgrep: semgrep.tenant-scoping
        .select("id", { count: "exact", head: true }) // nosemgrep: semgrep.tenant-scoping
        .eq("clinic_id", clinicId)
        .eq("installment_id", installment.id)
        .eq("reminder_type", "installment_overdue");

      if (existingCount && existingCount > 0) {
        results.skipped++;
        continue;
      }

      // nosemgrep: semgrep.tenant-scoping
      const { data: plan } = await db
        .from("payment_plans") // nosemgrep: semgrep.tenant-scoping
        .select("patient_id") // nosemgrep: semgrep.tenant-scoping
        .eq("id", installment.plan_id)
        .eq("clinic_id", clinicId)
        .single();

      if (!plan) continue;

      const { data: patient } = await supabase
        .from("users")
        .select("id, phone, name")
        .eq("id", plan.patient_id)
        .single();

      if (!patient?.phone) {
        results.skipped++;
        continue;
      }

      const amountMad = (installment.amount_centimes / 100).toFixed(2);
      const message = `مرحبا ${patient.name ?? "Patient"}، القسط ديالك ديال ${amountMad} MAD فات عليه الوقت. من فضلك خلص في أقرب وقت.`;

      await sendAndRecordReminder(
        db,
        clinicId,
        null,
        installment.id,
        plan.patient_id,
        "installment_overdue",
        patient.phone,
        message,
        results,
      );
    }
  }
}

async function sendReminderForInvoice(
  db: UntypedTable,
  supabase: AdminClient,
  clinicId: string,
  invoice: {
    id: string;
    patient_id: string;
    total_centimes: number;
    amount_paid_centimes: number;
    invoice_number: string;
  },
  reminderType: string,
  results: { sent: number; failed: number; skipped: number },
): Promise<void> {
  const { data: patient } = await supabase
    .from("users")
    .select("id, phone, name")
    .eq("id", invoice.patient_id)
    .single();

  if (!patient?.phone) {
    results.skipped++;
    return;
  }

  const remaining = invoice.total_centimes - invoice.amount_paid_centimes;
  const amountMad = (remaining / 100).toFixed(2);
  const name = patient.name ?? "Patient";

  let message: string;
  switch (reminderType) {
    case "overdue_3d":
      message = `مرحبا ${name}، عندك فاتورة ${invoice.invoice_number} ما خلصتهاش. المبلغ: ${amountMad} MAD.`;
      break;
    case "overdue_7d":
      message = `مرحبا ${name}، تذكير: فاتورة ${invoice.invoice_number} فات عليها 7 أيام. المبلغ: ${amountMad} MAD.`;
      break;
    case "overdue_14d":
      message = `مرحبا ${name}، تذكير أخير: فاتورة ${invoice.invoice_number} فات عليها 14 يوم. المبلغ: ${amountMad} MAD.`;
      break;
    default:
      message = `مرحبا ${name}، عندك مبلغ ${amountMad} MAD خاصك تخلصو.`;
  }

  await sendAndRecordReminder(
    db,
    clinicId,
    invoice.id,
    null,
    invoice.patient_id,
    reminderType,
    patient.phone,
    message,
    results,
  );
}

async function sendAndRecordReminder(
  db: UntypedTable,
  clinicId: string,
  invoiceId: string | null,
  installmentId: string | null,
  patientId: string,
  reminderType: string,
  phone: string,
  message: string,
  results: { sent: number; failed: number; skipped: number },
): Promise<void> {
  // nosemgrep: semgrep.tenant-scoping
  const { data: reminder } = await db
    .from("payment_reminders") // nosemgrep: semgrep.tenant-scoping
    .insert({
      clinic_id: clinicId,
      invoice_id: invoiceId,
      installment_id: installmentId,
      patient_id: patientId,
      reminder_type: reminderType,
      channel: "whatsapp",
      status: "pending",
    })
    .select() // nosemgrep: semgrep.tenant-scoping
    .single();

  if (!reminder) {
    results.failed++;
    return;
  }

  const result = await sendTextMessage(phone, message);

  if (result.success) {
    // nosemgrep: semgrep.tenant-scoping
    await db
      .from("payment_reminders") // nosemgrep: semgrep.tenant-scoping
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", reminder.id)
      .eq("clinic_id", clinicId);
    results.sent++;
  } else {
    // nosemgrep: semgrep.tenant-scoping
    await db
      .from("payment_reminders") // nosemgrep: semgrep.tenant-scoping
      .update({ status: "failed", error_message: result.error ?? "Unknown" })
      .eq("id", reminder.id)
      .eq("clinic_id", clinicId);
    results.failed++;
  }
}
