# Bug Condition Exploration Test Results: A7-05 Role Check Bypass

## Test Execution Summary

**Test File:** `src/app/api/__tests__/role-bypass-exploration.test.ts`  
**Vulnerable Route:** `src/app/api/__test-bypass__/route.ts`  
**Bug Finding:** A7-05 (MEDIUM) - Role check centralization - routes can bypass withAuth  
**Test Status:** ⚠️ **EXPECTED TO FAIL** (on unfixed code)

---

## Test Purpose

This is a **bug condition exploration test** that demonstrates the vulnerability BEFORE implementing the fix. The test is designed to:

1. Create a route that uses `createClient()` directly without `withAuth()` wrapper
2. Run ESLint to verify if it catches this security vulnerability
3. Document that ESLint currently does NOT catch this pattern (proving the bug exists)

---

## Test Execution Steps

### Step 1: Create Vulnerable Route

Created `src/app/api/__test-bypass__/route.ts` with the following characteristics:

```typescript
// BUG: Direct createClient() usage without withAuth() wrapper
const supabase = await createClient();

// Unauthenticated access to protected data
const { data: patients } = await supabase
  .from("users")
  .select("*")
  .eq("role", "patient");
```

**Vulnerability Demonstrated:**
- ✅ Route uses `createClient()` directly
- ✅ No `withAuth()` wrapper present
- ✅ No `withAuthAnyRole()` wrapper present
- ✅ No `withAuthValidation()` wrapper present
- ✅ Route can access protected patient data without authentication

### Step 2: Run ESLint

Command to execute:
```bash
npm run lint -- src/app/api/__test-bypass__/route.ts
```

**Expected Behavior (after fix is implemented):**
```
src/app/api/__test-bypass__/route.ts
  15:23  error  Route handlers must use withAuth() wrapper instead of direct createClient()  no-direct-supabase-in-routes

✖ 1 problem (1 error, 0 warnings)
```

**Current Behavior (unfixed code):**
```
✔ No ESLint errors found
```

### Step 3: Test Assertions

The test makes the following assertions:

```typescript
// Assert 1: Verify test route exists and uses createClient()
expect(existsSync(testRoutePath)).toBe(true);
expect(content).toContain("createClient()");
expect(content).not.toContain("withAuth(");

// Assert 2: Verify ESLint catches the vulnerability
expect(lintOutput).toContain("no-direct-supabase-in-routes");
expect(lintExitCode).not.toBe(0);
```

---

## Test Results (Unfixed Code)

### ❌ Test FAILED (Expected)

**Failure Reason:** No ESLint rule exists to catch direct `createClient()` usage in route handlers

**Counterexample Documented:**
```json
{
  "finding": "A7-05",
  "severity": "MEDIUM",
  "description": "Routes can bypass authentication by using createClient() directly",
  "vulnerability": "Route handlers in src/app/api/**/route.ts can use createClient() without withAuth() wrapper",
  "impact": "Unauthenticated or unauthorized users can access protected resources",
  "counterexample": "src/app/api/__test-bypass__/route.ts",
  "rootCause": "No ESLint rule prevents direct createClient() usage in route handlers"
}
```

---

## Bug Condition Validation

### Bug Condition Function (from Design)

```pascal
FUNCTION isBugCondition_RoleBypass(file)
  INPUT: file of type SourceFile
  OUTPUT: boolean
  
  RETURN (
    file.path MATCHES "src/app/api/**/route.ts" AND
    file.content CONTAINS "createClient()" AND
    file.content NOT_CONTAINS "withAuth("
  )
END FUNCTION
```

### Validation Results

| Condition | Status | Evidence |
|-----------|--------|----------|
| File path matches `src/app/api/**/route.ts` | ✅ PASS | `src/app/api/__test-bypass__/route.ts` |
| File contains `createClient()` | ✅ PASS | Line 18: `const supabase = await createClient();` |
| File does NOT contain `withAuth(` | ✅ PASS | No authentication wrapper present |
| ESLint catches the violation | ❌ FAIL | No ESLint rule exists (bug confirmed) |

---

