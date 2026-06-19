/**
 * Server-only derivation of the AI Builder model catalog.
 *
 * Reads the platform's managed provider registry (`ai_provider_configs`) and
 * turns every **active** provider into a builder model entry, using each
 * provider's canonical model from the central AI model catalog
 * (`src/lib/ai/models.ts`). Management lives entirely in the existing
 * /admin/ai-config dashboard — activate a provider there and it shows up in
 * the builder picker; deactivate it and it disappears.
 *
 * Security boundary: this only reads provider METADATA (name, active flag,
 * routing tier). It never reads `api_key_encrypted` — the AI Worker holds its
 * own per-provider secrets and decrypts nothing. So no PHI-grade key material
 * is involved in surfacing the picker.
 *
 * NOT imported by any client component (filename `.server.ts`); the chat UI
 * receives the resolved list as a prop from the server page.
 */

import { PROVIDER_MODELS } from "@/lib/ai/models";
import type { AIProvider } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { FALLBACK_BUILDER_MODEL, type BuilderModel } from "./models";

/**
 * Providers the AI Worker (workers/ai) has a routing path + secret slot for.
 * Workers AI is intentionally excluded: it needs a Cloudflare account binding
 * rather than a simple API-key secret, so it is not offered in the builder.
 * Keep this in sync with `PROVIDER_SECRET_ENV` in
 * workers/ai/src/handlers/builder-sandbox.ts.
 */
export const BUILDER_SUPPORTED_PROVIDERS: ReadonlySet<AIProvider> = new Set<AIProvider>([
  "groq",
  "anthropic",
  "google",
  "openai",
  "deepseek",
  "mistral",
  "xai",
]);

interface ActiveProviderRow {
  provider: string;
  display_name: string | null;
  routing_tier: number | null;
}

/**
 * Build the builder's model menu from active, builder-supported providers.
 * Always returns at least one entry (the fallback) so the picker is never
 * empty. Sorted premium-first (highest routing tier first) to match the
 * dashboard's ordering.
 */
export async function getActiveBuilderModels(): Promise<BuilderModel[]> {
  try {
    const supabase = createUntypedAdminClient("ai-config-list");

    const { data, error } = await supabase // nosemgrep: semgrep.tenant-scoping -- platform-global AI config, no clinic scoping
      .from("ai_provider_configs")
      .select("provider, display_name, routing_tier")
      .eq("is_active", true)
      .order("routing_tier", { ascending: false });

    if (error) {
      // Table may not exist yet in some environments — degrade gracefully.
      logger.warn("Builder model lookup failed; using fallback", {
        context: "builder-models",
        error: error.message,
      });
      return [FALLBACK_BUILDER_MODEL];
    }

    const models = ((data ?? []) as ActiveProviderRow[])
      .filter((row) => BUILDER_SUPPORTED_PROVIDERS.has(row.provider as AIProvider))
      .map((row) => {
        const provider = row.provider as AIProvider;
        const config = PROVIDER_MODELS[provider];
        if (!config) return null;
        return {
          id: config.model,
          provider,
          name: row.display_name ?? provider,
          description: `${config.model} · tier ${row.routing_tier ?? 0}`,
        } satisfies BuilderModel;
      })
      .filter((model): model is BuilderModel => model !== null);

    return models.length > 0 ? models : [FALLBACK_BUILDER_MODEL];
  } catch (err) {
    logger.error("Unexpected error loading builder models", {
      context: "builder-models",
      error: err instanceof Error ? err.message : String(err),
    });
    return [FALLBACK_BUILDER_MODEL];
  }
}
