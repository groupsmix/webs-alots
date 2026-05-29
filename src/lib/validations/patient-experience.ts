import { z } from "zod";

export const qrCheckinGenerateSchema = z.object({
  appointmentId: z.string().uuid(),
});

export const qrCheckinScanSchema = z.object({
  token: z.string().min(1),
});

export const waitingQueueUpdateSchema = z.object({
  queueEntryId: z.string().uuid(),
  status: z.enum(["called", "in_progress", "completed", "no_show"]),
});

export const npsSurveyResponseSchema = z.object({
  surveyId: z.string().uuid(),
  score: z.number().int().min(0).max(10),
  comment: z.string().max(2000).optional(),
});
