/**
 * Tests for the single model registry (Task A2).
 *
 * Guards the registry refresh invariants:
 *  - every default model ID is in the generated allowlist (acceptance A2)
 *  - the deprecated-alias map never widens the allowlist, never chains,
 *    and always resolves to an allowed model
 *  - floating aliases stay rejected (W8-S-03)
 *  - pricing/context metadata stays sane for cost accounting
 */
import { describe, it, expect } from "vitest";
import {
  ALLOWED_MODELS,
  DEPRECATED_MODEL_ALIASES,
  PINNED_SNAPSHOT_MODELS,
  PROVIDER_MODELS,
  PROVIDER_PRIORITY,
  resolveModelAlias,
} from "@/lib/ai/models";

describe("model registry (Task A2)", () => {
  it("every provider default model ID is in the allowlist", () => {
    for (const config of Object.values(PROVIDER_MODELS)) {
      expect(ALLOWED_MODELS.has(config.model)).toBe(true);
    }
  });

  it("every pinned snapshot ID is in the allowlist", () => {
    for (const id of PINNED_SNAPSHOT_MODELS) {
      expect(ALLOWED_MODELS.has(id)).toBe(true);
    }
  });

  it("every provider in the priority list has a registry entry", () => {
    for (const provider of PROVIDER_PRIORITY) {
      expect(PROVIDER_MODELS[provider]).toBeDefined();
      expect(PROVIDER_MODELS[provider].provider).toBe(provider);
    }
  });

  it("no decommissioned ID appears as a default or pinned model", () => {
    const current = new Set([
      ...Object.values(PROVIDER_MODELS).map((m) => m.model),
      ...PINNED_SNAPSHOT_MODELS,
    ]);
    for (const deprecated of Object.keys(DEPRECATED_MODEL_ALIASES)) {
      expect(current.has(deprecated)).toBe(false);
    }
  });

  it("has sane pricing and context metadata for cost accounting", () => {
    for (const config of Object.values(PROVIDER_MODELS)) {
      expect(config.maxContextTokens).toBeGreaterThan(0);
      expect(config.rpmLimit).toBeGreaterThan(0);
      expect(config.costPerInputToken).toBeGreaterThanOrEqual(0);
      expect(config.costPerOutputToken).toBeGreaterThanOrEqual(0);
      if (config.provider !== "workers_ai") {
        // Paid providers must have non-zero pricing or cost caps go blind.
        expect(config.costPerInputToken).toBeGreaterThan(0);
        expect(config.costPerOutputToken).toBeGreaterThan(0);
      }
    }
  });
});

describe("DEPRECATED_MODEL_ALIASES (Task A2)", () => {
  it("every alias target is in the allowlist", () => {
    for (const target of Object.values(DEPRECATED_MODEL_ALIASES)) {
      expect(ALLOWED_MODELS.has(target)).toBe(true);
    }
  });

  it("never chains: no target is itself a deprecated key", () => {
    for (const target of Object.values(DEPRECATED_MODEL_ALIASES)) {
      expect(DEPRECATED_MODEL_ALIASES[target]).toBeUndefined();
    }
  });

  it("no deprecated key is in the allowlist (resolution, not widening)", () => {
    for (const deprecated of Object.keys(DEPRECATED_MODEL_ALIASES)) {
      expect(ALLOWED_MODELS.has(deprecated)).toBe(false);
    }
  });

  it("resolves known decommissioned IDs to their replacements", () => {
    expect(resolveModelAlias("llama-3.1-70b-versatile")).toEqual({
      model: "llama-3.3-70b-versatile",
      deprecated: true,
      original: "llama-3.1-70b-versatile",
    });
    expect(resolveModelAlias("claude-sonnet-4-20250514").model).toBe("claude-sonnet-4-6");
    expect(resolveModelAlias("gemini-2.0-flash").model).toBe("gemini-3.5-flash");
    expect(resolveModelAlias("deepseek-chat").model).toBe("deepseek-v4-flash");
    expect(resolveModelAlias("mistral-small-latest").model).toBe("mistral-small-2603");
    expect(resolveModelAlias("grok-3-mini").model).toBe("grok-4.3");
    expect(resolveModelAlias("gpt-4.1-mini").model).toBe("gpt-5.4-mini");
  });

  it("passes current model IDs through untouched", () => {
    for (const config of Object.values(PROVIDER_MODELS)) {
      expect(resolveModelAlias(config.model)).toEqual({
        model: config.model,
        deprecated: false,
      });
    }
  });

  it("does not rescue never-allowed floating aliases (W8-S-03)", () => {
    for (const floating of ["gpt-4o-mini", "chat-latest", "gemini-flash-latest"]) {
      const resolution = resolveModelAlias(floating);
      expect(resolution.deprecated).toBe(false);
      expect(ALLOWED_MODELS.has(resolution.model)).toBe(false);
    }
  });
});
