/**
 * GET   /api/admin/support — List support tickets with optional filters
 * POST  /api/admin/support — Create a new support ticket (admin-side, for testing)
 * PATCH /api/admin/support — Update ticket status/priority/assignment
 *
 * All endpoints require super_admin role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { adjustTeamMemberTicketCount } from "@/lib/team-members";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];
const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function normalizePriority(priority: unknown): string {
  if (priority === "normal") return "medium";
  return typeof priority === "string" ? priority : "medium";
}

async function handleGet(request: NextRequest, _auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const clinicId = searchParams.get("clinic_id");
    const search = searchParams.get("search");

    const supabase = createUntypedAdminClient("super_admin");

    let query = supabase
      .from("support_tickets")
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
      query = query.or(`subject.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Failed to fetch support tickets", {
        context: "support-api",
        error,
      });
      return apiInternalError("Failed to fetch support tickets");
    }

    const ticketRows = (data ?? []) as Array<Record<string, unknown>>;
    const assignedTeamMemberIds = [
      ...new Set(ticketRows.map((row) => row.assigned_team_member_id).filter(Boolean)),
    ];

    const teamMembersById = new Map<string, { name: string; role: string }>();
    if (assignedTeamMemberIds.length > 0) {
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("id, name, role")
        .in("id", assignedTeamMemberIds as string[]);
      for (const member of (teamMembers ?? []) as Array<{
        id: string;
        name: string;
        role: string;
      }>) {
        teamMembersById.set(member.id, { name: member.name, role: member.role });
      }
    }

    const tickets = ticketRows.map((row) => {
      const assignedTeamMemberId =
        typeof row.assigned_team_member_id === "string" ? row.assigned_team_member_id : null;
      const assignedTeamMember = assignedTeamMemberId
        ? (teamMembersById.get(assignedTeamMemberId) ?? null)
        : null;

      return {
        ...row,
        description:
          typeof row.description === "string"
            ? row.description
            : typeof row.metadata === "object" &&
                row.metadata &&
                typeof (row.metadata as Record<string, unknown>).last_message === "string"
              ? ((row.metadata as Record<string, unknown>).last_message as string)
              : "",
        priority: normalizePriority(row.priority),
        category: typeof row.category === "string" ? row.category : "general",
        ai_priority: typeof row.ai_priority === "string" ? row.ai_priority : null,
        ai_category: typeof row.ai_category === "string" ? row.ai_category : null,
        sentiment: typeof row.sentiment === "string" ? row.sentiment : null,
        ai_draft_response: typeof row.ai_draft_response === "string" ? row.ai_draft_response : null,
        triaged_at: typeof row.triaged_at === "string" ? row.triaged_at : null,
        assigned_team_member_id: assignedTeamMemberId,
        assigned_team_member_name: assignedTeamMember?.name ?? null,
        assigned_team_member_role: assignedTeamMember?.role ?? null,
      };
    });

    return apiSuccess({ tickets });
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

    const postSchema = z.object({
      subject: z.string().min(1, "subject is required"),
      description: z.string().min(1, "description is required"),
      clinic_id: z.string().min(1, "clinic_id is required"),
      priority: z.string().optional(),
      category: z.string().optional().default("general"),
    });

    const parsedResult = postSchema.safeParse(body);
    if (!parsedResult.success) {
      return apiValidationError(parsedResult.error.issues[0].message);
    }
    const parsed = parsedResult.data;

    const subject = parsed.subject.trim();
    const description = parsed.description.trim();
    const clinicIdValue = parsed.clinic_id.trim();
    const priority = normalizePriority(parsed.priority);
    const category = parsed.category;

    if (!VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
      return apiValidationError(`priority must be one of: ${VALID_PRIORITIES.join(", ")}`);
    }

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

    const patchSchema = z.object({
      ticket_id: z.string().min(1, "ticket_id is required"),
      status: z.string().optional(),
      priority: z.string().optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      assigned_team_member_id: z.string().uuid().nullable().optional(),
    });

    const parsedResult = patchSchema.safeParse(body);
    if (!parsedResult.success) {
      return apiValidationError(parsedResult.error.issues[0].message);
    }
    const parsed = parsedResult.data;
    const ticketId = parsed.ticket_id.trim();

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
      const normalizedPriority = normalizePriority(parsed.priority);
      if (!VALID_PRIORITIES.includes(normalizedPriority as (typeof VALID_PRIORITIES)[number])) {
        return apiValidationError(`priority must be one of: ${VALID_PRIORITIES.join(", ")}`);
      }
      updates.priority = normalizedPriority;
    }

    if (typeof parsed.assigned_to === "string") {
      updates.assigned_to = parsed.assigned_to;
    }
    if (typeof parsed.assigned_team_member_id === "string") {
      updates.assigned_team_member_id = parsed.assigned_team_member_id;
    }

    if (Object.keys(updates).length === 0) {
      return apiError("No valid fields to update", 400, "NO_UPDATES");
    }

    updates.updated_at = new Date().toISOString();

    const supabase = createUntypedAdminClient("super_admin");
    const { data: existingTicket } = await supabase
      .from("support_tickets")
      .select("clinic_id, assigned_team_member_id, status")
      .eq("id", ticketId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("support_tickets")
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

    const previousAssigned =
      typeof (existingTicket as Record<string, unknown> | null)?.assigned_team_member_id ===
      "string"
        ? ((existingTicket as Record<string, unknown>).assigned_team_member_id as string)
        : null;
    const nextAssigned =
      typeof (data as Record<string, unknown>).assigned_team_member_id === "string"
        ? ((data as Record<string, unknown>).assigned_team_member_id as string)
        : null;

    if (previousAssigned && previousAssigned !== nextAssigned) {
      await adjustTeamMemberTicketCount(supabase, previousAssigned, -1);
    }
    if (nextAssigned && previousAssigned !== nextAssigned) {
      await adjustTeamMemberTicketCount(supabase, nextAssigned, 1);
    }
    if (
      typeof updates.status === "string" &&
      ["resolved", "closed"].includes(updates.status) &&
      nextAssigned
    ) {
      await adjustTeamMemberTicketCount(supabase, nextAssigned, -1);
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
