/**
 * Tests for the unified AI config resolution (Task A1).
 *
 * `resolveAIConfig()` must delegate provider/model selection to the
 * DB-backed router path (`loadProviderConfigs()` + `selectAvailableProvider()`)
 * while preserving its legacy return shape and safety rails:
 * kill switch (F-AI-01), base-URL allowlist (F-AI-05), model allowlist
 * (F-AI-07 / W8-S-03), and per-request seed (F-AI-14).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AIProvider, ProviderConfig, RoutingTier } from "@/lib/ai/types";

// ── Mocks ──

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/ai-disclaimer", () => ({
  AI_DISCLAIMER_FR: "Test disclaimer",
  getAIDisclaimer: vi.fn(() => "Test disclaimer"),
}));

vi.mock("@/lib/features", () => ({
  isAIEnabled: vi.fn(async () => true),
  getKVBinding: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: vi.fn(() => ({})),
}));

const { loadProviderConfigsMock } = vi.hoisted(() => ({
  loadProviderConfigsMock: vi.fn(),
}));

// Keep the real selection logic (selectAvailableProvider, priority ordering,
// availability rules) — only the DB load is mocked.
vi.mock("@/lib/ai/router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/router")>();
  return { ...actual, loadProviderConfigs: loadProviderConfigsMock };
});

// ── Helpers ──

function makeConfig(provider: AIProvider, overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    provider,
    displayName: provider,
    apiKey: `${provider}-key`,
    isActive: true,
    routingTier: 1 as RoutingTier,
    fallbackProvider: null,
    monthlyBudgetCents: 0,
    requestsThisMonth: 0,
    tokensThisMonth: 0,
    inputTokensThisMonth: 0,
    outputTokensThisMonth: 0,
    costThisMonthCents: 0,
    rateLimitedUntil: null,
    lastError: null,
    ...overrides,
  };
}

function makeConfigMap(...configs: ProviderConfig[]): Map<AIProvider, ProviderConfig> {
  return new Map(configs.map((c) => [c.provider, c]));
}

const ENV_VARS = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_AI_API_TOKEN",
  "CLOUDFLARE_AI_TOKEN",
] as const;

describe("resolveAIConfig (unified path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ENV_VARS) vi.stubEnv(key, "");
    loadProviderConfigsMock.mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when the kill switch is engaged", async () => {
    const { isAIEnabled } = await import("@/lib/features");
    vi.mocked(isAIEnabled).mockResolvedValueOnce(false);

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(503);
      expect(result.reason).toBe("AI features are disabled");
    }
    expect(loadProviderConfigsMock).not.toHaveBeenCalled();
  });

  it("resolves an admin-configured OpenAI provider from the database", async () => {
    loadProviderConfigsMock.mockResolvedValue(
      makeConfigMap(makeConfig("openai", { apiKey: "sk-db" })),
    );

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.provider).toBe("openai");
      expect(result.config.apiKey).toBe("sk-db");
      expect(result.config.baseUrl).toBe("https://api.openai.com/v1");
      expect(result.config.model).toBe("gpt-5.4-mini");
      expect(typeof result.config.seed).toBe("number");
    }
  });

  it("registers OPENAI_API_KEY as the openai fallback credential when no DB key exists", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env");
    loadProviderConfigsMock.mockResolvedValue(new Map());

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.provider).toBe("openai");
      expect(result.config.apiKey).toBe("sk-env");
    }
  });

  it("returns 503 when no provider is configured at all", async () => {
    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(503);
      expect(result.reason).toContain("not configured");
    }
  });

  it("honours admin routing tiers across OpenAI-compatible providers", async () => {
    const { PROVIDER_MODELS } = await import("@/lib/ai/models");
    loadProviderConfigsMock.mockResolvedValue(
      makeConfigMap(
        makeConfig("openai", { routingTier: 1 as RoutingTier }),
        makeConfig("groq", { routingTier: 3 as RoutingTier }),
      ),
    );

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.provider).toBe("groq");
      expect(result.config.baseUrl).toBe("https://api.groq.com/openai/v1");
      expect(result.config.model).toBe(PROVIDER_MODELS.groq.model);
    }
  });

  it("skips providers that are not OpenAI-wire-compatible (anthropic stays router-only)", async () => {
    loadProviderConfigsMock.mockResolvedValue(
      makeConfigMap(
        makeConfig("anthropic", { routingTier: 3 as RoutingTier }),
        makeConfig("openai", { routingTier: 0 as RoutingTier }),
      ),
    );

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.provider).toBe("openai");
    }
  });

  it("respects budget ceilings and falls back to Workers AI", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc-123");
    vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "cf-token");
    loadProviderConfigsMock.mockResolvedValue(
      makeConfigMap(makeConfig("openai", { monthlyBudgetCents: 1000, costThisMonthCents: 1000 })),
    );

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.provider).toBe("workers_ai");
      expect(result.config.apiKey).toBe("cf-token");
      expect(result.config.baseUrl).toBe(
        "https://api.cloudflare.com/client/v4/accounts/acc-123/ai/v1",
      );
      expect(result.config.model).toBe("@cf/meta/llama-3.1-8b-instruct");
    }
  });

  it("skips providers under a persisted rate-limit cooldown", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc-123");
    vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "cf-token");
    loadProviderConfigsMock.mockResolvedValue(
      makeConfigMap(makeConfig("openai", { rateLimitedUntil: Date.now() + 60_000 })),
    );

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.provider).toBe("workers_ai");
    }
  });

  it("auto-resolves a deprecated OPENAI_MODEL pin to its replacement (Task A2)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env");
    // Previously-valid dated snapshot, superseded in the A2 registry refresh.
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini-2024-07-18");

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.model).toBe("gpt-5.4-mini");
    }
    const { logger } = await import("@/lib/logger");
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      "Deprecated AI model auto-resolved to its replacement",
      expect.objectContaining({ original: "gpt-4o-mini-2024-07-18", model: "gpt-5.4-mini" }),
    );
  });

  it("rejects an OPENAI_MODEL override that is not in the allowlist (W8-S-03)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini"); // floating alias — must be rejected

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(500);
      expect(result.reason).toBe("AI model configuration error");
    }
  });

  it("rejects an OPENAI_BASE_URL override outside the allowlist (F-AI-05)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env");
    vi.stubEnv("OPENAI_BASE_URL", "https://evil.example.com/v1");

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(500);
      expect(result.reason).toBe("AI service configuration error");
    }
  });

  it("falls back to the env credential when the database load fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env");
    loadProviderConfigsMock.mockRejectedValue(new Error("db down"));

    const { resolveAIConfig } = await import("@/lib/ai/config");
    const result = await resolveAIConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.provider).toBe("openai");
      expect(result.config.apiKey).toBe("sk-env");
    }
  });

  it("does not mutate the router's shared config cache when overlaying the env fallback", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env");
    const shared = new Map<AIProvider, ProviderConfig>();
    loadProviderConfigsMock.mockResolvedValue(shared);

    const { resolveAIConfig } = await import("@/lib/ai/config");
    await resolveAIConfig();

    expect(shared.size).toBe(0);
  });
});

describe("ALLOWED_MODELS (single registry)", () => {
  it("contains every provider default model", async () => {
    const { ALLOWED_MODELS, PROVIDER_MODELS } = await import("@/lib/ai/models");
    for (const config of Object.values(PROVIDER_MODELS)) {
      expect(ALLOWED_MODELS.has(config.model)).toBe(true);
    }
  });

  it("contains the explicitly pinned operator-selectable IDs", async () => {
    const { ALLOWED_MODELS } = await import("@/lib/ai/models");
    for (const id of ["gpt-5.5", "gpt-5.4", "gpt-5.4-nano", "@cf/meta/llama-3.1-8b-instruct"]) {
      expect(ALLOWED_MODELS.has(id)).toBe(true);
    }
  });

  it("no longer allowlists retired snapshot IDs directly (Task A2)", async () => {
    const { ALLOWED_MODELS } = await import("@/lib/ai/models");
    for (const id of ["gpt-4o-mini-2024-07-18", "gpt-4o-2024-08-06", "gpt-4o-2024-11-20"]) {
      expect(ALLOWED_MODELS.has(id)).toBe(false);
    }
  });
});
