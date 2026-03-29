"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-500">Loading API documentation...</span>
    </div>
  ),
});

// Import Swagger CSS
import "swagger-ui-react/swagger-ui.css";

/**
 * Swagger UI documentation page
 * Accessible at /api-docs
 * Displays OpenAPI spec from /api/docs/route.ts
 */
export default function ApiDocsPage() {
  const [specUrl, setSpecUrl] = useState("/api/docs");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Oltigo API Documentation</h1>
          <p className="mt-2 text-gray-600">
            Interactive API documentation for Oltigo healthcare management platform
          </p>
          <div className="mt-4 flex gap-4">
            <a
              href="/api/docs"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI JSON
            </a>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">
              Rate limited at 30 req/min • Returns X-RateLimit-* headers
            </span>
          </div>
        </header>
        
        <div className="bg-white rounded-lg shadow">
          <SwaggerUI url={specUrl} />
        </div>
      </div>
    </div>
  );
}
