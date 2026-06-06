import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest } from "next/server";
import { apiInternalError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { getAnthropicApiKey } from "@/lib/env";
import { logger } from "@/lib/logger";
import { syncClinicOnboardingState } from "@/lib/onboarding/state";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function handlePost(request: NextRequest, _auth: AuthContext) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const clinicId =
      typeof formData.get("clinic_id") === "string" ? String(formData.get("clinic_id")) : "";
    const clinicName =
      typeof formData.get("clinic_name") === "string"
        ? String(formData.get("clinic_name"))
        : "Clinique";

    if (!(file instanceof File)) {
      return apiValidationError("file is required");
    }
    if (!clinicId) {
      return apiValidationError("clinic_id is required");
    }

    const admin = createUntypedAdminClient("super_admin");
    const fallbackExtraction: Record<string, unknown> = {
      fileName: file.name,
      mediaType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      extractedAt: new Date().toISOString(),
      requiresReview: true,
      source: "metadata_fallback",
    };

    let extracted = fallbackExtraction;
    const anthropicApiKey = getAnthropicApiKey();

    if (anthropicApiKey) {
      try {
        const client = new Anthropic({ apiKey: anthropicApiKey });
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        const isPdf = file.type === "application/pdf";
        const imageMediaType = (file.type || "image/png") as
          | "image/png"
          | "image/jpeg"
          | "image/webp"
          | "image/gif";
        const documentBlock = isPdf
          ? {
              type: "document" as const,
              source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: base64,
              },
            }
          : {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: imageMediaType,
                data: base64,
              },
            };
        const response = await client.messages.create({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 500,
          system:
            "Extract structured legal onboarding data for a Moroccan clinic. Return strict JSON only. Include keys: clinicName, contactName, contactEmail, contactPhone, documentType, identifiers, requiresReview, notes.",
          messages: [
            {
              role: "user",
              content: [
                documentBlock,
                {
                  type: "text",
                  text: "Extract clinic onboarding details from this document and return strict JSON only.",
                },
              ],
            },
          ],
        });

        const text = (response.content as Array<{ type: string; text?: string }>)
          .map((item) => (item.type === "text" ? (item.text ?? "") : ""))
          .join("\n");
        extracted = extractJsonObject(text) ?? fallbackExtraction;
      } catch (error) {
        logger.warn("Anthropic onboarding extraction failed, using fallback", {
          context: "admin/onboarding-extract",
          clinicId,
          error,
        });
      }
    }

    await syncClinicOnboardingState({
      supabase: admin,
      clinicId,
      clinicName,
      legalDocUploaded: true,
      extractedLegalData: extracted,
      completedSteps: ["clinic_info", "specialty", "legal_docs"],
      currentStep: "team_setup",
      status: "in_progress",
    });

    return apiSuccess({ extracted, requiresReview: true });
  } catch (error) {
    logger.error("Onboarding extraction failed", {
      context: "admin/onboarding-extract",
      error,
    });
    return apiInternalError("Failed to extract onboarding document");
  }
}

export const POST = withAuth(handlePost, ALLOWED_ROLES);
