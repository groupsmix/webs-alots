/**
 * AI Builder sandbox handler.
 *
 * Moved from src/app/api/builder/sandbox/route.ts (main Next.js app) to
 * this standalone Worker. Streams Claude output back to the browser.
 *
 * Why dynamic imports? See workers/ai/src/handlers/copilotkit.ts header.
 * Heavy AI deps (ai SDK, @ai-sdk/anthropic) are loaded inside the handler
 * to avoid global-scope I/O / random ops that Cloudflare Workers prohibit
 * at module load.
 *
 * ── Message format (AI SDK v6) ────────────────────────────────────────
 * The client (src/components/builder/builder-chat.tsx) is on AI SDK v6 and
 * sends UIMessages (a `parts` array), NOT the legacy { role, content }
 * shape. We validate the UIMessage envelope with zod, then convert to
 * ModelMessages via convertToModelMessages() before handing them to
 * streamText. The previous handler required `content: string` and rejected
 * every v6 request with a 400 — see PR that introduced this comment.
 *
 * ── E2B ───────────────────────────────────────────────────────────────
 * The generated code is rendered client-side (sandbox-preview.tsx builds a
 * blob-URL iframe with Babel standalone). The earlier handler created an
 * E2B sandbox per request and immediately killed it without ever executing
 * anything — pure quota + latency waste. That has been removed. To add real
 * server-side execution later, re-introduce `@e2b/code-interpreter` here and
 * run the extracted code block inside the sandbox before streaming results.
 */

import type { UIMessage } from "ai";
import { z } from "zod";
import { requireSuperAdmin, jsonResponse, type Env } from "../lib/supabase";

// Allowlist of model IDs the builder may use. Keep in sync with
// src/lib/builder/models.ts (BUILDER_MODELS) in the main app. A strict
// enum prevents arbitrary model strings being forwarded to the Anthropic
// API. The default mirrors DEFAULT_MODEL there.
const BUILDER_MODEL_IDS = ["claude-sonnet-4-6", "claude-opus-4-8"] as const;

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
  modelId: z.enum(BUILDER_MODEL_IDS).default("claude-sonnet-4-6"),
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

export async function handleBuilderSandbox(request: Request, env: Env): Promise<Response> {
  try {
    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: "ANTHROPIC_API_KEY is not configured on webs-alots-ai" }, 500);
    }

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
    const { messages, modelId, templateId } = parsed.data;

    // Dynamic imports — see header comment.
    const [{ createAnthropic }, { streamText, convertToModelMessages }] = await Promise.all([
      import("@ai-sdk/anthropic"),
      import("ai"),
    ]);

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

    // Bind the provider to the Worker secret explicitly rather than relying
    // on process.env mirroring inside the Workers runtime.
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

    // Fire-and-forget usage log — builder_usage_logs is a platform-level
    // audit table (no clinic_id column) accessed only by super_admin.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any).from("builder_usage_logs").insert({
      user_id: userId,
      template_id: templateId,
      model_id: modelId,
      message_count: messages.length,
      created_at: new Date().toISOString(),
    });

    const result = streamText({
      model: anthropic(modelId),
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
