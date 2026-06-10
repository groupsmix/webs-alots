/**
 * AI Memory — Phase B3 (odysseus pattern).
 *
 * Stores durable, non-PHI clinic-level facts extracted from conversations.
 * Facts are auto-extracted post-turn, periodically consolidated, and
 * injected into agent system prompts for contextual awareness.
 *
 * Hard rule: pseudonymise BEFORE extraction. Reject any candidate fact
 * containing patient identifiers or pseudonym placeholders.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/ai/embeddings";
import { callProvider, ProviderError } from "@/lib/ai/providers";
import { createPseudonymMap, pseudonymise } from "@/lib/ai/pseudonymise";
import { loadProviderConfigs, selectAvailableProvider } from "@/lib/ai/router";
import { logger } from "@/lib/logger";

// ── Types ──

export interface AIMemory {
  id: string;
  clinicId: string;
  agentType: string;
  content: string;
  confidence: number;
  lastUsedAt: string;
  createdAt: string;
}

export interface ExtractionResult {
  facts: string[];
  rejected: string[];
}

// ── Constants ──

const MAX_FACTS_PER_TURN = 3;
const MAX_MEMORIES_RETRIEVED = 5;
const PHI_PLACEHOLDER_PATTERN = /\[(?:NAME|PHONE|EMAIL|ID|DOB|ADDRESS|SSN|CNSS|CIN)_\w+\]/i;

// ── Extraction ──

/**
 * Extract 0–3 candidate clinic-level facts from a conversation turn.
 *
 * Pseudonymises the content first, then rejects any fact containing
 * patient identifiers or pseudonym placeholders.
 */
