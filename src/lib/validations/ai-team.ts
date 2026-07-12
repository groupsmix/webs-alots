import { z } from "zod";
import { safeText } from "./primitives";

const AI_AGENT_TYPES = ["marketing", "support", "reminder"] as const;
export type AIAgentType = (typeof AI_AGENT_TYPES)[number];

export const aiTeamChatSchema = z.object({
  agentType: z.enum(AI_AGENT_TYPES),
  message: safeText.pipe(z.string().min(1).max(2000)),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});

/** Legacy simple task status update (for backwards compat with ai_agent_tasks) */
export const aiTeamTaskUpdateSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed", "dismissed"]),
});

export const aiTeamAlertReadSchema = z.object({
  alertId: z.string().uuid(),
});

export const aiTeamGenerateSchema = z.object({
  agentType: z.enum(AI_AGENT_TYPES),
});

// ── Phase C1: New task state machine schemas ──

const TASK_STATUS_VALUES = [
  "backlog",
  "in_progress",
  "review",
  "changes_requested",
  "done",
  "cancelled",
] as const;

export const aiTeamTaskCreateSchema = z.object({
  title: safeText.pipe(z.string().min(1).max(500)),
  description: safeText.pipe(z.string().max(5000)).optional(),
  agentType: z.enum(AI_AGENT_TYPES),
  reviewerAgentType: z.enum(AI_AGENT_TYPES).optional(),
});

export const aiTeamTaskTransitionSchema = z.object({
  taskId: z.string().uuid(),
  fromStatus: z.enum(TASK_STATUS_VALUES),
  toStatus: z.enum(TASK_STATUS_VALUES),
  reviewComments: z.string().max(2000).optional(),
});
