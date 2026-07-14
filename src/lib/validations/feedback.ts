import { z } from "zod";
import { safeName, safeText } from "./primitives";

// In-app product feedback submitted from the "Help & Feedback" widget.
export const feedbackCreateSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  message: safeText.pipe(z.string().min(3).max(2000)),
  page_url: z.string().max(500).optional(),
});

export type FeedbackCreateInput = z.infer<typeof feedbackCreateSchema>;

// In-app "Contact support" from the "Help & Feedback" widget (any role).
export const supportContactSchema = z.object({
  subject: safeName.pipe(z.string().min(3).max(300)),
  message: safeText.pipe(z.string().min(3).max(2000)),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  language: z.enum(["fr", "ar", "en"]).optional().default("fr"),
});

export type SupportContactInput = z.infer<typeof supportContactSchema>;