export async function extractMemoryFacts(
  supabase: SupabaseClient,
  clinicId: string,
  agentType: string,
  conversationContent: string,
  conversationId?: string,
): Promise<ExtractionResult> {
  const result: ExtractionResult = { facts: [], rejected: [] };

  try {
    // Pseudonymise before extraction
    const pseudoMap = createPseudonymMap();
    const pseudoObj = pseudonymise({ text: conversationContent }, pseudoMap);
    const pseudoContent = pseudoObj.text as string;

    const configs = await loadProviderConfigs(supabase);
    const provider = selectAvailableProvider(configs);
    if (!provider) return result;

    const config = configs.get(provider);
    const apiKey = provider === "workers_ai" ? null : (config?.apiKey ?? null);

    const extractionResult = await callProvider(
      provider,
      {
        task: "classify",
        complexity: "simple",
        prompt: `Conversation:\n${pseudoContent}\n\nExtrayez 0 à 3 faits DURABLES au niveau de la clinique (politiques, préférences, horaires, procédures). NE PAS inclure d'informations sur les patients. Un fait par ligne. Si aucun fait pertinent, répondez "AUCUN".`,
        systemPrompt:
          "Vous extrayez des faits organisationnels durables. Uniquement des informations de niveau clinique (horaires, politiques, préférences de personnel). JAMAIS de données patient (noms, diagnostics, traitements, numéros). Répondez avec des faits concis, un par ligne.",
        maxTokens: 200,
        temperature: 0,
      },
      apiKey,
    );

    const lines = extractionResult.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l !== "AUCUN" && l !== "NONE" && l.length > 10);

    // Filter out PHI-containing facts
    for (const line of lines.slice(0, MAX_FACTS_PER_TURN)) {
      if (PHI_PLACEHOLDER_PATTERN.test(line)) {
        result.rejected.push(line);
        continue;
      }
      // Also reject if line contains common PHI patterns
      if (/\b\d{10,}\b/.test(line) || /\b[A-Z]\d{7,}\b/.test(line)) {
        result.rejected.push(line);
        continue;
      }
      result.facts.push(line);
    }

    // Store accepted facts
    if (result.facts.length > 0) {
      const openaiConfig = configs.get("openai");
      const embedApiKey = openaiConfig?.apiKey;

      let embeddings: number[][] | null = null;
      if (embedApiKey) {
        try {
          const embedResult = await embedText(result.facts, embedApiKey);
          embeddings = embedResult.embeddings;
        } catch {
          // Embedding failure is non-fatal — store without embedding
        }
      }

      const rows = result.facts.map((fact, i) => ({
        clinic_id: clinicId,
        agent_type: agentType,
        content: fact,
        embedding: embeddings?.[i] ? JSON.stringify(embeddings[i]) : null,
        source_conversation_id: conversationId ?? null,
        confidence: 0.7,
      }));

      const { error } = await supabase.from("ai_memories").insert(rows);

      if (error) {
        logger.error("Failed to store memory facts", {
          context: "ai-memory",
          clinicId,
          error: error.message,
        });
      }
    }

    if (result.rejected.length > 0) {
      logger.info("Rejected PHI-containing memory candidates", {
        context: "ai-memory",
        clinicId,
        rejectedCount: result.rejected.length,
      });
    }
  } catch (err) {
    if (!(err instanceof ProviderError)) {
      logger.error("Memory extraction failed", {
        context: "ai-memory",
        clinicId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

// ── Retrieval ──

/**
 * Retrieve top-5 memories by similarity to the current conversation,
 * for injection into the agent system prompt.
 */
export async function retrieveMemories(
  supabase: SupabaseClient,
  clinicId: string,
  agentType: string,
  conversationContext: string,
): Promise<AIMemory[]> {
  try {
    // Try vector similarity first
    const configs = await loadProviderConfigs(supabase);
    const openaiConfig = configs.get("openai");
    const apiKey = openaiConfig?.apiKey;

    if (apiKey) {
      try {
        const { embeddings } = await embedText([conversationContext], apiKey);
        if (embeddings.length > 0) {
          // Use RPC for vector similarity search on ai_memories
          const { data, error } = await supabase.rpc("match_memories", {
            p_clinic_id: clinicId,
            p_agent_type: agentType,
            p_query_embedding: JSON.stringify(embeddings[0]),
            p_match_count: MAX_MEMORIES_RETRIEVED,
          });

          if (!error && data && data.length > 0) {
            // Update last_used_at for retrieved memories
            const ids = data.map((m: Record<string, unknown>) => m.id);
            void supabase
              .from("ai_memories")
              .update({ last_used_at: new Date().toISOString() })
              .in("id", ids);

            return data.map(mapMemoryRow);
          }
        }
      } catch {
        // Fall through to text-based retrieval
      }
    }

    // Fallback: get recent memories for this clinic/agent
    const { data, error } = await supabase
      .from("ai_memories")
      .select("id, clinic_id, agent_type, content, confidence, last_used_at, created_at")
      .eq("clinic_id", clinicId)
      .eq("agent_type", agentType)
      .gte("confidence", 0.5)
      .order("last_used_at", { ascending: false })
      .limit(MAX_MEMORIES_RETRIEVED);

    if (error || !data) return [];
    return data.map(mapMemoryRow);
  } catch (err) {
    logger.warn("Memory retrieval failed", {
      context: "ai-memory",
      clinicId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Format memories for injection into the agent system prompt.
 */
export function formatMemoryBlock(memories: AIMemory[]): string {
  if (memories.length === 0) return "";

  const lines = memories.map(
    (m, i) => `${i + 1}. ${m.content} (confiance: ${Math.round(m.confidence * 100)}%)`,
  );

  return [
    "## Mémoire clinique (peut être obsolète)",
    "",
    ...lines,
    "",
    "Note: Ces informations proviennent de conversations précédentes et peuvent ne plus être à jour.",
  ].join("\n");
}

// ── Consolidation ──

/**
 * Consolidate memories for a clinic: merge duplicates, rewrite vague,
 * delete low-confidence/stale entries.
 *
 * Called by the weekly consolidation cron.
 */
export async function consolidateMemories(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<{ merged: number; deleted: number; rewritten: number }> {
  const stats = { merged: 0, deleted: 0, rewritten: 0 };

  try {
    // Fetch all memories for the clinic
    const { data: memories, error } = await supabase
      .from("ai_memories")
      .select("id, content, confidence, created_at, last_used_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true });

    if (error || !memories || memories.length < 2) return stats;

    // Step 1: Delete low-confidence memories older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const stale = memories.filter((m) => m.confidence < 0.5 && m.last_used_at < thirtyDaysAgo);

    if (stale.length > 0) {
      const { error: delErr } = await supabase
        .from("ai_memories")
        .delete()
        .in(
          "id",
          stale.map((m) => m.id),
        );

      if (!delErr) stats.deleted = stale.length;
    }

    // Step 2: Use LLM to identify duplicates and merge
    const remaining = memories.filter((m) => !stale.some((s) => s.id === m.id));
    if (remaining.length < 2) return stats;

    const configs = await loadProviderConfigs(supabase);
    const provider = selectAvailableProvider(configs);
    if (!provider) return stats;

    const config = configs.get(provider);
    const apiKey = provider === "workers_ai" ? null : (config?.apiKey ?? null);

    const memoryList = remaining.map((m, i) => `[${i + 1}] ${m.content}`).join("\n");

    const consolidationResult = await callProvider(
      provider,
      {
        task: "analyze",
        complexity: "medium",
        prompt: `Mémoires de la clinique:\n${memoryList}\n\nIdentifiez:\n1. DOUBLONS: paires de numéros qui disent la même chose (format: "MERGE X,Y -> texte fusionné")\n2. VAGUES: mémoires trop vagues pour être utiles (format: "DELETE X")\n3. À RÉÉCRIRE: mémoires qui pourraient être plus claires (format: "REWRITE X -> nouveau texte")\n\nSi rien à changer, répondez "AUCUN CHANGEMENT".`,
        systemPrompt:
          "Vous consolidez une base de mémoires organisationnelles. Identifiez doublons, entrées vagues, et celles à améliorer. Format strict: MERGE/DELETE/REWRITE.",
        maxTokens: 500,
        temperature: 0,
      },
      apiKey,
    );

    const actions = consolidationResult.text.split("\n").filter((l) => l.trim());

    for (const action of actions) {
      if (action.startsWith("MERGE")) {
        const match = action.match(/MERGE\s+(\d+)\s*,\s*(\d+)\s*->\s*(.+)/);
        if (match) {
          const idx1 = parseInt(match[1], 10) - 1;
          const idx2 = parseInt(match[2], 10) - 1;
          const merged = match[3].trim();

          if (remaining[idx1] && remaining[idx2]) {
            // Update first, delete second
            await supabase
              .from("ai_memories")
              .update({
                content: merged,
                confidence: Math.max(remaining[idx1].confidence, remaining[idx2].confidence),
              })
              .eq("id", remaining[idx1].id);

            await supabase.from("ai_memories").delete().eq("id", remaining[idx2].id);

            stats.merged++;
          }
        }
      } else if (action.startsWith("DELETE")) {
        const match = action.match(/DELETE\s+(\d+)/);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          if (remaining[idx]) {
            await supabase.from("ai_memories").delete().eq("id", remaining[idx].id);
            stats.deleted++;
          }
        }
      } else if (action.startsWith("REWRITE")) {
        const match = action.match(/REWRITE\s+(\d+)\s*->\s*(.+)/);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          const rewritten = match[2].trim();
          if (remaining[idx]) {
            await supabase
              .from("ai_memories")
              .update({ content: rewritten })
              .eq("id", remaining[idx].id);
            stats.rewritten++;
          }
        }
      }
    }
  } catch (err) {
    logger.error("Memory consolidation failed", {
      context: "ai-memory",
      clinicId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return stats;
}

// ── Helpers ──

function mapMemoryRow(row: Record<string, unknown>): AIMemory {
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    agentType: row.agent_type as string,
    content: row.content as string,
    confidence: row.confidence as number,
    lastUsedAt: row.last_used_at as string,
    createdAt: row.created_at as string,
  };
}
