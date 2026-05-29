import { z } from "zod";

export const TIMELINE_EVENT_TYPES = [
  "visit",
  "prescription",
  "lab_result",
  "imaging",
  "payment",
  "note",
  "communication",
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export const timelineQuerySchema = z.object({
  patientId: z.string().uuid(),
  eventType: z.enum(TIMELINE_EVENT_TYPES).optional(),
  search: z.string().max(200).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type TimelineQuery = z.infer<typeof timelineQuerySchema>;
