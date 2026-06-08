/**
 * Validation schemas for AI-powered consultation notes.
 *
 * OWASP A03 (Injection): rawNote is bounded at 10,000 chars and sanitized
 * before injection into AI prompts. UUIDs validated at schema level.
 */
import { z } from "zod";

/**
 * POST /api/v1/ai/structure-note — Structure a raw consultation note into
 * a standardized clinical format.
 */
export const structureNoteSchema = z.object({
  /** Raw dictated or typed consultation note */
  rawNote: z
    .string()
    .min(1, "Note cannot be empty")
    .max(10_000, "Note must be under 10,000 characters"),
  /** Patient UUID — must belong to the requesting doctor's clinic */
  patientId: z.string().uuid("Invalid patient ID"),
  /** Optional consultation record to update with structured data */
  consultationId: z.string().uuid("Invalid consultation ID").optional(),
  /** Language of the dictated note (affects AI structuring hints) */
  language: z.enum(["fr", "ar", "darija"]).default("fr"),
});

export type StructureNoteInput = z.infer<typeof structureNoteSchema>;

/**
 * Structured consultation note output shape returned by the AI and stored in DB.
 */
export interface StructuredNote {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  physicalExamination: string;
  assessment: string;
  plan: string;
  followUp: string;
  prescriptionHints: string[];
  labOrderHints: string[];
  redFlags: string[];
}
