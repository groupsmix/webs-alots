/**
 * Admin AI Emergency Kill Switch API
 *
 * GET  — current kill-switch state:
 *          { ai_enabled, env_locked, kv_available }
 * POST — flip the switch: { enabled: boolean, confirm: true }
 *
 * Super admin only. Writes the `ai.enabled` flag in FEATURE_FLAGS_KV — the
 * same flag `isAIEnabled()` (F-AI-01) checks at the top of every AI route
 * and inside `resolveAIConfig()`, so flipping it stops ALL AI traffic
 * platform-wide within seconds. No deploy, no env change.
 *
 * Notes:
 *  - `AI_DISABLED=true` in the environment always wins (env_locked). The
 *    dashboard cannot re-enable AI while the env override is set.
 *  - Disabling requires an explicit `confirm: true` in the body as a second
 *    server-side guard behind the UI confirmation dialog.
 *  - Every flip is logged with the acting super admin's user id (audit trail).
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { getKVBinding, isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

const KILL_SWITCH_KEY = "ai.enabled";

// ── GET: current state ──

async function handleGet(_req: NextRequest, _auth: AuthContext) {
  const envLocked = process.env.AI_DISABLED === "true"; // nosemgrep: semgrep.env-access — kill-switch status read

  let kvAvailable = false;
  try {
    const kv = await getKVBinding("FEATURE_FLAGS_KV");
    kvAvailable = !!kv;
  } catch {
    kvAvailable = false;
  }

  return apiSuccess({
    ai_enabled: await isAIEnabled(),
    env_locked: envLocked,
    kv_available: kvAvailable,
  });
}

// ── POST: flip the switch ──

async function handlePost(req: NextRequest, auth: AuthContext) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const enabled = body.enabled;
  if (typeof enabled !== "boolean") {
    return apiValidationError("enabled (boolean) is required");
  }

  // Server-side double-confirmation — the UI dialog is not enough on its own.
  if (body.confirm !== true) {
    return apiValidationError("confirm: true is required to change the AI kill switch");
  }

  if (enabled && process.env.AI_DISABLED === "true") {
    // nosemgrep: semgrep.env-access — kill-switch guard
    return apiError(
      "AI is disabled via the AI_DISABLED environment variable. Remove the env override to re-enable from the dashboard.",
      409,
    );
  }

  const kv = await getKVBinding("FEATURE_FLAGS_KV");
  if (!kv) {
    return apiError(
      "Feature flag storage (FEATURE_FLAGS_KV) is not available in this environment. Use the AI_DISABLED environment variable instead.",
      503,
    );
  }

  try {
    // isAIEnabled() treats anything except the literal "false" as enabled.
    await kv.put(KILL_SWITCH_KEY, enabled ? "true" : "false");
  } catch (err) {
    logger.error("Failed to write AI kill switch to KV", {
      context: "ai-kill-switch",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Failed to update the AI kill switch", 500);
  }

  // Audit trail — a platform-wide stop/start must always be attributable.
  logger.warn(enabled ? "AI re-enabled platform-wide" : "EMERGENCY STOP: AI disabled platform-wide", {
    context: "ai-kill-switch",
    enabled,
    actorUserId: auth.user.id,
  });

  return apiSuccess({ ai_enabled: enabled });
}

export const GET = withAuth((req, auth) => handleGet(req, auth), ["super_admin"]);

export const POST = withAuth((req, auth) => handlePost(req, auth), ["super_admin"]);
