/**
 * Agentic RAG pipeline — Phase B2.
 *
 * Implements the corrective-RAG pattern:
 * 1. Embed query → hybrid retrieve top-8 from ai_documents
 * 2. Grade each chunk for relevance (cheap model, batched)
 * 3. If < 2 relevant → corrective: rewrite query, re-retrieve
 * 4. Still thin → refuse with clinic contact info template
 * 5. Grounded generation with source citations
 *
 * Falls back to tsvector keyword search when embeddings unavailable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText, matchDocuments, type DocumentMatch } from "@/lib/ai/embeddings";
import { callProvider, ProviderError } from "@/lib/ai/providers";
import { loadProviderConfigs, selectAvailableProvider } from "@/lib/ai/router";
import { logger } from "@/lib/logger";

// ── Types ──

export interface RAGContext {
  chunks: RAGChunk[];
  sources: string[];
  method: "vector" | "keyword" | "corrective" | "none";
}

export interface RAGChunk {
  id: string;
  content: string;
  sourceType: string;
  similarity: number;
  relevant: boolean;
}

export interface RAGOptions {
  maxChunks?: number;
  maxContextTokens?: number;
  sourceTypes?: string[];
}

// ── Constants ──

const MIN_RELEVANT_CHUNKS = 2;
const RELEVANCE_THRESHOLD = 0.3;
const MAX_CONTEXT_TOKENS = 2500;
const CHARS_PER_TOKEN = 4;

// ── Main pipeline ──

/**
 * Retrieve grounded context for a patient query.
 *
 * Returns the RAG context block to inject into the system prompt,
 * along with source document IDs for citation.
 */
export async function retrieveRAGContext(
  supabase: SupabaseClient,
  clinicId: string,
  query: string,
  options?: RAGOptions,
): Promise<RAGContext> {
  const maxChunks = options?.maxChunks ?? 8;

  // Try to get OpenAI key for embeddings
  const configs = await loadProviderConfigs(supabase);
  const openaiConfig = configs.get("openai");
  const apiKey = openaiConfig?.apiKey ?? null;

  // If no embedding API key, fall back to keyword search
  if (!apiKey) {
    logger.info("RAG: No OpenAI key, falling back to keyword search", {
      context: "ai-rag",
      clinicId,
    });
    return keywordFallback(supabase, clinicId, query);
  }

  try {
    // Step 1: Embed query
    const { embeddings } = await embedText([query], apiKey);
    if (embeddings.length === 0) {
      return keywordFallback(supabase, clinicId, query);
    }

    // Step 2: Hybrid retrieve
    const docs = await matchDocuments(supabase, clinicId, embeddings[0], {
      k: maxChunks,
      sourceType: options?.sourceTypes?.[0] ?? undefined,
    });

    if (docs.length === 0) {
      return keywordFallback(supabase, clinicId, query);
    }

    // Step 3: Grade relevance
    const chunks = await gradeRelevance(supabase, docs, query);
    const relevant = chunks.filter((c) => c.relevant);

    // Step 4: Corrective path if too few relevant chunks
    if (relevant.length < MIN_RELEVANT_CHUNKS) {
      logger.info("RAG: Corrective path triggered", {
        context: "ai-rag",
        clinicId,
        relevantCount: relevant.length,
      });

      const rewrittenQuery = await rewriteQuery(supabase, query);
      if (rewrittenQuery && rewrittenQuery !== query) {
        const { embeddings: reEmbed } = await embedText([rewrittenQuery], apiKey);
        if (reEmbed.length > 0) {
          const reDocs = await matchDocuments(supabase, clinicId, reEmbed[0], {
            k: maxChunks,
          });
          const reChunks = await gradeRelevance(supabase, reDocs, rewrittenQuery);
          const reRelevant = reChunks.filter((c) => c.relevant);

          if (reRelevant.length >= MIN_RELEVANT_CHUNKS) {
            return buildContext(reChunks, "corrective", options?.maxContextTokens);
          }
        }
      }

      // Still thin — return what we have (may be empty → triggers refusal)
      if (relevant.length === 0) {
        return { chunks: [], sources: [], method: "none" };
      }
    }

    return buildContext(chunks, "vector", options?.maxContextTokens);
  } catch (err) {
    logger.error("RAG pipeline error, falling back to keyword", {
      context: "ai-rag",
      clinicId,
      error: err instanceof Error ? err.message : String(err),
    });
    return keywordFallback(supabase, clinicId, query);
  }
}

/**
 * Format the RAG context for injection into the system prompt.
 * Returns the structured context block with source citations.
 */
export function formatRAGContextBlock(context: RAGContext): string {
  if (context.chunks.length === 0 || context.method === "none") {
    return "";
  }

  const relevant = context.chunks.filter((c) => c.relevant);
  if (relevant.length === 0) return "";

  const lines = relevant.map((c, i) => `[${i + 1}] (${c.sourceType}) ${c.content}`);

  return [
    "## Informations de la clinique (sources vérifiées)",
    "",
    ...lines,
    "",
    "Instructions: Répondez UNIQUEMENT à partir des informations ci-dessus pour les questions spécifiques à la clinique. Si l'information n'est pas dans les sources, dites que vous ne disposez pas de cette information et orientez vers le contact de la clinique.",
  ].join("\n");
}

// ── Relevance grading ──

