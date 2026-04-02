/**
 * AI WhatsApp Receptionist Admin API
 * GET  /api/ai/whatsapp-receptionist/admin — get receptionist settings + conversation log
 * POST /api/ai/whatsapp-receptionist/admin — update receptionist settings
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiSupabaseError, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── GET: Get AI receptionist settings + conversation log ──

export const GET = withAuth(
  async (request: NextRequest, { supabase, profile }: AuthContext) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const section = request.nextUrl.searchParams.get("section") ?? "settings";

    if (section === "conversations") {
      // Fetch recent WhatsApp conversation logs from activity_logs
      const { data: logs, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("action", "whatsapp_receptionist.message")
        .order("timestamp", { ascending: false })
        .limit(100);

      if (error) return apiSupabaseError(error, "whatsapp-receptionist/conversations");
      return apiSuccess({ conversations: logs ?? [] });
    }

    // Fetch clinic config for AI receptionist settings
    const { data: clinic, error } = await supabase
      .from("clinics")
      .select("config")
      .eq("id", clinicId)
      .single();

    if (error) return apiSupabaseError(error, "whatsapp-receptionist/settings");

    const config = (clinic?.config ?? {}) as Record<string, unknown>;
    const aiSettings = {
      ai_enabled: config.whatsapp_ai_enabled ?? true,
      business_hours_only: config.whatsapp_business_hours_only ?? false,
      custom_greeting: (config.whatsapp_custom_greeting as string) ?? "",
      custom_responses: (config.whatsapp_custom_responses as Record<string, string>) ?? {},
      handoff_enabled: config.whatsapp_handoff_enabled ?? true,
      handoff_phone: (config.whatsapp_handoff_phone as string) ?? "",
      language: (config.whatsapp_language as string) ?? "fr",
    };

    return apiSuccess({ settings: aiSettings });
  },
  ["super_admin", "clinic_admin"],
);

// ── POST: Update AI receptionist settings ──

export const POST = withAuth(
  async (request: NextRequest, { supabase, profile }: AuthContext) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return apiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    // Fetch current config
    const { data: clinic, error: fetchError } = await supabase
      .from("clinics")
      .select("config")
      .eq("id", clinicId)
      .single();

    if (fetchError) return apiSupabaseError(fetchError, "whatsapp-receptionist/fetch-config");

    const currentConfig = (clinic?.config ?? {}) as Record<string, unknown>;

    // Merge AI receptionist settings into clinic config
    const updatedConfig = {
      ...currentConfig,
      ...(body.ai_enabled !== undefined && { whatsapp_ai_enabled: body.ai_enabled }),
      ...(body.business_hours_only !== undefined && { whatsapp_business_hours_only: body.business_hours_only }),
      ...(body.custom_greeting !== undefined && { whatsapp_custom_greeting: body.custom_greeting }),
      ...(body.custom_responses !== undefined && { whatsapp_custom_responses: body.custom_responses }),
      ...(body.handoff_enabled !== undefined && { whatsapp_handoff_enabled: body.handoff_enabled }),
      ...(body.handoff_phone !== undefined && { whatsapp_handoff_phone: body.handoff_phone }),
      ...(body.language !== undefined && { whatsapp_language: body.language }),
    };

    const { error: updateError } = await supabase
      .from("clinics")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ config: updatedConfig as any })
      .eq("id", clinicId);

    if (updateError) return apiSupabaseError(updateError, "whatsapp-receptionist/update");

    logger.info("WhatsApp AI receptionist settings updated", {
      context: "whatsapp-receptionist-admin",
      clinicId,
    });

    return apiSuccess({ updated: true });
  },
  ["super_admin", "clinic_admin"],
);
