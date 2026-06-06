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
 */

import { requireSuperAdmin, jsonResponse, type Env } from "../lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedRuntimeModule: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedServiceAdapter: any = null;

async function loadRuntime() {
  if (cachedRuntimeModule) {
    return { runtimeModule: cachedRuntimeModule, serviceAdapter: cachedServiceAdapter };
  }
  // Dynamic import — see header comment.
  const runtimeModule = await import("@copilotkit/runtime");
  const serviceAdapter = new runtimeModule.AnthropicAdapter();
  cachedRuntimeModule = runtimeModule;
  cachedServiceAdapter = serviceAdapter;
  return { runtimeModule, serviceAdapter };
}

export async function handleCopilotKit(request: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY is not configured on webs-alots-ai" }, 500);
  }

  const authResult = await requireSuperAdmin(request, env);
  if (!authResult.ok) return authResult.response;
  const { userId, userEmail } = authResult;

  const { runtimeModule, serviceAdapter } = await loadRuntime();
  const { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } = runtimeModule;

  const runtime = new CopilotRuntime({
    middleware: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onBeforeRequest: async ({ properties }: { properties: Record<string, any> }) => {
        return { ...properties, userId, userEmail };
      },
    },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  // copilotRuntimeNextJSAppRouterEndpoint returns a Web-API-compatible
  // handler. NextRequest is a strict superset of Request, so a plain
  // Request works at runtime even though the type signature is narrower.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handleRequest(request as any);
}
