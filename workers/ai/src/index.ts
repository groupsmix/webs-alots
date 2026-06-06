/**
 * webs-alots-ai — AI route Worker entry point.
 *
 * This is the entry for the SECOND Cloudflare Worker of the Oltigo Health
 * platform. It receives requests routed to it by the zone-level Worker Routes
 * configured in wrangler.toml:
 *
 *   oltigo.com/api/copilotkit/*       → handleCopilotKit
 *   oltigo.com/api/builder/sandbox/*  → handleBuilderSandbox
 *
 * Anything else returns 404 — this Worker should never see other paths.
 *
 * Why a separate Worker? See workers/ai/README.md.
 */

import { handleBuilderSandbox } from "./handlers/builder-sandbox";
import { handleCopilotKit } from "./handlers/copilotkit";
import { jsonResponse, type Env } from "./lib/supabase";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Method guard: both routes are POST-only (matches the original Next.js
    // route handlers which only exported `export async function POST`).
    if (request.method !== "POST") {
      // Allow OPTIONS for CORS preflight if a client decides to send one.
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": url.origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
            "Access-Control-Allow-Credentials": "true",
          },
        });
      }
      return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST" });
    }

    try {
      if (path === "/api/copilotkit" || path.startsWith("/api/copilotkit/")) {
        return await handleCopilotKit(request, env);
      }
      if (path === "/api/builder/sandbox" || path.startsWith("/api/builder/sandbox/")) {
        return await handleBuilderSandbox(request, env);
      }
      return jsonResponse({ error: "Not Found" }, 404);
    } catch (err) {
      console.error("[webs-alots-ai] unhandled error", err);
      return jsonResponse({ error: "Internal Server Error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
