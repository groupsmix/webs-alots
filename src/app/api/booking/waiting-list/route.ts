import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";

export const runtime = "edge";

/**
 * POST /api/booking/waiting-list
 *
 * Add a patient to the waiting list.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      patientId: string;
      patientName: string;
      doctorId: string;
      preferredDate: string;
      preferredTime?: string;
      serviceId?: string;
    };

    if (!body.patientId || !body.patientName || !body.doctorId || !body.preferredDate) {
      return NextResponse.json(
        { error: "patientId, patientName, doctorId, and preferredDate are required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // If patientId looks like a temp ID, try to find or create the patient
    let patientId = body.patientId;
    if (patientId.startsWith("patient-")) {
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("clinic_id", clinicConfig.clinicId)
        .eq("name", body.patientName)
        .eq("role", "patient")
        .limit(1)
        .single();

      if (existing) {
        patientId = existing.id;
      } else {
        const { data: newPatient, error: createError } = await supabase
          .from("users")
          .insert({
            clinic_id: clinicConfig.clinicId,
            name: body.patientName,
            role: "patient",
          })
          .select("id")
          .single();
        if (createError || !newPatient) {
          return NextResponse.json({ error: "Failed to create patient" }, { status: 500 });
        }
        patientId = newPatient.id;
      }
    }

    const { data: entry, error } = await supabase
      .from("waiting_list")
      .insert({
        clinic_id: clinicConfig.clinicId,
        patient_id: patientId,
        doctor_id: body.doctorId,
        preferred_date: body.preferredDate,
        preferred_time: body.preferredTime ?? null,
        service_id: body.serviceId ?? null,
        status: "waiting",
      })
      .select("id")
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: error?.message ?? "Failed to add to waiting list" }, { status: 400 });
    }

    return NextResponse.json({
      status: "added",
      message: "Added to waiting list",
      entryId: entry.id,
    });
  } catch {
    return NextResponse.json({ error: "Failed to add to waiting list" }, { status: 500 });
  }
}

/**
 * GET /api/booking/waiting-list?patientId=...  OR  ?doctorId=...&date=...
 *
 * Get waiting list entries.
 */
export async function GET(request: NextRequest) {
  const patientId = request.nextUrl.searchParams.get("patientId");
  const doctorId = request.nextUrl.searchParams.get("doctorId");
  const date = request.nextUrl.searchParams.get("date");
  const time = request.nextUrl.searchParams.get("time");

  const supabase = await createClient();
  const clinicId = clinicConfig.clinicId;

  if (patientId) {
    const { data: entries } = await supabase
      .from("waiting_list")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ entries: entries ?? [] });
  }

  if (doctorId && date) {
    let q = supabase
      .from("waiting_list")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .eq("preferred_date", date);

    if (time) {
      q = q.eq("preferred_time", time);
    }

    const { data: entries } = await q.order("created_at", { ascending: true });
    return NextResponse.json({ entries: entries ?? [] });
  }

  return NextResponse.json(
    { error: "patientId, or doctorId and date are required" },
    { status: 400 },
  );
}

/**
 * DELETE /api/booking/waiting-list
 *
 * Remove a patient from the waiting list.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { entryId: string };

    if (!body.entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("waiting_list")
      .delete()
      .eq("id", body.entryId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ status: "removed", message: "Removed from waiting list" });
  } catch {
    return NextResponse.json({ error: "Failed to remove from waiting list" }, { status: 500 });
  }
}
