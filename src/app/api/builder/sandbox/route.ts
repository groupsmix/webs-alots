import { anthropic } from "@ai-sdk/anthropic";
import { Sandbox } from "@e2b/code-interpreter";
import { streamText } from "ai";
import type { ModelMessage } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getE2bApiKey } from "@/lib/env";
import { createClient } from "@/lib/supabase-server";

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

// WARNING: This in-memory map does NOT survive across Cloudflare Worker isolates.
// For soft rate limiting on a single super_admin user this is acceptable.
// For true multi-isolate consistency, move to RATE_LIMIT_KV which already
// exists in wrangler.toml.
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

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // nosemgrep: semgrep.tenant-scoping -- super_admin users have no clinic_id;
    // this query fetches the calling user's own role, scoped by their auth UID.
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: super_admin only" }, { status: 403 });
    }

    const { allowed, remaining } = checkRateLimit(user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 20 builder requests per hour." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "Retry-After": "3600",
          },
        },
      );
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { messages, modelId } = parsed.data;

    const sandbox = await Sandbox.create("base", {
      // nosemgrep: semgrep.env-access -- read via centralized getter
      apiKey: getE2bApiKey()!,
      timeoutMs: 120_000,
    });

    // Fire-and-forget usage log — table added in migration 00154.
    // nosemgrep: semgrep.tenant-scoping -- builder_usage_logs is a
    // platform-level audit table with no clinic_id column (super_admin only).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any).from("builder_usage_logs").insert({
      user_id: user.id,
      template_id: parsed.data.templateId,
      model_id: modelId,
      message_count: messages.length,
      created_at: new Date().toISOString(),
    });

    void remaining; // available for response headers in future

    const result = streamText({
      model: anthropic(modelId as "claude-sonnet-4-20250514"),
      system: SYSTEM_PROMPT,
      messages: messages as ModelMessage[],
      maxOutputTokens: 8192,
      onFinish: async () => {
        try {
          await sandbox.kill();
        } catch {}
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[builder/sandbox] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
