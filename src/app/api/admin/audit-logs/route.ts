/**
 * GET /api/admin/audit-logs
 *
 * Paginated audit log viewer for clinic admins and super admins.
 * Supports filtering by user, action type, and date range.
 *
 * Query params:
 *   page      — 1-based page number (default: 1)
 *   pageSize  — rows per page, max 100 (default: 50)
 *   type      — filter by event type (booking | patient | payment | admin | auth | config | security)
 *   actor     — filter by actor user ID
 *   search    — free-text search across action and description
 *   from      — ISO date string lower bound (inclusive)
 *   to        — ISO date string upper bound (inclusive)
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

const VALID_TYPES = new Set([
  "booking",
  "patient",
  "payment",
  "admin",
  "auth",
  "config",
  "security",
]);

async function handler(request: NextRequest, auth: AuthContext) {
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE),
  );
  const type = searchParams.get("type");
  const actor = searchParams.get("actor");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (type && !VALID_TYPES.has(type)) {
    return apiError("Invalid type filter", 400, "INVALID_TYPE");
  }

  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("Clinic context required", 403, "NO_CLINIC");
  }

  try {
    const offset = (page - 1) * pageSize;

    let query = auth.supabase
      .from("activity_logs")
      .select(
        "id, action, type, actor, clinic_id, clinic_name, description, ip_address, metadata, timestamp, created_at",
        { count: "exact" },
      )
      .eq("clinic_id", clinicId)
      .order("timestamp", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (type) {
      query = query.eq("type", type);
    }
    if (actor) {
      query = query.eq("actor", actor);
    }
    if (from) {
      query = query.gte("timestamp", from);
    }
    if (to) {
      query = query.lte("timestamp", to);
    }
    if (search) {
      query = query.or(`action.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error("Failed to fetch audit logs", {
        context: "api/admin/audit-logs",
        clinicId,
        error,
      });
      return apiError("Failed to fetch audit logs", 500, "QUERY_FAILED");
    }

    return apiSuccess({
      logs: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      hasMore: (count ?? 0) > offset + pageSize,
    });
  } catch (err) {
    logger.error("Unexpected error in audit log query", {
      context: "api/admin/audit-logs",
      error: err,
    });
    return apiError("Internal server error", 500, "INTERNAL_ERROR");
  }
}

export const GET = withAuth(handler, ["clinic_admin", "super_admin"]);
