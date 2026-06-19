/**
 * AI Builder model catalog (types + client-safe helpers).
 *
 * The list of models the picker shows is NO LONGER hard-coded here. It is
 * derived at request time from the platform's managed provider registry
 * (`ai_provider_configs`) — see `models.server.ts`. Whatever providers a
 * super_admin marks **active** in /admin/ai-config become the builder's
 * model menu, and the AI Worker (webs-alots-ai) routes each one with its
 * own per-provider secret.
 *
 * This file stays free of server-only imports so it can be pulled into the
 * client bundle (the chat component imports the `BuilderModel` type and the
 * fallback constant).
 */

import type { AIProvider } from "@/lib/ai/types";

export interface BuilderModel {
  /** The concrete model id sent to the provider, e.g. "claude-sonnet-4-6". */
  id: string;
  /** Provider that serves this model — drives routing in the AI Worker. */
  provider: AIProvider;
  /** Human-readable label for the picker (the provider's display name). */
  name: string;
  /** Short descriptor shown under the option (model id + routing tier). */
  description: string;
}

/**
 * Shown when no providers are active (or the lookup fails) so the picker is
 * never empty. Mirrors the AI Worker's historical default (Groq Llama 3.3
 * 70B), which only needs the free GROQ_API_KEY secret.
 */
export const FALLBACK_BUILDER_MODEL: BuilderModel = {
  id: "llama-3.3-70b-versatile",
  provider: "groq",
  name: "Groq (Fast Inference)",
  description: "llama-3.3-70b-versatile · fallback",
};

/** Find a model in a catalog by its id (used by the picker). */
export function findBuilderModel(models: BuilderModel[], id: string): BuilderModel | undefined {
  return models.find((m) => m.id === id);
}
