import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAllowedBaseUrl, getAIConfig } from "../ai/openai";

// ── Mock dependencies ────────────────────────────────────────────────

vi.mock("@/lib/features", () => ({
  isAIEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// We need the mock for apiError to return a NextResponse-compatible object
vi.mock("@/lib/api-response", () => ({
  apiError: vi.fn((message: string, status: number, code?: string) => {
    const body = JSON.stringify({ ok: false, error: message, code });
    const resp = new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    });
    // Add NextResponse-specific props so TS is happy at runtime
    Object.assign(resp, { cookies: { getAll: () => [] }, [Symbol.for("INTERNALS")]: {} });
    return resp;
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("isAllowedBaseUrl", () => {
  it("allows default OpenAI URL", () => {
    expect(isAllowedBaseUrl("https://api.openai.com/v1")).toBe(true);
  });

  it("allows OpenAI base without path", () => {
    expect(isAllowedBaseUrl("https://api.openai.com")).toBe(true);
  });

  it("allows Azure OpenAI URL", () => {
    expect(isAllowedBaseUrl("https://oai.azure.com/openai/deployments/gpt-4")).toBe(true);
  });

  it("allows Cloudflare AI gateway URL", () => {
    expect(isAllowedBaseUrl("https://gateway.ai.cloudflare.com/v1/account/gateway/openai")).toBe(true);
  });

  it("allows Cloudflare API URL", () => {
    expect(isAllowedBaseUrl("https://api.cloudflare.com/client/v4/accounts/123/ai")).toBe(true);
  });

  it("blocks attacker-controlled URLs", () => {
    expect(isAllowedBaseUrl("https://evil.com/proxy")).toBe(false);
  });

  it("blocks similar-looking domains (prefix attack)", () => {
    expect(isAllowedBaseUrl("https://api.openai.com.evil.com/v1")).toBe(false);
  });

  it("blocks HTTP URLs", () => {
    expect(isAllowedBaseUrl("http://api.openai.com/v1")).toBe(false);
  });

  it("blocks empty string", () => {
    expect(isAllowedBaseUrl("")).toBe(false);
  });

  it("respects OPENAI_BASE_URL_ALLOWLIST env var", () => {
    const original = process.env.OPENAI_BASE_URL_ALLOWLIST;
    process.env.OPENAI_BASE_URL_ALLOWLIST = "https://custom-proxy.example.com";
    try {
      expect(isAllowedBaseUrl("https://custom-proxy.example.com/v1")).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.OPENAI_BASE_URL_ALLOWLIST;
      } else {
        process.env.OPENAI_BASE_URL_ALLOWLIST = original;
      }
    }
  });

  it("ignores non-HTTPS entries in OPENAI_BASE_URL_ALLOWLIST", () => {
    const original = process.env.OPENAI_BASE_URL_ALLOWLIST;
    process.env.OPENAI_BASE_URL_ALLOWLIST = "http://insecure.com,https://secure.com";
    try {
      expect(isAllowedBaseUrl("http://insecure.com/v1")).toBe(false);
      expect(isAllowedBaseUrl("https://secure.com/v1")).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.OPENAI_BASE_URL_ALLOWLIST;
      } else {
        process.env.OPENAI_BASE_URL_ALLOWLIST = original;
      }
    }
  });
});

describe("getAIConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset to known state
    process.env.OPENAI_API_KEY = "sk-test-key-123";
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_BASE_URL_ALLOWLIST;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns config with default base URL and pinned model", async () => {
    const result = await getAIConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.apiKey).toBe("sk-test-key-123");
      expect(result.config.baseUrl).toBe("https://api.openai.com/v1");
      // Model should be pinned to a dated snapshot, not the bare alias
      expect(result.config.model).toContain("gpt-4o-mini-");
      expect(result.config.model).toMatch(/gpt-4o-mini-\d{4}-\d{2}-\d{2}/);
    }
  });

  it("returns disabled error when kill switch is off", async () => {
    const { isAIEnabled } = await import("@/lib/features");
    vi.mocked(isAIEnabled).mockResolvedValueOnce(false);

    const result = await getAIConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("disabled");
    }
  });

  it("returns not_configured error when API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await getAIConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not_configured");
    }
  });

  it("returns egress_blocked error when base URL is not allowed", async () => {
    process.env.OPENAI_BASE_URL = "https://evil-proxy.com/v1";

    const result = await getAIConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("egress_blocked");
    }
  });

  it("uses custom OPENAI_MODEL when set", async () => {
    process.env.OPENAI_MODEL = "gpt-4o-2024-08-06";

    const result = await getAIConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.model).toBe("gpt-4o-2024-08-06");
    }
  });

  it("allows custom OPENAI_BASE_URL when on allowlist", async () => {
    process.env.OPENAI_BASE_URL = "https://gateway.ai.cloudflare.com/v1/account/gw/openai";

    const result = await getAIConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.baseUrl).toBe("https://gateway.ai.cloudflare.com/v1/account/gw/openai");
    }
  });
});
