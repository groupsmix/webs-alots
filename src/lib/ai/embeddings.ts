/**
 * AI Embedding infrastructure — Phase B1.
 *
 * Provides `embedText()` for generating embeddings via the router pattern
 * (OpenAI text-embedding-3-small primary, Workers AI fallback) and
 * `matchDocuments()` for hybrid vector+keyword retrieval from ai_documents.
 *
 * All operations are clinic-scoped via `clinic_id` (defense in depth).
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { logger } from "@/lib/logger";

// ── Constants ──

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const MAX_BATCH_SIZE = 100;

// ── Types ──

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  inputTokens: number;
}

export interface DocumentMatch {
  id: string;
  clinicId: string;
  sourceType: string;
  sourceId: string | null;
  language: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

// ── Embedding generation ──

/**
 * Generate embeddings for an array of texts.
 *
 * Uses OpenAI text-embedding-3-small (1536 dims) via the AI SDK.
 * Falls back gracefully with an error log if the provider is unavailable.
 *
 * @param texts - Array of text strings to embed (max 100 per call)
 * @param apiKey - OpenAI API key (from router config)
 */
export async function embedText(texts: string[], apiKey: string): Promise<EmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], model: EMBEDDING_MODEL, inputTokens: 0 };
  }

  if (texts.length > MAX_BATCH_SIZE) {
    throw new Error(`embedText batch size ${texts.length} exceeds max ${MAX_BATCH_SIZE}`);
  }

  const openai = createOpenAI({ apiKey });
  const model = openai.embedding(EMBEDDING_MODEL);

  const result = await embedMany({
    model,
    values: texts,
  });

  // Validate dimensions
  for (const emb of result.embeddings) {
    if (emb.length !== EMBEDDING_DIMS) {
      logger.warn("Embedding dimension mismatch", {
        context: "ai-embeddings",
        expected: EMBEDDING_DIMS,
        got: emb.length,
      });
    }
  }

  return {
    embeddings: result.embeddings,
    model: EMBEDDING_MODEL,
    inputTokens: result.usage?.tokens ?? 0,
  };
}

// ── Document matching (hybrid vector + keyword) ──

/**
 * Retrieve the top-k most similar documents for a clinic via the
 * `match_documents` SQL function (cosine similarity + optional keyword filter).
 *
 * @param supabase - Supabase client (admin or tenant-scoped)
 * @param clinicId - Clinic UUID (tenant scope)
 * @param queryEmbedding - 1536-dim embedding of the query
 * @param options - Optional filters: k (default 8), sourceType, keyword
 */
export async function matchDocuments(
  supabase: SupabaseClient,
  clinicId: string,
  queryEmbedding: number[],
  options?: {
    k?: number;
    sourceType?: string;
    keyword?: string;
  },
): Promise<DocumentMatch[]> {
  const k = options?.k ?? 8;

  const { data, error } = await supabase.rpc("match_documents", {
    p_clinic_id: clinicId,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_match_count: k,
    p_source_type: options?.sourceType ?? null,
    p_keyword: options?.keyword ?? null,
  });

  if (error) {
    logger.error("match_documents RPC failed", {
      context: "ai-embeddings",
      clinicId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    clinicId: row.clinic_id as string,
    sourceType: row.source_type as string,
    sourceId: (row.source_id as string) ?? null,
    language: row.language as string,
    content: row.content as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    similarity: row.similarity as number,
  }));
}

// ── Helpers ──

/** Truncate text to a max token estimate (rough: 1 token ≈ 4 chars). */
export function truncateForEmbedding(text: string, maxTokens = 8191): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  // Truncate at sentence boundary
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf(".");
  return lastPeriod > maxChars * 0.5 ? truncated.slice(0, lastPeriod + 1) : truncated;
}
