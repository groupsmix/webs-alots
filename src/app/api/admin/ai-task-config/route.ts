/**
 * Admin AI Task Routing API
 *
 * GET   — list per-task routing pins (ai_task_configs) plus the model
 *         allowlist the UI may pick from (single source of truth: models.ts)
 * PATCH — update one task's pin: { task_type, pinned_provider?, pinned_model?, is_active? }
 *
 * Super admin only. A NULL pinned_provider means "auto" (router decides by
 * tier). Model pins are validated against the shared allowlist so a stale or
 * mistyped model can never reach a provider (F-AI-07 / W8-S-03 posture).
 *
 * Any write invalidates the task-config cache so the next /api/ai call picks
 * up the new routing immediately on the same instance.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  ALLOWED_MODELS,
  PINNED_SNAPSHOT_MODELS,
  PROVIDER_MODELS,
  resolveModelAlias,
} from "@/lib/ai/models";
import { invalidateTaskConfigCache } from "@/lib/ai/task-config";
import type { AIProvider, AITaskType } from "@/lib/ai/types";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

const TASK_TYPES: readonly AITaskType[] = [
  "classify",
  "summarize",
  "generate",
  "translate",
  "analyze",
  "reason",
  "code",
  "conversation",
] as const;

const PROVIDERS: readonly AIProvider[] = [
  "workers_ai",
  "anthropic",
  "google",
  "deepseek",
  "groq",
  "openai",
  "mistral",
  "xai",
] as const;

// ── GET: list task pins + selectable models per provider ──

async function handleGet(_req: NextRequest, _auth: AuthContext) {
  const supabase = createUntypedAdminClient("ai-task-config-list");

  const { data, error } = await supabase
    .from("ai_task_configs")
    .select("id, task_type, pinned_provider, pinned_model, is_active, max_retries, updated_at")
    .order("task_type");

  if (error) {
    // Table may not exist yet if the migration hasn't run
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return apiSuccess({ tasks: [], models: buildModelOptions(), migrated: false });
    }
    logger.error("Failed to fetch AI task configs", {
      context: "ai-task-config",
      error: error.message,
    });
    return apiError("Failed to fetch AI task configurations", 500);
  }

  return apiSuccess({ tasks: data ?? [], models: buildModelOptions(), migrated: true });
}

/**
 * Per-provider model options the UI may offer. Derived from the registry
 * defaults plus the pinned snapshot list — never free-form.
 */
function buildModelOptions(): Record<string, string[]> {
  const options: Record<string, string[]> = {};
  for (const provider of PROVIDERS) {
    const registryDefault = PROVIDER_MODELS[provider]?.model;
    const set = new Set<string>();
    if (registryDefault) set.add(registryDefault);
    // PINNED_SNAPSHOT_MODELS is the OpenAI snapshot list (flat array)
    if (provider === "openai") {
      for (const m of PINNED_SNAPSHOT_MODELS) set.add(m);
    }
    options[provider] = [...set];
  }
  return options;
}

// ── PATCH: update one task pin ──

async function handlePatch(req: NextRequest, auth: AuthContext) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const patchSchema = z.object({
    task_type: z.string(),
    pinned_provider: z.string().nullable().optional(),
    pinned_model: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    max_retries: z.number().int().min(0).max(5).optional(),
  });

  const parsedResult = patchSchema.safeParse(body);
  if (!parsedResult.success) {
    return apiValidationError(parsedResult.error.issues[0].message);
  }
  const parsed = parsedResult.data;

  if (!TASK_TYPES.includes(parsed.task_type as AITaskType)) {
    return apiValidationError(`task_type must be one of: ${TASK_TYPES.join(", ")}`);
  }
  const taskType = parsed.task_type;

  const update: Record<string, unknown> = {};

  if ("pinned_provider" in parsed) {
    const provider = parsed.pinned_provider;
    if (provider !== null && !PROVIDERS.includes(provider as AIProvider)) {
      return apiValidationError(`pinned_provider must be null or one of: ${PROVIDERS.join(", ")}`);
    }
    update.pinned_provider = provider;
    // Switching provider invalidates any model pin from the previous provider
    if (!("pinned_model" in parsed)) update.pinned_model = null;
  }

  if ("pinned_model" in parsed) {
    const model = parsed.pinned_model;
    if (model != null) {
      const resolved = resolveModelAlias(model);
      if (!ALLOWED_MODELS.has(resolved.model)) {
        return apiValidationError("pinned_model is not in the model allowlist");
      }
      update.pinned_model = resolved.model;
    } else {
      update.pinned_model = null;
    }
  }

  if ("is_active" in parsed) {
    update.is_active = parsed.is_active;
  }

  if ("max_retries" in parsed) {
    update.max_retries = parsed.max_retries;
  }

  if (Object.keys(update).length === 0) {
    return apiValidationError("No valid fields to update");
  }

  update.updated_by = auth.user.id;
  update.updated_at = new Date().toISOString();

  const supabase = createUntypedAdminClient("ai-task-config-update");

  const { error } = await supabase
    .from("ai_task_configs")
    .update(update)
    .eq("task_type", parsed.task_type);

  if (error) {
    logger.error("Failed to update AI task config", {
      context: "ai-task-config",
      taskType,
      error: error.message,
    });
    return apiError("Failed to update task configuration", 500);
  }

  invalidateTaskConfigCache();

  logger.info("AI task routing updated", {
    context: "ai-task-config",
    taskType,
    update: { ...update, updated_by: undefined },
    updatedBy: auth.user.id,
  });

  return apiSuccess({ updated: true, task_type: taskType });
}

export const GET = withAuth((req, auth) => handleGet(req, auth), ["super_admin"]);

export const PATCH = withAuth((req, auth) => handlePatch(req, auth), ["super_admin"]);
