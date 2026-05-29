/**
 * Patient Timeline API
 *
 * GET /api/patient/timeline?patientId=<uuid>&eventType=<type>&search=<q>&from=<date>&to=<date>&page=1&limit=50
 *
 * Returns a unified timeline of all patient events (visits, prescriptions,
 * lab results, imaging, payments, notes, communications).
 *
 * Access: doctor, clinic_admin, super_admin
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import { timelineQuerySchema } from "@/lib/validations/patient-timeline";
import { withAuth, type AuthContext } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

const ALLOWED_ROLES: UserRole[] = ["super_admin", "clinic_admin", "doctor"];

interface TimelineEvent {
  id: string;
  event_type: string;
  event_date: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

async function handleGet(request: NextRequest, auth: AuthContext) {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = auth.supabase as unknown as ExtendedClient;

    const url = new URL(request.url);
    const rawParams = {
      patientId: url.searchParams.get("patientId") ?? undefined,
      eventType: url.searchParams.get("eventType") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    };

    const parsed = timelineQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      const count = parsed.error.issues.length;
      return apiError(
        `Validation error: ${count} field${count !== 1 ? "s" : ""} invalid`,
        422,
        "VALIDATION_ERROR",
      );
    }

    const { patientId, eventType, search, from, to, page, limit } = parsed.data;

    const patientCheck = await supabase
      .from("users")
      .select("id")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .single();

    if (!patientCheck.data) {
      return apiError("Patient not found in this clinic", 404, "PATIENT_NOT_FOUND");
    }

    const offset = (page - 1) * limit;

    const events: TimelineEvent[] = [];
    let totalCount = 0;

    if (!eventType || eventType === "visit") {
      const { count, data, error } = await fetchVisits(
        supabase,
        clinicId,
        patientId,
        search,
        from,
        to,
        eventType === "visit" ? limit : undefined,
        eventType === "visit" ? offset : undefined,
      );
      if (error) {
        logger.error("Failed to fetch visits for timeline", { clinicId, error });
      } else {
        events.push(...(data ?? []));
        totalCount += count ?? 0;
      }
    }

    if (!eventType || eventType === "prescription") {
      const { count, data, error } = await fetchPrescriptions(
        supabase,
        clinicId,
        patientId,
        search,
        from,
        to,
        eventType === "prescription" ? limit : undefined,
        eventType === "prescription" ? offset : undefined,
      );
      if (error) {
        logger.error("Failed to fetch prescriptions for timeline", { clinicId, error });
      } else {
        events.push(...(data ?? []));
        totalCount += count ?? 0;
      }
    }

    if (!eventType || eventType === "lab_result") {
      const { count, data, error } = await fetchLabResults(
        supabase,
        clinicId,
        patientId,
        search,
        from,
        to,
        eventType === "lab_result" ? limit : undefined,
        eventType === "lab_result" ? offset : undefined,
      );
      if (error) {
        logger.error("Failed to fetch lab results for timeline", { clinicId, error });
      } else {
        events.push(...(data ?? []));
        totalCount += count ?? 0;
      }
    }

    if (!eventType || eventType === "imaging") {
      const { count, data, error } = await fetchImaging(
        supabase,
        clinicId,
        patientId,
        search,
        from,
        to,
        eventType === "imaging" ? limit : undefined,
        eventType === "imaging" ? offset : undefined,
      );
      if (error) {
        logger.error("Failed to fetch imaging for timeline", { clinicId, error });
      } else {
        events.push(...(data ?? []));
        totalCount += count ?? 0;
      }
    }

    if (!eventType || eventType === "payment") {
      const { count, data, error } = await fetchPayments(
        supabase,
        clinicId,
        patientId,
        search,
        from,
        to,
        eventType === "payment" ? limit : undefined,
        eventType === "payment" ? offset : undefined,
      );
      if (error) {
        logger.error("Failed to fetch payments for timeline", { clinicId, error });
      } else {
        events.push(...(data ?? []));
        totalCount += count ?? 0;
      }
    }

    if (!eventType || eventType === "note") {
      const { count, data, error } = await fetchNotes(
        supabase,
        clinicId,
        patientId,
        search,
        from,
        to,
        eventType === "note" ? limit : undefined,
        eventType === "note" ? offset : undefined,
      );
      if (error) {
        logger.error("Failed to fetch notes for timeline", { clinicId, error });
      } else {
        events.push(...(data ?? []));
        totalCount += count ?? 0;
      }
    }

    if (!eventType || eventType === "communication") {
      const { count, data, error } = await fetchCommunications(
        supabase,
        clinicId,
        patientId,
        search,
        from,
        to,
        eventType === "communication" ? limit : undefined,
        eventType === "communication" ? offset : undefined,
      );
      if (error) {
        logger.error("Failed to fetch communications for timeline", { clinicId, error });
      } else {
        events.push(...(data ?? []));
        totalCount += count ?? 0;
      }
    }

    events.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

    const paginatedEvents = eventType ? events : events.slice(offset, offset + limit);

    await logAuditEvent({
      supabase: auth.supabase,
      action: "patient_timeline_viewed",
      type: "patient",
      clinicId,
      actor: auth.profile.id,
      description: `Viewed timeline for patient ${patientId}`,
      metadata: { patientId, eventType: eventType ?? "all", page },
    });

    return apiSuccess({
      events: paginatedEvents,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    logger.error("Patient timeline GET failed", { error });
    return apiInternalError();
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);

// ── Individual fetch helpers ──

type FetchResult = {
  data: TimelineEvent[] | null;
  count: number | null;
  error: unknown;
};

async function fetchVisits(
  supabase: ExtendedClient,
  clinicId: string,
  patientId: string,
  search: string | undefined,
  from: string | undefined,
  to: string | undefined,
  limit?: number,
  offset?: number,
): Promise<FetchResult> {
  let query = supabase
    .from("appointments")
    .select(
      "id, status, slot_start, slot_end, doctor_id, service_id, source, is_first_visit, notes, created_at",
      { count: "exact" },
    )
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (search) {
    query = query.ilike("notes", `%${search}%`);
  }
  if (from) {
    query = query.gte("slot_start", `${from}T00:00:00Z`);
  }
  if (to) {
    query = query.lte("slot_start", `${to}T23:59:59Z`);
  }

  query = query.order("slot_start", { ascending: false });
  if (typeof limit === "number") query = query.limit(limit);
  if (typeof offset === "number") query = query.range(offset, offset + (limit ?? 50) - 1);

  const { data, count, error } = await query;

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      event_type: "visit" as const,
      event_date: row.slot_start,
      metadata: {
        status: row.status,
        doctor_id: row.doctor_id,
        service_id: row.service_id,
        source: row.source,
        is_first_visit: row.is_first_visit,
        notes: row.notes,
        slot_end: row.slot_end,
      },
      created_at: row.created_at ?? row.slot_start,
    })),
    count,
    error,
  };
}

async function fetchPrescriptions(
  supabase: ExtendedClient,
  clinicId: string,
  patientId: string,
  search: string | undefined,
  from: string | undefined,
  to: string | undefined,
  limit?: number,
  offset?: number,
): Promise<FetchResult> {
  let query = supabase
    .from("prescriptions")
    .select("id, doctor_id, appointment_id, items, notes, pdf_url, created_at", { count: "exact" })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (search) {
    query = query.ilike("notes", `%${search}%`);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59Z`);
  }

  query = query.order("created_at", { ascending: false });
  if (typeof limit === "number") query = query.limit(limit);
  if (typeof offset === "number") query = query.range(offset, offset + (limit ?? 50) - 1);

  const { data, count, error } = await query;

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      event_type: "prescription" as const,
      event_date: row.created_at ?? new Date().toISOString(),
      metadata: {
        doctor_id: row.doctor_id,
        appointment_id: row.appointment_id,
        items: row.items,
        notes: row.notes,
        pdf_url: row.pdf_url,
      },
      created_at: row.created_at ?? new Date().toISOString(),
    })),
    count,
    error,
  };
}

async function fetchLabResults(
  supabase: ExtendedClient,
  clinicId: string,
  patientId: string,
  search: string | undefined,
  from: string | undefined,
  to: string | undefined,
  limit?: number,
  offset?: number,
): Promise<FetchResult> {
  let query = supabase
    .from("lab_results")
    .select("id, title, status, doctor_id, file_name, notes, created_at", { count: "exact" })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (search) {
    query = query.or(`title.ilike.%${search}%,notes.ilike.%${search}%`);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59Z`);
  }

  query = query.order("created_at", { ascending: false });
  if (typeof limit === "number") query = query.limit(limit);
  if (typeof offset === "number") query = query.range(offset, offset + (limit ?? 50) - 1);

  const { data, count, error } = await query;

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      event_type: "lab_result" as const,
      event_date: row.created_at ?? new Date().toISOString(),
      metadata: {
        title: row.title,
        status: row.status,
        doctor_id: row.doctor_id,
        file_name: row.file_name,
        notes: row.notes,
      },
      created_at: row.created_at ?? new Date().toISOString(),
    })),
    count,
    error,
  };
}

async function fetchImaging(
  supabase: ExtendedClient,
  clinicId: string,
  patientId: string,
  search: string | undefined,
  from: string | undefined,
  to: string | undefined,
  limit?: number,
  offset?: number,
): Promise<FetchResult> {
  let query = supabase
    .from("radiology_orders")
    .select(
      "id, modality, body_part, status, ordering_doctor_id, report_text, priority, performed_at, scheduled_at, created_at",
      { count: "exact" },
    )
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (search) {
    query = query.or(`body_part.ilike.%${search}%,report_text.ilike.%${search}%`);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59Z`);
  }

  query = query.order("created_at", { ascending: false });
  if (typeof limit === "number") query = query.limit(limit);
  if (typeof offset === "number") query = query.range(offset, offset + (limit ?? 50) - 1);

  const { data, count, error } = await query;

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      event_type: "imaging" as const,
      event_date:
        row.performed_at ?? row.scheduled_at ?? row.created_at ?? new Date().toISOString(),
      metadata: {
        modality: row.modality,
        body_part: row.body_part,
        status: row.status,
        ordering_doctor_id: row.ordering_doctor_id,
        report_text: row.report_text,
        priority: row.priority,
      },
      created_at: row.created_at ?? new Date().toISOString(),
    })),
    count,
    error,
  };
}

async function fetchPayments(
  supabase: ExtendedClient,
  clinicId: string,
  patientId: string,
  search: string | undefined,
  from: string | undefined,
  to: string | undefined,
  limit?: number,
  offset?: number,
): Promise<FetchResult> {
  let query = supabase
    .from("payments")
    .select("id, amount, method, status, ref, appointment_id, created_at", { count: "exact" })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (search) {
    query = query.ilike("ref", `%${search}%`);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59Z`);
  }

  query = query.order("created_at", { ascending: false });
  if (typeof limit === "number") query = query.limit(limit);
  if (typeof offset === "number") query = query.range(offset, offset + (limit ?? 50) - 1);

  const { data, count, error } = await query;

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      event_type: "payment" as const,
      event_date: row.created_at ?? new Date().toISOString(),
      metadata: {
        amount: row.amount,
        method: row.method,
        status: row.status,
        ref: row.ref,
        appointment_id: row.appointment_id,
      },
      created_at: row.created_at ?? new Date().toISOString(),
    })),
    count,
    error,
  };
}

async function fetchNotes(
  supabase: ExtendedClient,
  clinicId: string,
  patientId: string,
  search: string | undefined,
  from: string | undefined,
  to: string | undefined,
  limit?: number,
  offset?: number,
): Promise<FetchResult> {
  let query = supabase
    .from("consultation_notes")
    .select("id, doctor_id, appointment_id, notes, diagnosis, private, created_at", {
      count: "exact",
    })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  if (search) {
    query = query.or(`notes.ilike.%${search}%,diagnosis.ilike.%${search}%`);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59Z`);
  }

  query = query.order("created_at", { ascending: false });
  if (typeof limit === "number") query = query.limit(limit);
  if (typeof offset === "number") query = query.range(offset, offset + (limit ?? 50) - 1);

  const { data, count, error } = await query;

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      event_type: "note" as const,
      event_date: row.created_at ?? new Date().toISOString(),
      metadata: {
        doctor_id: row.doctor_id,
        appointment_id: row.appointment_id,
        notes: row.notes,
        diagnosis: row.diagnosis,
        private: row.private,
      },
      created_at: row.created_at ?? new Date().toISOString(),
    })),
    count,
    error,
  };
}

async function fetchCommunications(
  supabase: ExtendedClient,
  clinicId: string,
  patientId: string,
  search: string | undefined,
  from: string | undefined,
  to: string | undefined,
  limit?: number,
  offset?: number,
): Promise<FetchResult> {
  let query = supabase
    .from("notification_log")
    .select("id, channel, trigger, status, recipient_name, body, created_at", { count: "exact" })
    .eq("clinic_id", clinicId)
    .eq("channel", "whatsapp");

  if (search) {
    query = query.or(`body.ilike.%${search}%,recipient_name.ilike.%${search}%`);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59Z`);
  }

  query = query.order("created_at", { ascending: false });
  if (typeof limit === "number") query = query.limit(limit);
  if (typeof offset === "number") query = query.range(offset, offset + (limit ?? 50) - 1);

  const { data, count, error } = await query;

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      event_type: "communication" as const,
      event_date: row.created_at ?? new Date().toISOString(),
      metadata: {
        channel: row.channel,
        trigger: row.trigger,
        status: row.status,
        recipient_name: row.recipient_name,
        body: row.body,
      },
      created_at: row.created_at ?? new Date().toISOString(),
    })),
    count,
    error,
  };
}