async function gradeRelevance(
  supabase: SupabaseClient,
  docs: DocumentMatch[],
  query: string,
): Promise<RAGChunk[]> {
  // Use similarity score as primary signal + cheap model for borderline cases
  const chunks: RAGChunk[] = docs.map((doc) => ({
    id: doc.id,
    content: doc.content,
    sourceType: doc.sourceType,
    similarity: doc.similarity,
    // High similarity = relevant without LLM grading
    relevant: doc.similarity >= RELEVANCE_THRESHOLD,
  }));

  // For borderline chunks (similarity between 0.15 and 0.3), use LLM grading
  const borderline = chunks.filter(
    (c) => c.similarity >= 0.15 && c.similarity < RELEVANCE_THRESHOLD,
  );

  if (borderline.length > 0) {
    try {
      const configs = await loadProviderConfigs(supabase);
      const provider = await selectAvailableProvider(configs);
      if (!provider) return chunks;

      const config = configs.get(provider);
      const providerApiKey = provider === "workers_ai" ? null : (config?.apiKey ?? null);

      const gradePrompt = borderline
        .map((c, i) => `Document ${i + 1}: "${c.content.slice(0, 200)}"`)
        .join("\n");

      const result = await callProvider(
        provider,
        {
          task: "classify",
          complexity: "simple",
          prompt: `Question utilisateur: "${query}"\n\n${gradePrompt}\n\nPour chaque document, répondez "relevant" ou "irrelevant" (un par ligne, dans l'ordre). Aucune explication.`,
          systemPrompt:
            "Vous êtes un classificateur de pertinence. Évaluez si chaque document aide à répondre à la question. Répondez uniquement 'relevant' ou 'irrelevant', un par ligne.",
          maxTokens: 100,
          temperature: 0,
        },
        providerApiKey,
      );

      const grades = result.text.split("\n").map((l) => l.trim().toLowerCase());

      for (let i = 0; i < borderline.length; i++) {
        if (grades[i]?.includes("relevant") && !grades[i]?.includes("irrelevant")) {
          borderline[i].relevant = true;
        }
      }
    } catch (err) {
      // Grading failure → keep similarity-based decisions
      logger.warn("RAG relevance grading failed", {
        context: "ai-rag",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return chunks;
}

// ── Query rewriting ──

async function rewriteQuery(
  supabase: SupabaseClient,
  originalQuery: string,
): Promise<string | null> {
  try {
    const configs = await loadProviderConfigs(supabase);
    const provider = await selectAvailableProvider(configs);
    if (!provider) return null;

    const config = configs.get(provider);
    const apiKey = provider === "workers_ai" ? null : (config?.apiKey ?? null);

    const result = await callProvider(
      provider,
      {
        task: "generate",
        complexity: "simple",
        prompt: `Reformulez cette question pour améliorer la recherche sémantique. Gardez le même sens. Répondez uniquement avec la question reformulée.\n\nQuestion: "${originalQuery}"`,
        systemPrompt:
          "Vous reformulez des questions pour optimiser la recherche dans une base de connaissances médicale/clinique. Répondez uniquement avec la question reformulée, sans explication.",
        maxTokens: 100,
        temperature: 0.3,
      },
      apiKey,
    );

    return result.text.trim() || null;
  } catch (err) {
    if (!(err instanceof ProviderError)) {
      logger.warn("Query rewrite failed", {
        context: "ai-rag",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  }
}

// ── Keyword fallback ──

async function keywordFallback(
  supabase: SupabaseClient,
  clinicId: string,
  query: string,
): Promise<RAGContext> {
  // Fall back to tsvector search on chatbot_faqs
  const { data: faqs, error } = await supabase
    .from("chatbot_faqs")
    .select("id, question, answer, keywords")
    .eq("clinic_id", clinicId)
    .textSearch("search_vector", query.split(" ").join(" & "), { type: "plain" })
    .limit(5);

  if (error || !faqs || faqs.length === 0) {
    return { chunks: [], sources: [], method: "keyword" };
  }

  const chunks: RAGChunk[] = faqs.map((faq) => ({
    id: faq.id,
    content: `Question: ${faq.question}\nRéponse: ${faq.answer}`,
    sourceType: "faq",
    similarity: 0.5, // Keyword matches get a mid-range score
    relevant: true,
  }));

  return buildContext(chunks, "keyword");
}

// ── Helpers ──

function buildContext(
  chunks: RAGChunk[],
  method: RAGContext["method"],
  maxContextTokens = MAX_CONTEXT_TOKENS,
): RAGContext {
  const relevant = chunks.filter((c) => c.relevant);
  const maxChars = maxContextTokens * CHARS_PER_TOKEN;

  // Truncate chunks to fit token budget
  let totalChars = 0;
  const included: RAGChunk[] = [];
  for (const chunk of relevant) {
    if (totalChars + chunk.content.length > maxChars) {
      // Truncate at sentence boundary
      const remaining = maxChars - totalChars;
      if (remaining > 100) {
        const truncated = chunk.content.slice(0, remaining);
        const lastSentence = truncated.lastIndexOf(".");
        included.push({
          ...chunk,
          content:
            lastSentence > remaining * 0.3 ? truncated.slice(0, lastSentence + 1) : truncated,
        });
      }
      break;
    }
    included.push(chunk);
    totalChars += chunk.content.length;
  }

  return {
    chunks: included,
    sources: included.map((c) => c.id),
    method,
  };
}
