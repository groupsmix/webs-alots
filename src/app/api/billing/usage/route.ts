import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPlanConfig, normalizeSubscriptionPlan } from "@/lib/subscription-billing";
import { createTenantClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/billing/usage
 *
 * Fetches the current subscription plan, status, usage, and limits for a clinic.
 * Requires clinic_admin or super_admin role.
 */
export const GET = withAuth(
  async (request: NextRequest, { profile }) => {
    // In super-admin context, clinicId might be passed in query string.
    // In clinic_admin context, we use the profile's clinic_id.
    const url = new URL(request.url);
    const queryClinicId = url.searchParams.get("clinicId");

    let targetClinicId = profile.clinic_id;
    if (profile.role === "super_admin" && queryClinicId) {
      targetClinicId = queryClinicId;
    }

    if (!targetClinicId) {
      return apiError("No clinic associated with this request", 400);
    }

    // Use tenant client scoped to the target clinic
    const supabase = await createTenantClient(targetClinicId);

    // 1. Fetch Subscription
    const { data: sub } = await supabase
      .from("clinic_subscriptions")
      .select("plan, status")
      .eq("clinic_id", targetClinicId)
      .single();

    const status = sub?.status || "active";

    // Deep-Dive P1/P2: normalize legacy tier slugs (e.g. `pro`, `cabinet`)
    // before resolving plan config, instead of silently collapsing any
    // unrecognized value to "free" (which understated usage limits for
    // clinics still on a legacy `clinic_subscriptions.plan` value).
    const planSlug = normalizeSubscriptionPlan(sub?.plan);
    const planConfig = getPlanConfig(planSlug);

    // 2. Fetch Staff Used (clinic_admin, receptionist, doctor)
    const { count: staffCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", targetClinicId)
      .in("role", ["clinic_admin", "receptionist", "doctor"]);

    // 3. Fetch Appointments Used (Current Month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const { count: appointmentsCount } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", targetClinicId)
      .gte("slot_start", firstDay)
      .lte("slot_start", lastDay)
      .neq("status", "cancelled");

    // 4. Fetch Storage Used (Mocking for now or using tenant_usage_log if implemented later)
    // For now we'll just say 0 since R2 storage metrics require a separate sync process
    const storageUsedGB = 0;

    return apiSuccess({
      plan: planSlug,
      status: status,
      appointmentsUsed: appointmentsCount || 0,
      appointmentsLimit: planConfig.maxAppointmentsPerMonth,
      staffUsed: staffCount || 1,
      staffLimit: planConfig.maxDoctors, // Using maxDoctors as staffLimit proxy for now
      storageUsedGB: storageUsedGB,
      storageLimit: planConfig.storageGB,
    });
  },
  ["clinic_admin", "super_admin"],
);
