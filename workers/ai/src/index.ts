/**
 * webs-alots-ai — AI route Worker entry point.
 *
 * This is the entry for the SECOND Cloudflare Worker of the Oltigo Health
 * platform. It receives requests routed to it by the zone-level Worker Routes
 * configured in wrangler.toml:
 *
 *   oltigo.com/api/copilotkit/*       → handleCopilotKit
 *
 * Anything else returns 404 — this Worker should never see other paths.
 *
 * Why a separate Worker? See workers/ai/README.md.
 */

import { handleCopilotKit } from "./handlers/copilotkit";
import { withCors } from "./lib/cors";
import { logger } from "./lib/logger";
import { jsonResponse, type Env } from "./lib/supabase";

/**
 * Core routing. CORS is applied centrally by the fetch() wrapper below, so
 * route handlers never have to think about it (the previous version only
 * added CORS to the preflight + error paths, never the success stream).
 */
async function route(request: Request, env: Env): Promise<Response> {
  // L-3: Kill-switch. Set COPILOTKIT_ENABLED=false (wrangler secret) to
  // dark the endpoint without removing routes or redeploying. Unset or
  // any value other than "false" keeps the endpoint active.
  if (env.COPILOTKIT_ENABLED === "false") {
    return jsonResponse({ error: "Not Found" }, 404);
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Method guard: the route is POST-only (matches the original Next.js route
  // handler which only exported `export async function POST`).
  if (request.method !== "POST") {
    // Allow OPTIONS for CORS preflight. withCors() attaches the actual
    // Access-Control-* headers when the Origin is allowed.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST, OPTIONS" });
  }

  if (path === "/api/copilotkit" || path.startsWith("/api/copilotkit/")) {
    return await handleCopilotKit(request, env);
  }
  return jsonResponse({ error: "Not Found" }, 404);
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      const response = await route(request, env);
      return withCors(response, request);
    } catch (err) {
      logger.error("[webs-alots-ai] unhandled error", {
        err: err instanceof Error ? err.message : String(err),
      });
      return withCors(jsonResponse({ error: "Internal Server Error" }, 500), request);
    }
  },
} satisfies ExportedHandler<Env>;
