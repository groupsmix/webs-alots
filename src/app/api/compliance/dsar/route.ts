import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { insertInAppNotification } from "@/lib/notification-persist";
import { createServiceClient } from "@/lib/supabase-server";

const dsarSchema = z.object({
  requesterName: z.string().min(2).max(200),
  requesterEmail: z.string().email(),
  requesterPhone: z.string().max(50).optional().or(z.literal("")),
  clinicName: z.string().max(200).optional().or(z.literal("")),
  requestType: z.enum(["access", "rectification", "deletion", "portability", "objection"]),
  description: z.string().min(20).max(2000),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "VALIDATION_ERROR");
  }

  const parsed = dsarSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("Invalid DSAR payload", 400, "VALIDATION_ERROR");
  }

  const supabase = createServiceClient();
  const responseDueAt = new Date();
  responseDueAt.setDate(responseDueAt.getDate() + 30);

  let clinicId: string | null = null;
  if (parsed.data.clinicName) {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id")
      .ilike("name", parsed.data.clinicName)
      .limit(1)
      .maybeSingle();
    clinicId = clinic?.id ?? null;
  }

  const { data: dsar, error } = await supabase
    .from("dsar_requests")
    .insert({
      requester_type: "external",
      requester_name: parsed.data.requesterName,
      requester_email: parsed.data.requesterEmail,
      requester_phone: parsed.data.requesterPhone || null,
      clinic_id: clinicId,
      request_type: parsed.data.requestType,
      description: parsed.data.description,
      response_due_at: responseDueAt.toISOString(),
    })
    .select("dsar_number")
    .single();

  if (error || !dsar) {
    return apiError("Failed to create DSAR request", 500, "INTERNAL_ERROR");
  }

  const { data: admins } = await supabase.from("users").select("id").eq("role", "super_admin");
  for (const admin of admins ?? []) {
    await insertInAppNotification({
      userId: admin.id,
      trigger: "follow_up",
      title: `Nouvelle demande DSAR #${dsar.dsar_number}`,
      message: `${parsed.data.requesterName} a soumis une demande ${parsed.data.requestType}.`,
    });
  }

  return apiSuccess({ dsarNumber: dsar.dsar_number }, 201);
}