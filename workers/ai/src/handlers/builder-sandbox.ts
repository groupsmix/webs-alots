/**
 * AI Builder sandbox handler.
 *
 * Moved from src/app/api/builder/sandbox/route.ts (main Next.js app) to
 * this standalone Worker. Streams Claude output back to the browser and
 * spins up an E2B sandbox for code execution.
 *
 * Why dynamic imports? See workers/ai/src/handlers/copilotkit.ts header.
 * Heavy AI deps (ai SDK, @ai-sdk/anthropic, @e2b/code-interpreter) are
 * loaded inside the handler to avoid global-scope I/O / random ops that
 * Cloudflare Workers prohibit at module load.
 */

import { z } from "zod";
import { requireSuperAdmin, jsonResponse, type Env } from "../lib/supabase";

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  templateId: z.string().default("nextjs-report"),
  modelId: z.string().default("claude-sonnet-4-20250514"),
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
    if (!env.E2B_API_KEY) {
      return jsonResponse({ error: "E2B_API_KEY is not configured on webs-alots-ai" }, 500);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: "ANTHROPIC_API_KEY is not configured on webs-alots-ai" }, 500);
    }

    const authResult = await requireSuperAdmin(request, env);
    if (!authResult.ok) return authResult.response;
    const { userId, supabase } = authResult;

    const { allowed, remaining } = checkRateLimit(userId);
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
    const [{ anthropic }, { Sandbox }, { streamText }] = await Promise.all([
      import("@ai-sdk/anthropic"),
      import("@e2b/code-interpreter"),
      import("ai"),
    ]);

    const sandbox = await Sandbox.create("base", {
      apiKey: env.E2B_API_KEY,
      timeoutMs: 120_000,
    });

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

    void remaining; // available for response headers in future

    const result = streamText({
      model: anthropic(modelId as "claude-sonnet-4-20250514"),
      system: SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      maxOutputTokens: 8192,
      onFinish: async () => {
        try {
          await sandbox.kill();
        } catch {
          // sandbox already terminated
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[builder/sandbox] Error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}
