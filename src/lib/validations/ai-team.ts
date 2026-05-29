import { z } from "zod";
import { safeText } from "./primitives";

export const AI_AGENT_TYPES = ["marketing", "support", "reminder"] as const;
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