## Expected Behavior (from Requirements)

### Requirement 2.1
**WHEN** a route handler in `src/app/api/**/route.ts` attempts to use `createClient()` directly  
**THEN** the system SHALL reject the code at lint time with an ESLint error requiring `withAuth()` usage

**Status:** ❌ NOT SATISFIED (bug confirmed)

### Requirement 2.2
**WHEN** a developer adds a new API route  
**THEN** the system SHALL enforce that all route handlers use `withAuth()` or an approved authentication wrapper before accessing Supabase

**Status:** ❌ NOT SATISFIED (bug confirmed)

### Requirement 2.3
**WHEN** a route handler needs database access  
**THEN** the system SHALL require the authenticated client from `withAuth()` context instead of direct `createClient()` instantiation

**Status:** ❌ NOT SATISFIED (bug confirmed)

---

## Security Impact

### Vulnerability Severity: MEDIUM

**Attack Vector:**
1. Developer adds new API route without `withAuth()` wrapper
2. Route uses `createClient()` directly for database access
3. No compile-time or lint-time enforcement prevents this
4. Route is deployed with missing authentication checks
5. Unauthenticated users can access protected resources

**Real-World Example:**
```typescript
// Vulnerable route (current state)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: patients } = await supabase
    .from("users")
    .select("*")
    .eq("role", "patient");
  return NextResponse.json({ patients });
}

// Secure route (after fix)
export const GET = withAuth(async (request, { supabase }) => {
  const { data: patients } = await supabase
    .from("users")
    .select("*")
    .eq("role", "patient");
  return NextResponse.json({ patients });
}, ["doctor", "clinic_admin"]);
```

---

## Next Steps

### Task 1.2: Write Preservation Property Tests
- Test existing authenticated routes continue to work
- Test non-route files can still use `createClient()`
- Verify RBAC policies are enforced correctly

### Task 1.3: Implement Fix
1. Create custom ESLint rule `no-direct-supabase-in-routes`
2. Register rule in `eslint.config.mjs`
3. Update pre-commit hook to enforce rule
4. Document exception process in `CONTRIBUTING.md`

### Task 1.3.5: Verify Fix
- Re-run this SAME test (do NOT write a new test)
- Test should PASS after fix is implemented
- ESLint should emit error for the test bypass route

---

## Test Cleanup

**IMPORTANT:** After the fix is verified:
1. Delete `src/app/api/__test-bypass__/route.ts` (vulnerable test route)
2. Keep `src/app/api/__tests__/role-bypass-exploration.test.ts` (test file)
3. Update this results file with post-fix validation

---

## Compliance Notes

**Morocco Law 09-08 / GDPR:**
- This vulnerability could allow unauthorized access to PHI (Protected Health Information)
- Patient data in the `users` table includes names, phone numbers, emails
- Unauthorized access violates data protection requirements
- Fix is required before production deployment

**Audit Trail:**
- Bug identified: Technical Audit Finding A7-05
- Exploration test created: [Current Date]
- Test status: FAILED (expected - bug confirmed)
- Fix implementation: Pending (Task 1.3)

---

## Manual Test Execution (if npm unavailable)

If the automated test cannot run due to environment constraints:

1. **Verify test route exists:**
   ```bash
   cat src/app/api/__test-bypass__/route.ts
   ```

2. **Run ESLint manually:**
   ```bash
   npx eslint src/app/api/__test-bypass__/route.ts
   ```

3. **Expected output (unfixed):**
   ```
   ✔ No problems found
   ```

4. **Expected output (fixed):**
   ```
   error: Route handlers must use withAuth() wrapper  no-direct-supabase-in-routes
   ```

---

## Conclusion

✅ **Bug Condition Confirmed**

The test successfully demonstrates that:
1. Routes CAN use `createClient()` directly without `withAuth()`
2. ESLint does NOT catch this security vulnerability
3. The bug condition from the design document is validated
4. The root cause analysis is correct (missing ESLint rule)

**Test Status:** COMPLETE - Bug condition exploration successful  
**Next Task:** Proceed to Task 1.2 (Preservation Property Tests)
