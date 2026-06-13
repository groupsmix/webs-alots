"use client";

// @ts-nocheck  — CopilotKit feature disabled (hotfix 2026-06-06), dead code kept for re-enablement path. See copilot-shell.tsx ADR.

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

// CF-BUNDLE-02: Defer the entire CopilotKit subsystem to a client-only
// dynamic import. @copilotkit/react-core depends transitively on
// streamdown (mermaid ~7 MB + shiki ~10 MB), which used to be statically
// bundled into the SSR pass and pushed the Cloudflare Worker over the
// 10 MiB compressed limit. With ssr: false the provider chunk is fetched
// by the browser after first paint and never enters the Worker bundle.
const CopilotProvider = dynamic(() => import("./copilot-provider").then((m) => m.CopilotProvider), {
  ssr: false,
});

/**
 * CopilotShell — hydration-safe wrapper around CopilotProvider.
 *
 * Renders children as-is during SSR and the first client paint, then
 * mounts the heavy CopilotKit context after hydration. Two benefits:
 *
 * 1. Bundle: the static import graph from the server build never reaches
 *    @copilotkit/react-core, so streamdown/mermaid/shiki are excluded.
 * 2. SSR perf: super-admin pages still server-render without waiting on
 *    the ~1 MB CopilotKit chunk to download.
 *
 * The CopilotSidebar appears once the user's browser has fetched and
 * hydrated the provider chunk (typically a few hundred ms). All pages
 * that consume copilot hooks live inside CopilotProvider, so context
 * is available wherever it is read.
 */
export function CopilotShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Intentional post-hydration mount: this is the canonical pattern for
  // gating a heavy client-only provider behind first paint. The lint rule
  // flags setState in effects in general, but here it has no cascade —
  // CopilotProvider only renders once `mounted` flips to true.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) return <>{children}</>;
  return <CopilotProvider>{children}</CopilotProvider>;
}
