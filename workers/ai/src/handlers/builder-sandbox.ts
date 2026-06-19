/**
 * AI Builder sandbox handler.
 *
 * Moved from src/app/api/builder/sandbox/route.ts (main Next.js app) to
 * this standalone Worker. Streams model output back to the browser.
 *
 * Why dynamic imports? See workers/ai/src/handlers/copilotkit.ts header.
 * Heavy AI deps (ai SDK, @ai-sdk/* providers) are loaded inside the handler
 * to avoid global-scope I/O / random ops that Cloudflare Workers prohibit
 * at module load, and so only the selected provider's adapter is pulled in.
 *
 * ── Multi-provider, dashboard-managed ─────────────────────────────────────
 * The builder no longer hard-codes a single model. The main app's builder
 * page derives the model picker from the **active** providers in
 * `ai_provider_configs` (managed from /admin/ai-config) and sends both the
 * chosen `provider` and `modelId` with each request. This handler routes to
 * that provider using ITS OWN per-provider secret (GROQ_API_KEY,
 * ANTHROPIC_API_KEY, …) — no platform key material (PHI-grade encrypted keys)
 * is touched here. A provider the worker has no secret for returns a clear
 * 503 so the operator knows exactly which secret to add.
 *
 * Keep `BUILDER_PROVIDERS` below in sync with `BUILDER_SUPPORTED_PROVIDERS`
 * and `PROVIDER_MODELS` in the main app (src/lib/builder/models.server.ts,
 * src/lib/ai/models.ts). The two codebases can't import each other (separate
 * Workers / bundles), so the canonical model per provider is mirrored here.
 *
 * ── Message format (AI SDK v6) ────────────────────────────────────────────
 * The client (src/components/builder/builder-chat.tsx) sends UIMessages (a
 * `parts` array), NOT the legacy { role, content } shape. We validate the
 * UIMessage envelope with zod, then convert to ModelMessages via
 * convertToModelMessages() before handing them to streamText.
 *
 * ── E2B ───────────────────────────────────────────────────────────────────
 * The generated code is rendered client-side (sandbox-preview.tsx builds a
 * blob-URL iframe with Babel standalone). No server-side sandbox is created.
 */

import type { UIMessage } from "ai";
import { z } from "zod";
import { requireSuperAdmin, jsonResponse, type Env } from "../lib/supabase";

/** Providers the builder can route to, each with its own Worker secret. */
type BuilderProvider = "groq" | "anthropic" | "google" | "openai" | "deepseek" | "mistral" | "xai";

interface ProviderConfig {
  /** Env key holding this provider's API key on the AI Worker. */
  secretEnv:
    | "GROQ_API_KEY"
    | "ANTHROPIC_API_KEY"
    | "GOOGLE_GENERATIVE_AI_API_KEY"
    | "OPENAI_API_KEY"
    | "DEEPSEEK_API_KEY"
    | "MISTRAL_API_KEY"
    | "XAI_API_KEY";
  /** Canonical model id — mirrors PROVIDER_MODELS in the main app. */
  defaultModel: string;
  /** Native AI-SDK adapter, or an OpenAI-compatible endpoint. */
  kind: "native" | "compat";
  /** Base URL for `compat` providers (OpenAI-compatible REST surface). */
  baseURL?: string;
}

const BUILDER_PROVIDERS: Record<BuilderProvider, ProviderConfig> = {
  groq: { secretEnv: "GROQ_API_KEY", defaultModel: "llama-3.3-70b-versatile", kind: "native" },
  anthropic: {
    secretEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-6",
    kind: "native",
  },
  google: {
    secretEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-3.5-flash",
    kind: "native",
  },
  openai: { secretEnv: "OPENAI_API_KEY", defaultModel: "gpt-5.4-mini", kind: "native" },
  deepseek: {
    secretEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-v4-flash",
    kind: "compat",
    baseURL: "https://api.deepseek.com",
  },
  mistral: {
    secretEnv: "MISTRAL_API_KEY",
    defaultModel: "mistral-small-2603",
    kind: "compat",
    baseURL: "https://api.mistral.ai/v1",
  },
  xai: {
    secretEnv: "XAI_API_KEY",
    defaultModel: "grok-4.3",
    kind: "compat",
    baseURL: "https://api.x.ai/v1",
  },
};

const SUPPORTED_PROVIDERS = Object.keys(BUILDER_PROVIDERS) as BuilderProvider[];

function isBuilderProvider(value: string): value is BuilderProvider {
  return (SUPPORTED_PROVIDERS as string[]).includes(value);
}

// Lenient UIMessage part: we only consume text parts, but allow other
// declared fields so future part kinds don't hard-fail validation.
const uiMessagePartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
});

const uiMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(uiMessagePartSchema),
});

const requestSchema = z.object({
  messages: z.array(uiMessageSchema).min(1),
  templateId: z.string().default("nextjs-report"),
  // Which managed provider to route to (defaults to groq for legacy clients).
  provider: z.string().optional(),
  // The model id the picker showed. Generation is pinned to the provider's
  // canonical model below; an arbitrary string never reaches the provider.
  modelId: z.string().optional(),
});

