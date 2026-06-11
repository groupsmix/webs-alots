"use client";

import { MASKING_BUILD_LEVEL, MASKING_BUILD_MARKER } from "@/lib/mask";

/**
 * Invisible build-integrity sentinel (audit 2026-06-09 Task 2).
 *
 * Rendered once from the root layout so the marker + inlined
 * NEXT_PUBLIC_DATA_MASKING value are guaranteed to appear in a client
 * chunk shipped on every page. The post-deploy smoke test
 * (scripts/smoke-post-deploy.mjs) scans the deployed bundle for the
 * marker and fails the deploy when the masking level was not baked in —
 * the failure mode where getMaskLevel() silently compiles to "none".
 *
 * suppressHydrationWarning: during SSR on the Worker this reads the
 * RUNTIME env var while the client bundle carries the BUILD-time value;
 * when a build is misconfigured the two legitimately differ, and that
 * mismatch must not crash hydration — the smoke test is what reports it.
 */
export function MaskingBuildSentinel() {
  return (
    <span
      hidden
      aria-hidden="true"
      data-masking-build={`${MASKING_BUILD_MARKER}${MASKING_BUILD_LEVEL}`}
      suppressHydrationWarning
    />
  );
}
