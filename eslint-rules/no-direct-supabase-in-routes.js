/**
 * ESLint Rule: no-direct-supabase-in-routes
 * 
 * Bug 1 (A7-05) Fix: Prevents authentication bypass via direct createClient() usage
 * 
 * This rule enforces that all route handlers in src/app/api/**/route.ts must use
 * authentication wrappers (withAuth, withAuthAnyRole, withAuthValidation) instead
 * of calling createClient() directly.
 * 
 * RATIONALE:
 * - Direct createClient() calls bypass authentication and RBAC checks
 * - Routes without withAuth() allow unauthenticated access to protected resources
 * - This is a critical security vulnerability in a healthcare SaaS handling PHI
 * 
 * SCOPE:
 * - Only applies to files matching src/app/api/**/route.ts pattern
 * - Does NOT apply to utilities, middleware, server components, or other files
 * - Non-route files can legitimately use createClient() directly
 * 
 * EXPECTED BEHAVIOR:
 * - Emit error when route.ts file contains createClient() without withAuth()
 * - Allow createClient() in non-route files
 * - Allow routes that use withAuth(), withAuthAnyRole(), or withAuthValidation()
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent direct createClient() usage in API route handlers without authentication wrappers",
      category: "Security",
      recommended: true,
    },
    messages: {
      noDirectSupabase: "Route handlers must use withAuth(), withAuthAnyRole(), or withAuthValidation() instead of calling createClient() directly. Direct createClient() usage bypasses authentication and RBAC checks (A7-05).",
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();
    
    // Only apply this rule to route.ts files in src/app/api/
    const isRouteFile = /src[\\/]app[\\/]api[\\/].*[\\/]route\.ts$/.test(filename);
    
    if (!isRouteFile) {
      // Not a route file - allow createClient() usage
      return {};
    }

    // Track whether the file uses authentication wrappers
    let hasAuthWrapper = false;
    let hasDirectCreateClient = false;
    let createClientNode = null;

    return {
      // Check for authentication wrapper usage
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          (node.callee.name === "withAuth" ||
           node.callee.name === "withAuthAnyRole" ||
           node.callee.name === "withAuthValidation")
        ) {
          hasAuthWrapper = true;
        }
        
        // Check for direct createClient() calls
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "createClient"
        ) {
          hasDirectCreateClient = true;
          createClientNode = node;
        }
      },

      // At the end of the file, check if we found createClient() without auth wrapper
      "Program:exit"() {
        if (hasDirectCreateClient && !hasAuthWrapper) {
          context.report({
            node: createClientNode,
            messageId: "noDirectSupabase",
          });
        }
      },
    };
  },
};
