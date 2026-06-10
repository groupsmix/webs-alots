/**
 * GET /api/cron/ai-embed-faqs
 *
 * Backfill cron: iterates clinics and embeds un-embedded chatbot_faqs rows
 * into the ai_documents table for RAG retrieval.
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 *
 * OWASP A04: Scoped per-clinic — no cross-tenant data.
 * OWASP A07: Rate-limited by cron infrastructure.
 */

import { type NextRequest } from "next/server";
import { embedText, truncateForEmbedding } from "@/lib/ai/embeddings";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";

const BATCH_SIZE = 20;

async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient("cron");

    // Get all active clinics
    const { data: clinics, error: clinicsErr } = await supabase
      .from("clinics")
      .select("id")
      .eq("status", "active");

    if (clinicsErr || !clinics) {
      logger.error("Failed to fetch clinics for FAQ embedding", {
        context: "cron/ai-embed-faqs",
        error: clinicsErr?.message,
      });
      return apiInternalError("Failed to fetch clinics");
    }

    // Get OpenAI API key from provider configs (untyped — table not in generated types)
    const untypedAdmin = createUntypedAdminClient("ai-embed");
    const { data: configRow } = await untypedAdmin
      .from("ai_provider_configs")
      .select("api_key")
      .eq("provider", "openai")
      .eq("enabled", true)
      .limit(1)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiKey = (configRow as any)?.api_key as string | undefined;
    if (!apiKey) {
      logger.warn("No OpenAI API key configured — skipping FAQ embedding", {
        context: "cron/ai-embed-faqs",
      });
      return apiSuccess({ embedded: 0, message: "No OpenAI API key configured" });
    }

    let totalEmbedded = 0;

    for (const clinic of clinics) {
      // Typed client for chatbot_faqs (exists in generated types)
      const typedClinic = createAdminClient("cron");
      // Untyped client for ai_documents (not in generated types)
      const untypedClinic = createUntypedAdminClient("ai-embed", clinic.id);

      // Find FAQs that don't have an embedding yet in ai_documents
      const { data: faqs, error: faqErr } = await typedClinic
        .from("chatbot_faqs")
        .select("id, question, answer, keywords, category, language")
        .eq("clinic_id", clinic.id);

      if (faqErr || !faqs || faqs.length === 0) continue;

      // Check which FAQs already have embeddings (untyped table)
      const { data: existingDocs } = await untypedClinic
        .from("ai_documents")
        .select("source_id")
        .eq("clinic_id", clinic.id)
        .eq("source_type", "faq")
        .in(
          "source_id",
          faqs.map((f: { id: string }) => f.id),
        );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingIds = new Set((existingDocs ?? []).map((d: any) => d.source_id));
      const newFaqs = faqs.filter((f) => !existingIds.has(f.id));

      if (newFaqs.length === 0) continue;

      // Process in batches
      for (let i = 0; i < newFaqs.length; i += BATCH_SIZE) {
        const batch = newFaqs.slice(i, i + BATCH_SIZE);
        const texts = batch.map((faq) => {
          const keywords = Array.isArray(faq.keywords) ? faq.keywords.join(", ") : "";
          return truncateForEmbedding(
            `Question: ${faq.question}\nRéponse: ${faq.answer}${keywords ? `\nMots-clés: ${keywords}` : ""}`,
          );
        });

        try {
          const result = await embedText(texts, apiKey);

          // Insert documents with embeddings
          const docs = batch.map((faq, idx) => ({
            clinic_id: clinic.id,
            source_type: "faq" as const,
            source_id: faq.id,
            language: faq.language ?? "fr",
            content: texts[idx],
            embedding: JSON.stringify(result.embeddings[idx]),
            metadata: {
              category: faq.category ?? "general",
              question: faq.question,
            },
          }));

          const { error: insertErr } = await untypedClinic.from("ai_documents").insert(docs);

          if (insertErr) {
            logger.error("Failed to insert FAQ embeddings", {
              context: "cron/ai-embed-faqs",
              clinicId: clinic.id,
              error: insertErr.message,
            });
          } else {
            totalEmbedded += batch.length;
          }
        } catch (err) {
          logger.error("Failed to embed FAQ batch", {
            context: "cron/ai-embed-faqs",
            clinicId: clinic.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    logger.info("FAQ embedding cron completed", {
      context: "cron/ai-embed-faqs",
      embedded: totalEmbedded,
    });

    return apiSuccess({
      embedded: totalEmbedded,
      message: `${totalEmbedded} FAQ(s) embedded`,
    });
  } catch (err) {
    logger.error("FAQ embedding cron failed", {
      context: "cron/ai-embed-faqs",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("FAQ embedding cron failed");
  }
}

// Runs hourly to catch new FAQs
export const GET = withSentryCron("ai-embed-faqs", "0 * * * *", handler);
