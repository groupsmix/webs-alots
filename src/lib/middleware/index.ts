/**
 * Composable middleware modules.
 *
 * The monolithic middleware.ts (557+ lines) has been refactored into
 * focused, testable modules:
 *
 *   - security-headers.ts — CSP, HSTS, X-Frame-Options, nonce generation
 *   - csrf.ts             — Origin-based CSRF validation for mutations
 *   - rate-limiting.ts    — Per-IP rate limiting for API routes
 *   - routes.ts           — Route classification (public, protected, role maps)
 */

export {
  buildCsp,
  buildLegacyCsp,
  buildCspHeaderValues,
  withSecurityHeaders,
  secureRedirect,
  applyAllSecurityHeaders,
} from "./security-headers";
export type { CspHeaderValues } from "./security-headers";
export { validateCsrf } from "./csrf";
export { applyRateLimit } from "./rate-limiting";
export {
  isPublicRoute,
  isProtectedRoute,
  LIGHTWEIGHT_API_PATHS,
  ROLE_ROUTE_MAP,
  ROLE_DASHBOARD_MAP,
} from "./routes";
