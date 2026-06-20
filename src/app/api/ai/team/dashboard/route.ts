/**
 * GET /api/ai/team/dashboard
 *
 * Returns the unified AI team dashboard data:
 * - Agent statuses (marketing, support, reminder)
 * - Recent tasks per agent
 * - Unread alerts
 * - Key metrics for each agent
 */

import { type NextRequest } from "next/server";
import {
  fetchMarketingData,
  fetchSupportData,
  fetchReminderData,
  type TaskStatus,
} from "@/lib/ai/team-data";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

async function handler(_request: NextRequest, auth: AuthContext) {
  const { profile, supabase } = auth;
  const clinicId = profile.clinic_id;

  if (!clinicId) {
    if (profile.role === "super_admin") {
      return apiSuccess({
        agents: {
          marketing: {
            status: "active",
            label: "Agent Marketing",
            metrics: {},
            pendingTasks: 0,
            tasks: [],
            alerts: [],
          },
          support: {
            status: "active",
            label: "Agent Support",
            metrics: {},
            pendingTasks: 0,
            tasks: [],
            alerts: [],
          },
          reminder: {
            status: "active",
            label: "Agent Rappels",
            metrics: {},
            pendingTasks: 0,
            tasks: [],
            alerts: [],
          },
        },
        totalUnreadAlerts: 0,
        teamTasks: [],
      });
    }
    return apiError("Aucune clinique associée à ce compte", 403, "NO_CLINIC");
  }

  try {
    const untypedSupa = supabase as unknown as SupabaseUntyped;

    const [marketingData, supportData, reminderData, recentTasks, unreadAlerts, teamTasks] =
      await Promise.all([
        fetchMarketingData(supabase, clinicId),
        fetchSupportData(supabase, clinicId),
        fetchReminderData(supabase, clinicId),
        (async () => {
          try {
            const { data } = await untypedSupa
              .from("ai_agent_tasks")
              .select(
                "id, agent_type, title, description, priority, status, category, due_date, created_at",
              )
              .eq("clinic_id", clinicId)
              .in("status", ["pending", "in_progress"])
              .order("created_at", { ascending: false })
              .limit(15);
            return data ?? [];
          } catch {
            return [];
          }
        })(),
        (async () => {
          try {
            const { data } = await untypedSupa
              .from("ai_agent_alerts")
              .select("id, agent_type, title, message, severity, is_read, created_at")
              .eq("clinic_id", clinicId)
              .eq("is_read", false)
              .order("created_at", { ascending: false })
              .limit(20);
            return data ?? [];
          } catch {
            return [];
          }
        })(),
        // C3: Fetch durable team tasks for kanban board
        (async () => {
          try {
            const { data } = await untypedSupa
              .from("ai_team_tasks")
              .select(
                "id, clinic_id, title, description, agent_type, status, reviewer_agent_type, review_comments, review_cycles, history_events, created_by, created_at, updated_at",
              )
              .eq("clinic_id", clinicId)
              .order("updated_at", { ascending: false })
              .limit(50);
            return data ?? [];
          } catch {
            return [];
          }
        })(),
      ]);

    type TaskRow = {
      id: string;
      agent_type: string;
      title: string;
      description: string | null;
      priority: string;
      status: string;
      category: string | null;
      due_date: string | null;
      created_at: string;
    };
    type AlertRow = {
      id: string;
      agent_type: string;
      title: string;
      message: string;
      severity: string;
      is_read: boolean;
      created_at: string;
    };

    const tasks = recentTasks as TaskRow[];
    const alerts = unreadAlerts as AlertRow[];

    const marketingTasks = tasks.filter((t) => t.agent_type === "marketing");
    const supportTasks = tasks.filter((t) => t.agent_type === "support");
    const reminderTasks = tasks.filter((t) => t.agent_type === "reminder");

    const marketingAlerts = alerts.filter((a) => a.agent_type === "marketing");
    const supportAlerts = alerts.filter((a) => a.agent_type === "support");
    const reminderAlerts = alerts.filter((a) => a.agent_type === "reminder");

    type TeamTaskRow = {
      id: string;
      clinic_id: string;
      title: string;
      description: string | null;
      agent_type: string;
      status: TaskStatus;
      reviewer_agent_type: string | null;
      review_comments: string | null;
      review_cycles: number;
      history_events: Record<string, unknown>[];
      created_by: string | null;
      created_at: string;
      updated_at: string;
    };

    const typedTeamTasks = teamTasks as TeamTaskRow[];

    return apiSuccess({
      agents: {
        marketing: {
          status: "active",
          label: "Agent Marketing",
          metrics: {
            inactivePatients: marketingData.inactivePatientsCount,
            newPatientsThisMonth: marketingData.newPatientsThisMonth,
            birthdayPatients: marketingData.birthdayPatientsCount,
          },
          pendingTasks: marketingTasks.length,
          tasks: marketingTasks,
          alerts: marketingAlerts,
        },
        support: {
          status: "active",
          label: "Agent Support",
          metrics: {
            npsScore: supportData.npsScore,
            waitingQueueCount: supportData.waitingQueueCount,
            longWaitingCount: supportData.longWaitingCount,
          },
          pendingTasks: supportTasks.length,
          tasks: supportTasks,
          alerts: supportAlerts,
        },
        reminder: {
          status: "active",
          label: "Agent Rappels",
          metrics: {
            todayAppointments: reminderData.todayTotal,
            pendingApprovals: reminderData.totalPendingAppointments,
            revenueThisMonth: reminderData.revenueThisMonth,
          },
          pendingTasks: reminderTasks.length,
          tasks: reminderTasks,
          alerts: reminderAlerts,
        },
      },
      totalUnreadAlerts: alerts.length,
      // C3: Kanban board data
      teamTasks: typedTeamTasks,
    });
  } catch (err) {
    logger.error("Failed to fetch AI team dashboard", {
      context: "api/ai/team/dashboard",
      clinicId,
      error: err,
    });
    return apiInternalError("Erreur lors du chargement du tableau de bord IA.");
  }
}

export const GET = withAuth(handler, ["clinic_admin", "super_admin"]);
