import {
  CopilotRuntime,
  AnthropicAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest, NextResponse } from "next/server";
import { getAnthropicApiKey } from "@/lib/env";
import { createClient } from "@/lib/supabase-server";

// CF-BUNDLE-03: Do NOT statically `import Anthropic from "@anthropic-ai/sdk"`.
// @copilotkit/runtime's AnthropicAdapter lazy-loads the SDK via __require()
// inside ensureAnthropic(). A static import would bundle the entire 6 MB SDK
// into the Worker. Letting the adapter construct its own client keeps it out
// of the static graph; esbuild treats __require as a runtime call.
//
// Validate the env var at module init (fail fast on cold start) — the SDK
// constructor will then read process.env.ANTHROPIC_API_KEY at request time.
const apiKey = getAnthropicApiKey();
if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY is required for the CopilotKit route. " +
      "Set it as a Cloudflare Worker secret before deploying.",
  );
}

const serviceAdapter = new AnthropicAdapter();

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // nosemgrep: semgrep.tenant-scoping -- super_admin users have no clinic_id;
  // this verifies the calling user's own role, scoped by their auth UID.
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();

  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const runtime = new CopilotRuntime({
    middleware: {
      onBeforeRequest: async ({ properties }) => {
        return { ...properties, userId: user.id, userEmail: user.email };
      },
    },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
}