// WARNING: This in-memory map does NOT survive across Cloudflare Worker
// isolates. For soft rate limiting on a single super_admin user this is
// acceptable. For true multi-isolate consistency, move to a KV namespace.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 20;

  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}

const SYSTEM_PROMPT = `You are an expert developer assistant embedded in a Moroccan health SaaS platform (doctors, dentists, pharmacies).
You help the super admin build internal tools, reports, and utilities.

RULES:
- Always produce complete, runnable code. No placeholders, no TODOs.
- For Next.js apps: use shadcn/ui components, Tailwind CSS, TypeScript.
- For Python scripts: use standard library + pandas/matplotlib when needed.
- When generating a Next.js component, always export it as default.
- Add realistic mock data shaped like the real domain: clinics, appointments (in MAD currency), patients, doctors.
- Keep output under 200 lines unless explicitly asked for more.
- Never include secrets, API keys, or real credentials in generated code.
- Always add error handling.

DOMAIN CONTEXT:
- Currency: MAD (Moroccan Dirham)
- Languages in use: French, Arabic (Darija), sometimes English
- User types: super_admin, clinic_admin, receptionist, doctor, patient
- Payments: CMI gateway (Moroccan Interbank)
- Notifications: WhatsApp Business API with Darija templates`;

/**
 * Build an AI-SDK language model for the chosen provider, bound to the
 * Worker's per-provider secret. `native` providers use their dedicated
 * adapter; `compat` providers go through the OpenAI-compatible adapter with
 * the provider's REST base URL. Returns `unknown` because each adapter has a
 * distinct nominal type; streamText accepts any LanguageModel.
 */
async function buildModel(
  provider: BuilderProvider,
  config: ProviderConfig,
  apiKey: string,
  model: string,
): Promise<unknown> {
  if (config.kind === "compat") {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return createOpenAICompatible({ name: provider, apiKey, baseURL: config.baseURL ?? "" })(model);
  }

  switch (provider) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey })(model);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey })(model);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey })(model);
    }
    default: {
      // groq (the only remaining native provider)
      const { createGroq } = await import("@ai-sdk/groq");
      return createGroq({ apiKey })(model);
    }
  }
}

export async function handleBuilderSandbox(request: Request, env: Env): Promise<Response> {
  try {
    const authResult = await requireSuperAdmin(request, env);
    if (!authResult.ok) return authResult.response;
    const { userId, supabase } = authResult;

    const { allowed } = checkRateLimit(userId);
    if (!allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Max 20 builder requests per hour." },
        429,
        {
          "X-RateLimit-Remaining": "0",
          "Retry-After": "3600",
        },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    }
    const { messages, templateId } = parsed.data;

    // ── Resolve the managed provider + its Worker secret ──────────────────
    const requestedProvider = parsed.data.provider ?? "groq";
    if (!isBuilderProvider(requestedProvider)) {
      return jsonResponse(
        {
          error: `Unsupported provider "${requestedProvider}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}.`,
        },
        400,
      );
    }
    const providerConfig = BUILDER_PROVIDERS[requestedProvider];
    const apiKey = env[providerConfig.secretEnv];
    if (!apiKey) {
      return jsonResponse(
        {
          error: `Provider "${requestedProvider}" is active in the dashboard but ${providerConfig.secretEnv} is not configured on the webs-alots-ai Worker. Add it with: wrangler secret put ${providerConfig.secretEnv}`,
        },
        503,
      );
    }

    // Generation is pinned to the provider's canonical model. The client's
    // modelId should already equal this (the picker shows one model per
    // provider); we never forward an arbitrary model string to the provider.
    const model = providerConfig.defaultModel;
    if (parsed.data.modelId && parsed.data.modelId !== model) {
      console.warn(
        `[builder/sandbox] modelId "${parsed.data.modelId}" != canonical "${model}" for ${requestedProvider}; using canonical.`,
      );
    }

    // Dynamic imports — see header comment. Only the selected provider's
    // adapter is loaded.
    const { streamText, convertToModelMessages } = await import("ai");

    // Convert the v6 UIMessages (parts) to ModelMessages. The zod schema
    // above already guarantees the { role, parts[].text } runtime shape
    // convertToModelMessages needs; the cast bridges zod's inferred type
    // to the SDK's discriminated-union UIMessage type.
    let modelMessages;
    try {
      modelMessages = await convertToModelMessages(messages as unknown as UIMessage[]);
    } catch (err) {
      console.error("[builder/sandbox] convertToModelMessages failed:", err);
      return jsonResponse({ error: "Could not parse messages" }, 400);
    }

    const languageModel = await buildModel(requestedProvider, providerConfig, apiKey, model);

    // Fire-and-forget usage log — builder_usage_logs is a platform-level
    // audit table (no clinic_id column) accessed only by super_admin.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any).from("builder_usage_logs").insert({
      user_id: userId,
      template_id: templateId,
      model_id: `${requestedProvider}:${model}`,
      message_count: messages.length,
      created_at: new Date().toISOString(),
    });

    const result = streamText({
      // Each adapter returns its own nominal model type; streamText accepts
      // any LanguageModel. The buildModel() return is intentionally `unknown`.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: languageModel as any,
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      maxOutputTokens: 8192,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[builder/sandbox] Error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}
