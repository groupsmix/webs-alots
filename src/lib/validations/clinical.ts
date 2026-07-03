import { z } from "zod";
import { safeName } from "./primitives";

export const labReportSchema = z.object({
  orderId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  orderNumber: z.string().min(1).max(100),
  results: z
    .array(
      z.object({
        testName: safeName.pipe(z.string().min(1).max(200)),
        value: z.string().nullable(),
        unit: z.string().nullable(),
        referenceMin: z.number().nullable(),
        referenceMax: z.number().nullable(),
        flag: z.string().nullable(),
      }),
    )
    .min(1),
});

export const radiologyOrderCreateSchema = z.object({
  patientId: z.string().min(1),
  modality: z.string().min(1).max(100),
  bodyPart: z.string().max(200).optional(),
  clinicalIndication: z.string().max(1000).optional(),
  priority: z.string().max(50).optional(),
  scheduledAt: z.string().optional(),
  orderingDoctorId: z.string().optional(),
});

const radiologyStatusUpdateSchema = z.object({
  orderId: z.string().min(1),
  action: z.literal("status"),
  status: z.string().min(1),
});

const radiologyReportSaveSchema = z.object({
  orderId: z.string().min(1),
  action: z.literal("report"),
  findings: z.string().optional(),
  impression: z.string().optional(),
  reportText: z.string().optional(),
  templateId: z.string().optional(),
  radiologistId: z.string().optional(),
});

export const radiologyOrderPatchSchema = z.discriminatedUnion("action", [
  radiologyStatusUpdateSchema,
  radiologyReportSaveSchema,
]);

export const radiologyReportPdfSchema = z.object({
  orderId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  modality: z.string().min(1).max(100),
  bodyPart: z.string().max(200).optional(),
  findings: z.string().optional(),
  impression: z.string().optional(),
  reportText: z.string().optional(),
  radiologistName: z.string().max(200).optional(),
});

const _uploadPresignedSchema = z.object({
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
});

export const uploadConfirmSchema = z.object({
  key: z.string().min(1).max(1000),
  contentType: z.string().min(1).max(200),
});

const petSpeciesEnum = z.enum([
  "dog",
  "cat",
  "bird",
  "rabbit",
  "hamster",
  "fish",
  "reptile",
  "horse",
  "cattle",
  "sheep",
  "goat",
  "other",
]);

export const petProfileCreateSchema = z.object({
  name: z.string().min(1).max(200),
  species: petSpeciesEnum,
  breed: z.string().max(200).optional(),
  weight_kg: z.number().positive().max(10000).optional(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional(),
  photo_url: z.string().url().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  owner_id: z.string().min(1),
});

export const petProfileUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  species: petSpeciesEnum.optional(),
  breed: z.string().max(200).nullable().optional(),
  weight_kg: z.number().positive().max(10000).nullable().optional(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .nullable()
    .optional(),
  photo_url: z.string().url().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const patientDocumentCreateSchema = z.object({
  r2Key: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().optional().default("application/octet-stream"),
  fileSize: z.number().positive(),
  docType: z.string().optional(),
  originalName: z.string().nullable().optional(),
});
