import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import {
  computeRecallDueDate,
  getRecallMessageTemplate,
  matchRecallRule,
  type RecallType,
} from "@/lib/config/recall-rules";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { enqueueNotification } from "@/lib/notification-queue";
import { substituteVariables } from "@/lib/notifications";
import { withSentryCron } from "@/lib/sentry-cron";
// B-02: Cron jobs run without a user session, so the cookie-based client would
// execute as anon under RLS and return 0 rows. Use the service-role admin
// client which bypasses RLS, then scope every operation per-clinic in code.
import { createAdminClient } from "@/lib/supabase-server";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import type { Database as ExtendedDatabase } from "@/lib/types/database-extended";

type ExtendedClient = SupabaseClient<ExtendedDatabase>;

/** Recall types that have a localized message template. */
const KNOWN_RECALL_TYPES: RecallType[] = ["detartrage", "orthodontic", "implant"];

/** How far back to scan completed appointments for new recalls. */
const GENERATION_LOOKBACK_DAYS = 3;

/** Max completed appointments scanned per run (generation phase). */
const MAX_COMPLETED_PER_RUN = 2_000;

/** Max recalls dispatched per run (send phase). */
const MAX_RECALLS_PER_RUN = 500;

/** Columns selected from completed appointments during recall generation. */
const APPOINTMENT_RECALL_COLS =
  "id, clinic_id, patient_id, service_id, appointment_date, slot_start, updated_at, services:service_id (name)" as const;

/** Upsert options that make recall generation idempotent per source appointment. */
const RECALL_UPSERT_OPTIONS = {
  onConflict: "clinic_id,source_appointment_id,recall_type",
  ignoreDuplicates: true,
} as const;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isKnownRecallType(value: string): value is RecallType {
  return (KNOWN_RECALL_TYPES as string[]).includes(value);
}

