"use client";

import dynamic from "next/dynamic";

/**
 * API documentation page (Scalar)
 * Accessible at /api-docs
 * Displays OpenAPI spec from /api/docs/route.ts
 *
 * A9-04: Migrated from swagger-ui-react (React 15-18 peer deps)
 * to @scalar/api-reference-react (React 18-19 compatible).
 *
 * Scalar is a heavy, fully client-side interactive widget (it ships its own
 * icon set and bundle). Loading it via `next/dynamic` with `ssr: false` keeps
 * it (and its icons) out of the Cloudflare Worker server bundle entirely,
 * which matters for the 10 MiB Worker size limit. The docs render client-side
 * only, so there is no SSR/SEO loss.
 */
const ApiReferenceReact = dynamic(
  () => import("@scalar/api-reference-react").then((m) => m.ApiReferenceReact),
  { ssr: false },
);

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen">
      <ApiReferenceReact
        configuration={{
          url: "/api/docs",
          theme: "default",
          layout: "modern",
          hideModels: false,
          hideDownloadButton: false,
          // Use system fonts instead of fetching from fonts.scalar.com, which the
          // app's strict CSP (font-src 'self') blocks — that produced ~14 console
          // errors and fell back to default fonts anyway. Self-hosting avoids both
          // the CSP violations and the external dependency.
          withDefaultFonts: false,
        }}
      />
    </div>
  );
}
