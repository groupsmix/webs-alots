/**
 * GET /api/cron/support-sla-check
 *
 * Hourly cron that:
 * 1. Scans open/in-progress tickets that have not yet been flagged as SLA-breached.
 * 2. Marks sla_breached=true when (now - created_at) > sla_target_hours.
 * 3. Records first_response_at from the first staff/admin message on the ticket.
 * 4. Notifies clinic admins in-app when their tickets breach SLA.
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */

import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { insertInAppNotification } from "@/lib/notification-persist";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";

const BATCH_SIZE = 200;

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient("cron") as any;
  const now = new Date().toISOString();
  let totalBreached = 0;
  let totalFirstResponseUpdated = 0;
  const errors: string[] = [];

  // ── Step 1: Find tickets that haven't been checked for SLA breach yet ──
  const { data: openTickets, error: fetchError } = await supabase
    .from("support_tickets")
    .select("id, clinic_id, subject, created_at, sla_target_hours, status, first_response_at")
    .in("status", ["open", "in_progress"])
    .eq("sla_breached", false)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    logger.error("SLA check: failed to fetch open tickets", {
      context: "cron/support-sla-check",
      error: fetchError,
    });
    return apiSuccess({ totalBreached: 0, errors: ["Failed to fetch tickets"] });
  }

  const tickets = (openTickets ?? []) as Array<{
    id: string;
    clinic_id: string;
    subject: string;
    created_at: string;
    sla_target_hours: number;
    status: string;
    first_response_at: string | null;
  }>;

  // ── Step 2: For each ticket, compute SLA breach and first response ──
  for (const ticket of tickets) {
    try {
      const createdAt = new Date(ticket.created_at);
      const hoursElapsed = (Date.now() - createdAt.getTime()) / 3_600_000;
      const isBreached = hoursElapsed > ticket.sla_target_hours;

      // Determine first_response_at if not already set
      let firstResponseAt: string | null = ticket.first_response_at;
      if (!firstResponseAt) {
        const { data: firstStaffMsg } = await supabase
          .from("support_messages")
          .select("created_at")
          .eq("ticket_id", ticket.id)
          .in("sender_type", ["staff", "admin"])
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstStaffMsg?.created_at) {
          firstResponseAt = firstStaffMsg.created_at;
          totalFirstResponseUpdated++;
        }
      }

      const updates: Record<string, unknown> = {};
      if (firstResponseAt && firstResponseAt !== ticket.first_response_at) {
        updates.first_response_at = firstResponseAt;
      }
      if (isBreached) {
        updates.sla_breached = true;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("support_tickets")
          .update(updates)
          .eq("id", ticket.id)
          .eq("clinic_id", ticket.clinic_id);

        if (updateError) {
          errors.push(`Ticket ${ticket.id}: ${updateError.code ?? "update_error"}`);
          continue;
        }
      }

      // ── Step 3: Notify clinic admins on breach ──
      if (isBreached) {
        totalBreached++;
        const { data: admins } = await supabase
          .from("users")
          .select("id")
          .eq("clinic_id", ticket.clinic_id)
          .in("role", ["clinic_admin", "super_admin"]);

        for (const admin of admins ?? []) {
          await insertInAppNotification({
            userId: admin.id,
            trigger: "follow_up",
            title: `SLA breached: ${ticket.subject.slice(0, 60)}`,
            message: `Ticket open ${Math.floor(hoursElapsed)}h — exceeds the ${ticket.sla_target_hours}h SLA target.`,
            priority: "urgent",
          });
        }

        logger.warn("Support ticket SLA breached", {
          context: "cron/support-sla-check",
          ticketId: ticket.id,
          clinicId: ticket.clinic_id,
          hoursElapsed: Math.round(hoursElapsed),
          slaTargetHours: ticket.sla_target_hours,
        });
      }
    } catch (err) {
      errors.push(`Ticket ${ticket.id}: unexpected_error`);
      logger.error("SLA check: error processing ticket", {
        context: "cron/support-sla-check",
        ticketId: ticket.id,
        error: err,
      });
    }
  }

  logger.info("Support SLA check complete", {
    context: "cron/support-sla-check",
    ticketsChecked: tickets.length,
    totalBreached,
    totalFirstResponseUpdated,
    errors: errors.length,
  });

  return apiSuccess({
    checkedAt: now,
    ticketsChecked: tickets.length,
    totalBreached,
    totalFirstResponseUpdated,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export const GET = withSentryCron("support-sla-check", "0 * * * *", handler);