/**
 * GET /api/cron/recalls
 *
 * Dental recall engine. Runs daily (see worker-cron-handler.ts / wrangler.toml).
 *
 * Phase 1 — Generate: scan recently completed appointments for recall-eligible
 * services (détartrage, orthodontie, implant) and create a `patient_recalls`
 * row with a due date in the future. Idempotent via the
 * (clinic_id, source_appointment_id, recall_type) unique index.
 *
 * Phase 2 — Dispatch: enqueue a localized WhatsApp recall for every pending
 * recall whose due_date has arrived. Recalls require explicit WhatsApp consent
 * (enforced in notification-queue), keeping this within Lane-A boundaries.
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    // nosemgrep: semgrep.admin-client-guard — recalls run as a cross-tenant cron sweep; per-clinic scoping is enforced row-by-row below
    const supabase = createAdminClient("cron");
    const recallsClient = supabase as unknown as ExtendedClient;

    // Short-circuit when there are no active clinics (MA-04: exclude soft-deleted).
    const { count: activeClinicsCount } = await supabase
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null);

    if (!activeClinicsCount) {
      return apiSuccess({
        message: "No active clinics found, skipping cron",
        generated: 0,
        sent: 0,
      });
    }

    // ── Phase 1: Generate recalls from completed appointments ──

    const lookbackISO = new Date(
      Date.now() - GENERATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: completed, error: completedError } = await supabase
      .from("appointments")
      .select(APPOINTMENT_RECALL_COLS) // nosemgrep: semgrep.tenant-scoping — cross-tenant cron sweep; each row is assertClinicId-validated and clinic_id-scoped downstream
      .eq("status", APPOINTMENT_STATUS.COMPLETED)
      .gte("updated_at", lookbackISO)
      .not("service_id", "is", null)
      .limit(MAX_COMPLETED_PER_RUN);

    if (completedError) {
      logger.warn("recalls cron: failed to query completed appointments", {
        context: "cron/recalls",
        error: completedError,
      });
      return apiInternalError("Failed to query completed appointments");
    }

    type RecallInsert = ExtendedDatabase["public"]["Tables"]["patient_recalls"]["Insert"];
    const recallsToCreate: RecallInsert[] = [];

    for (const appt of completed ?? []) {
      if (!appt.clinic_id || !appt.patient_id || !appt.service_id) continue;
      try {
        assertClinicId(appt.clinic_id, "cron/recalls:generate");
      } catch {
        continue;
      }

      const service = firstOf(appt.services);
      const rule = matchRecallRule(service?.name);
      if (!rule) continue;

      const completedDate = appt.appointment_date ?? appt.slot_start;
      if (!completedDate) continue;
      const dueDate = computeRecallDueDate(completedDate, rule.intervalDays);
      if (!dueDate) continue;

      recallsToCreate.push({
        clinic_id: appt.clinic_id,
        patient_id: appt.patient_id,
        source_appointment_id: appt.id,
        service_id: appt.service_id,
        recall_type: rule.recallType,
        due_date: dueDate,
        status: "pending",
      });
    }

    let generated = 0;
    if (recallsToCreate.length > 0) {
      const { data: inserted, error: insertError } = await recallsClient
        .from("patient_recalls")
        .upsert(recallsToCreate, RECALL_UPSERT_OPTIONS) // nosemgrep: semgrep.tenant-scoping — bulk upsert; every row carries its own clinic_id (see recallsToCreate)
        .select("id");
      if (insertError) {
        logger.warn("recalls cron: failed to insert recalls", {
          context: "cron/recalls",
          error: insertError,
        });
      } else {
        generated = inserted?.length ?? 0;
      }
    }

    // ── Phase 2: Dispatch due recalls ──

    const today = new Date().toISOString().slice(0, 10);
    const { data: dueRecalls, error: dueError } = await recallsClient
      .from("patient_recalls")
      .select("id, clinic_id, patient_id, service_id, recall_type, due_date") // nosemgrep: semgrep.tenant-scoping — cross-tenant cron sweep; each recall is assertClinicId-validated and clinic_id-scoped before dispatch/update
      .eq("status", "pending")
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(MAX_RECALLS_PER_RUN);

    if (dueError) {
      logger.warn("recalls cron: failed to query due recalls", {
        context: "cron/recalls",
        error: dueError,
      });
      return apiInternalError("Failed to query due recalls");
    }

    const recalls = dueRecalls ?? [];
    if (recalls.length === 0) {
      return apiSuccess({ message: "No due recalls", generated, sent: 0 });
    }

    // Batch-load related patients + clinics to avoid N+1 lookups.
    const patientIds = [...new Set(recalls.map((r) => r.patient_id))];
    const clinicIds = [...new Set(recalls.map((r) => r.clinic_id))];

    const [{ data: patients }, { data: clinics }] = await Promise.all([
      supabase.from("users").select("id, name, phone").in("id", patientIds), // nosemgrep: semgrep.tenant-scoping — batch lookup by primary key for the clinic-scoped recalls resolved above
      supabase.from("clinics").select("id, name, config").in("id", clinicIds),
    ]);

    const patientMap = new Map((patients ?? []).map((p) => [p.id, p]));
    const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c]));

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const recall of recalls) {
      try {
        assertClinicId(recall.clinic_id, "cron/recalls:dispatch");
      } catch {
        skipped++;
        continue;
      }

      if (!isKnownRecallType(recall.recall_type)) {
        skipped++;
        continue;
      }

      const patient = patientMap.get(recall.patient_id);
      if (!patient?.phone) {
        // No phone on file — mark skipped so it isn't retried forever.
        await recallsClient
          .from("patient_recalls")
          .update({ status: "skipped", updated_at: new Date().toISOString() })
          .eq("id", recall.id)
          .eq("clinic_id", recall.clinic_id);
        skipped++;
        continue;
      }

      const clinic = clinicMap.get(recall.clinic_id);
      const clinicName = clinic?.name ?? "Clinic";
      const clinicConfig = (clinic?.config ?? null) as Record<string, unknown> | null;
      const locale = (clinicConfig?.patient_message_locale as string | undefined) ?? "fr";

      const body = substituteVariables(getRecallMessageTemplate(recall.recall_type, locale), {
        patient_name: patient.name ?? "",
        clinic_name: clinicName,
      });

      const queueId = await enqueueNotification({
        clinicId: recall.clinic_id,
        channel: "whatsapp",
        recipient: patient.phone,
        body,
        trigger: "recall",
        metadata: {
          recipient_id: patient.id,
          clinic_name: clinicName,
          locale,
          recall_id: recall.id,
          recall_type: recall.recall_type,
        },
      });

      if (queueId) {
        await recallsClient
          .from("patient_recalls")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            notification_queue_id: queueId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recall.id)
          .eq("clinic_id", recall.clinic_id);
        sent++;
      } else {
        await recallsClient
          .from("patient_recalls")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", recall.id)
          .eq("clinic_id", recall.clinic_id);
        failed++;
      }
    }

    if (failed > 0) {
      logger.warn("recalls cron completed with failures", {
        context: "cron/recalls",
        sent,
        failed,
        skipped,
      });
    }

    return apiSuccess({
      message: `Recall run complete`,
      generated,
      sent,
      failed,
      skipped,
    });
  } catch (err) {
    logger.error("Failed to run recalls cron", { context: "cron/recalls", error: err });
    return apiInternalError("Failed to process recalls");
  }
}

export const GET = withSentryCron("recalls-daily", "0 9 * * *", handler);
