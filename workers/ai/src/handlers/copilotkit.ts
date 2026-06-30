/**
 * CopilotKit runtime handler.
 *
 * Moved from src/app/api/copilotkit/route.ts (main Next.js app) to this
 * standalone Worker so its heavy server-side deps no longer count against
 * the main Worker's 10 MiB limit.
 *
 * Why dynamic imports?
 *   @copilotkit/runtime imports @copilotkit/shared at the top level, which
 *   constructs a TelemetryClient. That constructor calls uuidv4(), which
 *   calls crypto.getRandomValues(). Cloudflare Workers DISALLOW random
 *   number generation (and most other I/O) during the initial global-scope
 *   evaluation of a script — only handlers may use them. By deferring the
 *   import to first-request time, the telemetry init runs inside the
 *   handler, where crypto operations are permitted.
 *
 *   We cache the loaded module + adapter in module-scope variables so the
 *   import cost is paid once per isolate, not per request.
 *
 *   NOTE: the `import type` below and the `typeof import(...)` alias are both
 *   fully erased at build time (they emit NO runtime require), so they restore
 *   type-safety without re-introducing the top-level evaluation problem above.
 */

import type { CopilotServiceAdapter } from "@copilotkit/runtime";
import type OpenAIClient from "openai";

import { requireSuperAdmin, jsonResponse, type Env } from "../lib/supabase";
import { checkRateLimit } from "../lib/rate-limit";

type RuntimeModule = typeof import("@copilotkit/runtime");

let cachedRuntimeModule: RuntimeModule | null = null;
let cachedServiceAdapter: CopilotServiceAdapter | null = null;

async function loadRuntime(
  env: Env,
): Promise<{ runtimeModule: RuntimeModule; serviceAdapter: CopilotServiceAdapter }> {
  if (cachedRuntimeModule && cachedServiceAdapter) {
    return { runtimeModule: cachedRuntimeModule, serviceAdapter: cachedServiceAdapter };
  }
  // Dynamic import — see header comment.
  const runtimeModule = await import("@copilotkit/runtime");

  // Provider selection (handler guard guarantees at least one key is set):
  //   • OPENAI_API_KEY → OpenAI-compatible adapter. Works with ANY
  //     OpenAI-compatible endpoint via OPENAI_BASE_URL (e.g. mimo, OpenAI,
  //     groq). OPENAI_MODEL selects the model id.
  //   • else ANTHROPIC_API_KEY → original Anthropic adapter.
  let serviceAdapter: CopilotServiceAdapter;
  if (env.OPENAI_API_KEY) {
    const { default: OpenAI } = await import("openai");
    const openai: OpenAIClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      ...(env.OPENAI_BASE_URL ? { baseURL: env.OPENAI_BASE_URL } : {}),
    });
    serviceAdapter = new runtimeModule.OpenAIAdapter({
      openai,
      ...(env.OPENAI_MODEL ? { model: env.OPENAI_MODEL } : {}),
    });
  } else {
    serviceAdapter = new runtimeModule.AnthropicAdapter();
  }

  cachedRuntimeModule = runtimeModule;
  cachedServiceAdapter = serviceAdapter;
  return { runtimeModule, serviceAdapter };
}

export async function handleCopilotKit(request: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY) {
    return jsonResponse(
      {
        error:
          "No AI provider configured on webs-alots-ai (set OPENAI_API_KEY [+ OPENAI_BASE_URL/OPENAI_MODEL] or ANTHROPIC_API_KEY)",
      },
      500,
    );
  }

  const authResult = await requireSuperAdmin(request, env);
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult;

  // Defense-in-depth: cap how fast a single super_admin session can drive the
  // upstream AI provider. See lib/rate-limit.ts for the per-isolate caveat.
  const limit = checkRateLimit(`copilotkit:${userId}`);
  if (!limit.allowed) {
    return jsonResponse({ error: "Too Many Requests" }, 429, {
      "Retry-After": String(limit.retryAfterSec),
    });
  }

  const { runtimeModule, serviceAdapter } = await loadRuntime(env);
  const { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } = runtimeModule;

  // NOTE: we intentionally do NOT use CopilotRuntime's `middleware.onBeforeRequest`
  // to inject the caller identity. In @copilotkit/runtime@1.59.5 that hook is
  // deprecated, the runtime IGNORES its return value, and the `properties` it
  // receives is a throwaway copy of the request body — so per-user context
  // injected there does not reach server actions. Access control for this
  // endpoint is enforced upstream by requireSuperAdmin(); there are currently
  // no server-side actions that consume the caller identity.
  const runtime = new CopilotRuntime();

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  // copilotRuntimeNextJSAppRouterEndpoint returns a Web-API-compatible
  // handler. NextRequest is a strict superset of Request, so a plain
  // Request works at runtime even though the type signature is narrower.
  return handleRequest(request as unknown as Parameters<typeof handleRequest>[0]);
}
