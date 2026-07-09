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

const _uploadPresignedSchema = z.object({
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
});

export const uploadConfirmSchema = z.object({
  key: z.string().min(1).max(1000),
  contentType: z.string().min(1).max(200),
});

export const patientDocumentCreateSchema = z.object({
  r2Key: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().optional().default("application/octet-stream"),
  fileSize: z.number().positive(),
  docType: z.string().optional(),
  originalName: z.string().nullable().optional(),
});
