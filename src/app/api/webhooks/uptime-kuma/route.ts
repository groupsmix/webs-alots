import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { insertInAppNotification } from "@/lib/notification-persist";
import { createServiceClient, createUntypedAdminClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.UPTIME_KUMA_WEBHOOK_SECRET) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "VALIDATION_ERROR");
  }

  const body = payload as {
    monitor?: { name?: string; url?: string };
    heartbeat?: { status?: number; ping?: number };
    msg?: string;
  };

  const eventType =
    body.heartbeat?.status === 0 ? "down" : body.heartbeat?.status === 1 ? "up" : "degraded";

  // uptime_events is introduced by migration 00160 and not yet in the
  // generated Supabase types — use the untyped admin client for that insert.
  // The typed client is kept for the users lookup below.
  const supabase = createServiceClient();
  const untypedSupabase = createUntypedAdminClient("super_admin");
  await untypedSupabase.from("uptime_events").insert({
    monitor_name: body.monitor?.name ?? "unknown",
    monitor_url: body.monitor?.url ?? null,
    event_type: eventType,
    message: body.msg ?? null,
    response_time_ms: body.heartbeat?.ping ?? null,
  });

  if (eventType === "down") {
    const { data: admins } = await supabase.from("users").select("id").eq("role", "super_admin");
    for (const admin of admins ?? []) {
      await insertInAppNotification({
        userId: admin.id,
        trigger: "follow_up",
        title: `Incident système: ${body.monitor?.name ?? "unknown"}`,
        message: `Le service ${body.monitor?.name ?? "unknown"} est indisponible.`,
      });
    }
  }

  return apiSuccess({ received: true });
}
