/**
 * Bug Condition Exploration Test for A7-05: Role Check Bypass
 * 
 * **Property 1: Bug Condition** - ESLint Rule Enforcement for Route Authentication
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **GOAL**: Surface counterexamples demonstrating routes can bypass authentication
 * 
 * **Scoped PBT Approach**: Create test route file using `createClient()` without `withAuth()` wrapper
 * 
 * Test implementation details from Bug Condition in design:
 * - Create `src/app/api/__test-bypass__/route.ts` with direct `createClient()` call
 * - Run ESLint and capture output
 * - Assert ESLint emits error mentioning "no-direct-supabase-in-routes"
 * 
 * The test assertions match Expected Behavior Properties from design (2.1, 2.2, 2.3)
 * 
 * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS (no ESLint rule exists yet - proves bug exists)
 * **EXPECTED OUTCOME ON FIXED CODE**: Test PASSES (ESLint rule catches bypass attempts)
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

describe("Bug 1: Role Check Bypass via Direct createClient() Usage (A7-05)", () => {
  describe("Property 1: Bug Condition - ESLint Rule Enforcement", () => {
    it("should detect direct createClient() usage in route handlers without withAuth()", () => {
      // GIVEN: A route file that uses createClient() directly without withAuth()
      const testRouteFile = path.join(
        process.cwd(),
        "src/app/api/__test-bypass__/route.ts"
      );

      // Verify the test route file exists (created as part of this test task)
      expect(existsSync(testRouteFile)).toBe(true);

      // WHEN: ESLint is run on the test route file
      let lintOutput = "";
      let lintExitCode = 0;

      try {
        // Run ESLint on the specific file
        lintOutput = execSync(
          `npx eslint "${testRouteFile}" --format json`,
          {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          }
        );
      } catch (error: any) {
        // ESLint exits with non-zero code when errors are found
        lintExitCode = error.status || 1;
        lintOutput = error.stdout || "";
      }

      // THEN: ESLint should emit an error mentioning "no-direct-supabase-in-routes"
      // Parse the JSON output
      const lintResults = JSON.parse(lintOutput);

      // Find the result for our test file
      const fileResult = lintResults.find((result: any) =>
        result.filePath.includes("__test-bypass__")
      );

      expect(fileResult).toBeDefined();
      expect(fileResult.errorCount).toBeGreaterThan(0);

      // Verify the specific rule is triggered
      const ruleViolation = fileResult.messages.find(
        (msg: any) =>
          msg.ruleId === "custom/no-direct-supabase-in-routes" ||
          msg.message.includes("no-direct-supabase-in-routes") ||
          msg.message.includes("withAuth") ||
          msg.message.includes("authentication")
      );

      expect(ruleViolation).toBeDefined();
      expect(ruleViolation.severity).toBe(2); // Error level

      // Verify the error message mentions the security issue
      expect(ruleViolation.message).toMatch(
        /withAuth|authentication|RBAC|A7-05/i
      );

      // COUNTEREXAMPLE DOCUMENTATION:
      // If this test FAILS on unfixed code, it means:
      // - ESLint does NOT have the "no-direct-supabase-in-routes" rule
      // - Routes can bypass authentication by using createClient() directly
      // - This is the authentication bypass vulnerability (A7-05)
      //
      // Expected behavior after fix:
      // - ESLint MUST emit error for direct createClient() usage in routes
      // - The error MUST block commits (via pre-commit hook)
      // - Developers MUST use withAuth() wrapper for all route handlers
    });

    it("should allow createClient() usage in non-route files", () => {
      // GIVEN: A non-route file that uses createClient() (e.g., utility, middleware)
      // This is a preservation check - non-route files should NOT be flagged

      // WHEN: ESLint is run on non-route files with createClient()
      // Example: src/lib/supabase-server.ts itself uses createClient()
      const nonRouteFile = path.join(
        process.cwd(),
        "src/lib/supabase-server.ts"
      );

      expect(existsSync(nonRouteFile)).toBe(true);

      let lintOutput = "";
      try {
        lintOutput = execSync(`npx eslint "${nonRouteFile}" --format json`, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (error: any) {
        lintOutput = error.stdout || "";
      }

      const lintResults = JSON.parse(lintOutput);
      const fileResult = lintResults.find((result: any) =>
        result.filePath.includes("supabase-server.ts")
      );

      // THEN: ESLint should NOT emit the no-direct-supabase-in-routes error
      // (because this is not a route file)
      if (fileResult && fileResult.messages.length > 0) {
        const ruleViolation = fileResult.messages.find(
          (msg: any) => msg.ruleId === "custom/no-direct-supabase-in-routes"
        );

        // The rule should NOT trigger for non-route files
        expect(ruleViolation).toBeUndefined();
      }

      // PRESERVATION CHECK:
      // Non-route files (utilities, middleware, server components) MUST be able
      // to use createClient() directly for legitimate purposes
    });

    it("should allow routes that correctly use withAuth()", () => {
      // GIVEN: A route file that correctly uses withAuth() wrapper
      // Example: src/app/api/patients/route.ts (if it exists and uses withAuth)

      // WHEN: ESLint is run on properly authenticated routes
      // THEN: ESLint should NOT emit the no-direct-supabase-in-routes error

      // This is a preservation check - properly authenticated routes should work
      // We'll check this by looking for any existing route that uses withAuth

      const patientsRoute = path.join(
        process.cwd(),
        "src/app/api/patients/route.ts"
      );

      if (existsSync(patientsRoute)) {
        let lintOutput = "";
        try {
          lintOutput = execSync(`npx eslint "${patientsRoute}" --format json`, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
        } catch (error: any) {
          lintOutput = error.stdout || "";
        }

        const lintResults = JSON.parse(lintOutput);
        const fileResult = lintResults.find((result: any) =>
          result.filePath.includes("patients")
        );

        if (fileResult && fileResult.messages.length > 0) {
          const ruleViolation = fileResult.messages.find(
            (msg: any) => msg.ruleId === "custom/no-direct-supabase-in-routes"
          );

          // Routes using withAuth() should NOT trigger the rule
          expect(ruleViolation).toBeUndefined();
        }
      }

      // PRESERVATION CHECK:
      // Routes that correctly use withAuth() MUST continue to work without
      // ESLint errors from this rule
    });
  });

  describe("Bug Condition Function Verification", () => {
    it("should match the formal specification from design document", () => {
      // Verify the bug condition function from design.md:
      //
      // FUNCTION isBugCondition_RoleBypass(file)
      //   INPUT: file of type SourceFile
      //   OUTPUT: boolean
      //
      //   RETURN file.path MATCHES "src/app/api/**/route.ts" AND
      //          file.content CONTAINS "createClient()" AND
      //          file.content NOT_CONTAINS "withAuth(" AND
      //          file.content NOT_CONTAINS "withAuthAnyRole(" AND
      //          file.content NOT_CONTAINS "withAuthValidation("
      // END FUNCTION

      const testRouteFile = path.join(
        process.cwd(),
        "src/app/api/__test-bypass__/route.ts"
      );

      // Check file path matches pattern
      expect(testRouteFile).toMatch(/src[\\/]app[\\/]api[\\/].*[\\/]route\.ts$/);

      // Check file content (read the file we created)
      const fs = require("fs");
      const fileContent = fs.readFileSync(testRouteFile, "utf-8");

      // Verify bug condition holds
      expect(fileContent).toContain("createClient()");
      expect(fileContent).not.toContain("withAuth(");
      expect(fileContent).not.toContain("withAuthAnyRole(");
      expect(fileContent).not.toContain("withAuthValidation(");

      // This confirms the test file correctly represents the bug condition
    });
  });
});
