/**
 * Bug Condition Exploration Test for A7-05: Role Check Bypass
 * 
 * Property 1: Bug Condition - ESLint Rule Enforcement for Route Authentication
 * 
 * This test demonstrates that routes can bypass authentication by using
 * createClient() directly without withAuth() wrapper. The test creates
 * a vulnerable route and verifies that ESLint should catch it.
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * EXPECTED OUTCOME (unfixed code): Test FAILS - no ESLint rule exists yet
 * EXPECTED OUTCOME (fixed code): Test PASSES - ESLint rule catches the bypass
 * 
 * Validates Requirements: 1.1, 1.2, 1.3 (Bug Condition)
 * Validates Design Properties: 2.1, 2.2, 2.3 (Expected Behavior)
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Bug Condition Exploration: Role Check Bypass (A7-05)", () => {
  const testRouteFile = "src/app/api/__test-bypass__/route.ts";
  const projectRoot = process.cwd();
  const testRoutePath = join(projectRoot, testRouteFile);

  it("should detect that test bypass route exists", () => {
    // Verify the test route file was created
    expect(existsSync(testRoutePath)).toBe(true);
    
    const content = readFileSync(testRoutePath, "utf-8");
    
    // Verify the route uses createClient() directly
    expect(content).toContain("createClient()");
    
    // Verify the route does NOT use withAuth()
    expect(content).not.toContain("withAuth(");
    expect(content).not.toContain("withAuthAnyRole(");
    expect(content).not.toContain("withAuthValidation(");
  });

  it("should verify ESLint catches direct createClient() usage in route handlers", () => {
    // Run ESLint on the test bypass route
    let lintOutput = "";
    let lintExitCode = 0;
    
    try {
      // Run ESLint specifically on the test bypass route
      lintOutput = execSync(
        `npm run lint -- ${testRouteFile}`,
        { 
          encoding: "utf-8",
          cwd: projectRoot,
          stdio: "pipe"
        }
      );
    } catch (error: any) {
      // ESLint exits with non-zero code when errors are found
      lintExitCode = error.status || 0;
      lintOutput = error.stdout || error.stderr || "";
    }

    // EXPECTED BEHAVIOR (after fix):
    // - ESLint should emit error mentioning "no-direct-supabase-in-routes"
    // - Exit code should be non-zero (error found)
    
    // CURRENT BEHAVIOR (unfixed):
    // - ESLint allows the code (no error)
    // - Exit code is 0 (success)
    
    // This assertion will FAIL on unfixed code, proving the bug exists
    expect(lintOutput).toContain("no-direct-supabase-in-routes");
    expect(lintExitCode).not.toBe(0);
  });

  it("should document the vulnerability: routes can bypass withAuth()", () => {
    // This test documents the bug condition for the audit trail
    const bugCondition = {
      finding: "A7-05",
      severity: "MEDIUM",
      description: "Routes can bypass authentication by using createClient() directly",
      vulnerability: "Route handlers in src/app/api/**/route.ts can use createClient() without withAuth() wrapper",
      impact: "Unauthenticated or unauthorized users can access protected resources",
      counterexample: testRouteFile,
      rootCause: "No ESLint rule prevents direct createClient() usage in route handlers",
    };

    // Verify the bug condition is correctly identified
    expect(bugCondition.finding).toBe("A7-05");
    expect(bugCondition.severity).toBe("MEDIUM");
    
    // Log the bug condition for documentation
    console.log("\n=== Bug Condition Documented ===");
    console.log(JSON.stringify(bugCondition, null, 2));
    console.log("================================\n");
  });
});
