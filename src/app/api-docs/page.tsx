"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";

/**
 * API documentation page (Scalar)
 * Accessible at /api-docs
 * Displays OpenAPI spec from /api/docs/route.ts
 *
 * A9-04: Migrated from swagger-ui-react (React 15-18 peer deps)
 * to @scalar/api-reference-react (React 18-19 compatible).
 */
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
        }}
      />
    </div>
  );
}
