import Anthropic from "@anthropic-ai/sdk";
import {
  CopilotRuntime,
  AnthropicAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest, NextResponse } from "next/server";
import { getAnthropicApiKey } from "@/lib/env";
import { createClient } from "@/lib/supabase-server";

// nosemgrep: semgrep.env-access -- read via centralized getter from @/lib/env
const anthropicClient = new Anthropic({ apiKey: getAnthropicApiKey()! });
const serviceAdapter = new AnthropicAdapter({ anthropic: anthropicClient });

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
