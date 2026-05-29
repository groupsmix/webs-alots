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
  patientContext: z
    .object({
      age: z.number().int().min(0).max(150).optional(),
      gender: z.enum(["M", "F"]).optional(),
      allergies: z.array(z.string().max(200)).optional(),
      currentMedications: z.array(z.string().max(200)).optional(),
      chronicConditions: z.array(z.string().max(200)).optional(),
      weight: z.number().positive().max(500).optional(),
    })
    .optional(),
});

export const aiPatientSummaryRequestSchema = z.object({
  patientId: z.string().min(1),
  forceRefresh: z.boolean().optional().default(false),
});

export const aiDrugCheckRequestSchema = z.object({
  medications: z.array(z.string().min(1).max(200)).min(1).max(50),
  patientId: z.string().min(1).optional(),
  patientAllergies: z.array(z.string().max(200)).optional(),
  useAiFallback: z.boolean().optional().default(true),
});

export const aiDrugCheckOverrideSchema = z.object({
  patientId: z.string().min(1).optional(),
  alertId: z.string().min(1),
  alertSeverity: z.enum(["dangerous", "caution"]),
  alertTitle: z.string().max(500),
  reason: z.string().min(1).max(2000),
  medications: z.array(z.string()).min(1),
});

export const aiManagerRequestSchema = z.object({
  question: z.string().min(1).max(2000),
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

export const aiAutoSuggestRequestSchema = z.object({
  diagnosis: z.string().min(1).max(2000),
  patientId: z.string().min(1).optional(),
  patientContext: z
    .object({
      age: z.number().int().min(0).max(150).optional(),
      gender: z.enum(["M", "F"]).optional(),
      allergies: z.array(z.string().max(200)).optional(),
      currentMedications: z.array(z.string().max(200)).optional(),
      chronicConditions: z.array(z.string().max(200)).optional(),
      weight: z.number().positive().max(500).optional(),
    })
    .optional(),
});

// ── Batch 4A: Doctor AI schemas ──

export const aiVoiceNoteRequestSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  rawTranscript: z.string().min(1).max(10000),
  language: z.enum(["fr", "ar", "darija"]).default("fr"),
});

export const aiVoiceNoteSaveSchema = z.object({
  id: z.string().min(1).optional(),
  patientId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  rawTranscript: z.string().min(1).max(10000),
  language: z.enum(["fr", "ar", "darija"]).default("fr"),
  soapSubjective: z.string().max(5000).optional(),
  soapObjective: z.string().max(5000).optional(),
  soapAssessment: z.string().max(5000).optional(),
  soapPlan: z.string().max(5000).optional(),
  status: z.enum(["draft", "structured", "reviewed", "finalized"]).default("draft"),
});

export const aiSmartPrescriptionRequestSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  diagnosis: z.string().min(1).max(2000),
  symptoms: z.string().max(2000).optional(),
  drugName: z.string().min(1).max(200),
  patientContext: z
    .object({
      age: z.number().int().min(0).max(150).optional(),
      gender: z.enum(["M", "F"]).optional(),
      allergies: z.array(z.string().max(200)).optional(),
      currentMedications: z.array(z.string().max(200)).optional(),
      chronicConditions: z.array(z.string().max(200)).optional(),
      weight: z.number().positive().max(500).optional(),
    })
    .optional(),
});

export const aiPrescriptionSaveSchema = z.object({
  id: z.string().min(1).optional(),
  patientId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  diagnosis: z.string().min(1).max(2000),
  medications: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        dosage: z.string().max(200),
        frequency: z.string().max(200),
        duration: z.string().max(200),
        instructions: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(50),
  notes: z.string().max(5000).optional(),
  warnings: z.array(z.string().max(500)).optional(),
  status: z.enum(["draft", "reviewed", "signed", "printed", "dispensed"]).default("draft"),
});

export const aiDrugInteractionCheckRequestSchema = z.object({
  medications: z.array(z.string().min(1).max(200)).min(1).max(50),
  patientId: z.string().min(1).optional(),
  patientAllergies: z.array(z.string().max(200)).optional(),
  currentMedications: z.array(z.string().max(200)).optional(),
});
