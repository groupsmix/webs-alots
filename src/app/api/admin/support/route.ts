/**
 * GET   /api/admin/support — List support tickets with optional filters
 * POST  /api/admin/support — Create a new support ticket (admin-side, for testing)
 * PATCH /api/admin/support — Update ticket status/priority/assignment
 *
 * All endpoints require super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

async function handleGet(request: NextRequest, _auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const clinicId = searchParams.get("clinic_id");
    const search = searchParams.get("search");

    // Super-admin intentionally queries across all tenants to manage the support queue
    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    let query = supabase
      .from("support_tickets") // nosemgrep: tenant-scoping — cross-tenant super-admin view
      .select("*, clinics(name)")
      .order("created_at", { ascending: false });

    if (status && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      query = query.eq("status", status);
    }
    if (priority && VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
      query = query.eq("priority", priority);
    }
    if (clinicId) {
      query = query.eq("clinic_id", clinicId);
    }
    if (search) {
      query = query.or(`subject.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Failed to fetch support tickets", {
        context: "support-api",
        error,
      });
      return apiInternalError("Failed to fetch support tickets");
    }

    return apiSuccess({ tickets: data ?? [] });
  } catch (err) {
    logger.error("Unexpected error fetching support tickets", {
      context: "support-api",
      error: err,
    });
    return apiInternalError("Failed to fetch support tickets");
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const parsed = body as Record<string, unknown>;
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    const clinicIdValue = typeof parsed.clinic_id === "string" ? parsed.clinic_id.trim() : "";
    const priority = typeof parsed.priority === "string" ? parsed.priority : "medium";
    const category = typeof parsed.category === "string" ? parsed.category : "general";

    if (!subject) {
      return apiValidationError("subject is required");
    }
    if (!description) {
      return apiValidationError("description is required");
    }
    if (!clinicIdValue) {
      return apiValidationError("clinic_id is required");
    }
    if (!VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
      return apiValidationError(`priority must be one of: ${VALID_PRIORITIES.join(", ")}`);
    }

    // Super-admin creates tickets on behalf of clinics; clinic_id is provided explicitly
    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        clinic_id: clinicIdValue,
        subject,
        description,
        priority,
        category,
        created_by: auth.user.id,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create support ticket", {
        context: "support-api",
        error,
      });
      return apiInternalError("Failed to create support ticket");
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "support_ticket.created",
      type: "admin",
      actor: auth.profile.id,
      clinicId: clinicIdValue || "system",
      description: `Created support ticket: ${subject}`,
      metadata: { ticketId: data.id as string },
    });

    return apiSuccess({ ticket: data }, 201);
  } catch (err) {
    logger.error("Unexpected error creating support ticket", {
      context: "support-api",
      error: err,
    });
    return apiInternalError("Failed to create support ticket");
  }
}

async function handlePatch(request: NextRequest, auth: AuthContext) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const parsed = body as Record<string, unknown>;
    const ticketId = typeof parsed.ticket_id === "string" ? parsed.ticket_id.trim() : "";

    if (!ticketId) {
      return apiValidationError("ticket_id is required");
    }

    const updates: Record<string, unknown> = {};

    if (typeof parsed.status === "string") {
      if (!VALID_STATUSES.includes(parsed.status as (typeof VALID_STATUSES)[number])) {
        return apiValidationError(`status must be one of: ${VALID_STATUSES.join(", ")}`);
      }
      updates.status = parsed.status;
      if (parsed.status === "resolved") {
        updates.resolved_at = new Date().toISOString();
      }
    }

    if (typeof parsed.priority === "string") {
      if (!VALID_PRIORITIES.includes(parsed.priority as (typeof VALID_PRIORITIES)[number])) {
        return apiValidationError(`priority must be one of: ${VALID_PRIORITIES.join(", ")}`);
      }
      updates.priority = parsed.priority;
    }

    if (typeof parsed.assigned_to === "string") {
      updates.assigned_to = parsed.assigned_to;
    }

    if (Object.keys(updates).length === 0) {
      return apiError("No valid fields to update", 400, "NO_UPDATES");
    }

    updates.updated_at = new Date().toISOString();

    // Super-admin updates any ticket by ID regardless of tenant
    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    const { data, error } = await supabase
      .from("support_tickets") // nosemgrep: tenant-scoping — cross-tenant super-admin operation
      .update(updates)
      .eq("id", ticketId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update support ticket", {
        context: "support-api",
        error,
      });
      return apiInternalError("Failed to update support ticket");
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "support_ticket.updated",
      type: "admin",
      actor: auth.profile.id,
      clinicId:
        typeof (data as Record<string, unknown>).clinic_id === "string"
          ? ((data as Record<string, unknown>).clinic_id as string)
          : "system",
      description: `Updated support ticket ${ticketId}`,
      metadata: { ticketId, updatedFields: Object.keys(updates).join(", ") },
    });

    return apiSuccess({ ticket: data });
  } catch (err) {
    logger.error("Unexpected error updating support ticket", {
      context: "support-api",
      error: err,
    });
    return apiInternalError("Failed to update support ticket");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
