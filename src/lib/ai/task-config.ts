/**
 * Per-task AI routing configuration.
 *
 * Super admins can pin a specific provider (and optionally a specific model)
 * for each `AITaskType` via the AI settings dashboard. The router consults
 * this map before its normal tier-based provider selection:
 *
 *   - No row / inactive row / NULL provider → auto (router decides)
 *   - Pinned provider available → it is tried first; normal priority order
 *     remains as fallback (a pin must never reduce availability)
 *   - Pinned model → resolved through the deprecated-alias map and validated
 *     against ALLOWED_MODELS; invalid pins are ignored with a logged warning
 *
 * Mirrors the 30s in-memory cache pattern of provider configs
 * (config-cache.ts) — same staleness bound, same multi-instance caveat.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { ALLOWED_MODELS, resolveModelAlias } from "./models";
import type { AIProvider, AITaskType } from "./types";

export interface TaskPin {
  provider: AIProvider | null;
  model: string | null;
}

const TTL_MS = 30_000;

interface CachedTaskConfigs {
  pins: Map<AITaskType, TaskPin>;
  expiresAt: number;
}

let _cached: CachedTaskConfigs | null = null;

/** Invalidate the cache — call whenever ai_task_configs is mutated. */
export function invalidateTaskConfigCache(): void {
  _cached = null;
}

/**
 * Load active task pins from `ai_task_configs`, with a 30s in-memory cache.
 * Fails open to an empty map (auto routing for everything) on any error so
 * a missing table or DB hiccup can never take AI down.
 */
async function loadTaskConfigs(supabase?: SupabaseClient): Promise<Map<AITaskType, TaskPin>> {
  if (_cached && Date.now() < _cached.expiresAt) return _cached.pins;

  const pins = new Map<AITaskType, TaskPin>();

  try {
    const client = supabase ?? createUntypedAdminClient("ai-task-config");
    const { data, error } = await client
      .from("ai_task_configs")
      .select("task_type, pinned_provider, pinned_model, is_active");

    if (error) {
      // Table may not exist yet (migration not run) — auto routing applies.
      if (error.code !== "42P01" && !error.message?.includes("does not exist")) {
        logger.warn("Failed to load AI task configs, using auto routing", {
          context: "ai-task-config",
          error: error.message,
        });
      }
      return pins;
    }

    for (const row of data ?? []) {
      if (!row.is_active) continue;

      let model: string | null = (row.pinned_model as string | null) ?? null;
      if (model) {
        const resolved = resolveModelAlias(model);
        if (resolved.deprecated) {
          logger.warn("Deprecated model pin auto-resolved", {
            context: "ai-task-config",
            task: row.task_type,
            original: resolved.original,
            replacement: resolved.model,
          });
        }
        if (!ALLOWED_MODELS.has(resolved.model)) {
          logger.warn("Ignoring task model pin outside the allowlist", {
            context: "ai-task-config",
            task: row.task_type,
            model,
          });
          model = null;
        } else {
          model = resolved.model;
        }
      }

      pins.set(row.task_type as AITaskType, {
        provider: (row.pinned_provider as AIProvider | null) ?? null,
        model,
      });
    }
  } catch (err) {
    logger.warn("AI task config load threw, using auto routing", {
      context: "ai-task-config",
      error: err instanceof Error ? err.message : String(err),
    });
    return pins;
  }

  _cached = { pins, expiresAt: Date.now() + TTL_MS };
  return pins;
}

/** Resolve the pin for a single task. Null = full auto. */
export async function getTaskPin(
  task: AITaskType,
  supabase?: SupabaseClient,
): Promise<TaskPin | null> {
  const pins = await loadTaskConfigs(supabase);
  return pins.get(task) ?? null;
}
