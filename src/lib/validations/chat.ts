import { z } from "zod";
import { safeText } from "./primitives";

/**
 * A14-01: bound `content` to 2 000 chars at the schema layer to match
 * MAX_MESSAGE_LENGTH in the chat route handler. Prevents unbounded
 * payloads being forwarded to the upstream LLM.
 */
export const CHAT_MESSAGE_CONTENT_MAX = 2000;

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: safeText.pipe(z.string().min(1).max(CHAT_MESSAGE_CONTENT_MAX)),
      }),
    )
    .min(1)
    .max(20),
});

export const aiPrescriptionRequestSchema = z.object({
  patientId: z.string().min(1),
  diagnosis: z.string().min(1).max(2000),
  symptoms: z.string().max(2000).optional(),
  patientContext: z.object({
    age: z.number().int().min(0).max(150).optional(),
    gender: z.enum(["M", "F"]).optional(),
    allergies: z.array(z.string().max(200)).optional(),
    currentMedications: z.array(z.string().max(200)).optional(),
    chronicConditions: z.array(z.string().max(200)).optional(),
    weight: z.number().positive().max(500).optional(),
  }).optional(),
});

export type AiPrescriptionRequest = z.infer<typeof aiPrescriptionRequestSchema>;

export const aiPatientSummaryRequestSchema = z.object({
  patientId: z.string().min(1),
  forceRefresh: z.boolean().optional().default(false),
});

export type AiPatientSummaryRequest = z.infer<typeof aiPatientSummaryRequestSchema>;

export const aiDrugCheckRequestSchema = z.object({
  medications: z.array(z.string().min(1).max(200)).min(1).max(50),
  patientId: z.string().min(1).optional(),
  patientAllergies: z.array(z.string().max(200)).optional(),
  useAiFallback: z.boolean().optional().default(true),
});

export type AiDrugCheckRequest = z.infer<typeof aiDrugCheckRequestSchema>;

export const aiDrugCheckOverrideSchema = z.object({
  patientId: z.string().min(1).optional(),
  alertId: z.string().min(1),
  alertSeverity: z.enum(["dangerous", "caution"]),
  alertTitle: z.string().max(500),
  reason: z.string().min(1).max(2000),
  medications: z.array(z.string()).min(1),
});

export type AiDrugCheckOverride = z.infer<typeof aiDrugCheckOverrideSchema>;

export const aiManagerRequestSchema = z.object({
  question: z.string().min(1).max(2000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2000),
    }),
  ).max(20).optional().default([]),
});

export type AiManagerRequest = z.infer<typeof aiManagerRequestSchema>;

export const aiAutoSuggestRequestSchema = z.object({
  diagnosis: z.string().min(1).max(2000),
  patientId: z.string().min(1).optional(),
  patientContext: z.object({
    age: z.number().int().min(0).max(150).optional(),
    gender: z.enum(["M", "F"]).optional(),
    allergies: z.array(z.string().max(200)).optional(),
    currentMedications: z.array(z.string().max(200)).optional(),
    chronicConditions: z.array(z.string().max(200)).optional(),
    weight: z.number().positive().max(500).optional(),
  }).optional(),
});

export type AiAutoSuggestRequest = z.infer<typeof aiAutoSuggestRequestSchema>;
