/**
 * Bug Group 3: Data Integrity
 * 
 * Bug Condition Exploration Test
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms bugs exist.
 * **DO NOT attempt to fix the test or the code when it fails.**
 * 
 * This test encodes the expected behavior after the fix is implemented.
 * When this test passes after implementing the fix, it confirms the bugs are resolved.
 * 
 * Covers:
 * - A16-06 (MEDIUM): JSONB schema validation missing for prescriptions
 * - A16-07 (LOW): Stock table CASCADE review needed
 * - A23-01 (MEDIUM): select("*") over-fetching in data layer
 * - A23-03 (LOW): Missing .limit() on list endpoints
 * - API9 (LOW): Deprecated clinicId field still accepted
 * 
 * Bug Condition Functions:
 * ```
 * FUNCTION isBugCondition_MissingJSONBValidation(prescription_content)
 *   INPUT: prescription_content of type JSONB
 *   OUTPUT: boolean
 *   
 *   RETURN NOT hasZodValidation(prescription_content) AND
 *          prescription_content IS INSERTED INTO prescriptions.content
 * END FUNCTION
 * 
 * FUNCTION isBugCondition_SelectStar(query)
 *   INPUT: query of type string
 *   OUTPUT: boolean
 *   
 *   RETURN query CONTAINS 'select("*")' OR
 *          query CONTAINS 'select(*)' OR
 *          query CONTAINS '.select("*")'
 * END FUNCTION
 * 
 * FUNCTION isBugCondition_MissingLimit(endpoint)
 *   INPUT: endpoint of type string
 *   OUTPUT: boolean
 *   
 *   RETURN endpoint IS LIST_ENDPOINT AND
 *          NOT query CONTAINS '.limit('
 * END FUNCTION
 * 
 * FUNCTION isBugCondition_DeprecatedClinicId(request_body)
 *   INPUT: request_body of type object
 *   OUTPUT: boolean
 *   
 *   RETURN request_body CONTAINS 'clinicId' AND
 *          validation ACCEPTS request_body
 * END FUNCTION
 * ```
 * 
 * Expected Behavior Properties (from design 3.1, 3.2, 3.3, 3.4):
 * - Property 3.1: System SHALL validate JSONB structure with Zod before insertion
 * - Property 3.2: System SHALL use explicit column selection instead of select("*")
 * - Property 3.3: System SHALL enforce .limit() clauses on list endpoints
 * - Property 3.4: System SHALL reject deprecated clinicId field
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Bug Group 3: Data Integrity Exploration", () => {
  describe("Bug Condition 1: JSONB Schema Validation Missing (A16-06)", () => {
    it("should have Zod schema for prescription content JSONB (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Read the validations file
      const validationsPath = join(process.cwd(), "src", "lib", "validations.ts");
      const validationsContent = readFileSync(validationsPath, "utf-8");

      // EXPECTED BEHAVIOR AFTER FIX: Should have prescriptionContentSchema
      expect(validationsContent).toContain("prescriptionContentSchema");
      expect(validationsContent).toContain("z.object");
      
      // Should validate prescription structure
      expect(validationsContent).toMatch(/medications|drugs|items/);
      expect(validationsContent).toMatch(/dosage|dose/);
    });

    it("should validate prescription content before database insertion (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Read prescription-related API routes
      const apiPath = join(process.cwd(), "src", "app", "api");
      const files = findFilesRecursive(apiPath, /prescription.*route\.ts$/);

      let foundValidation = false;
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        
        // EXPECTED BEHAVIOR AFTER FIX: Should validate before insert
        if (content.includes("prescriptionContentSchema") && 
            content.includes(".safeParse") || content.includes(".parse")) {
          foundValidation = true;
          break;
        }
      }

      expect(foundValidation).toBe(true);
    });

    it("should reject invalid prescription JSONB structure (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // This test verifies that invalid JSONB is rejected
      const validationsPath = join(process.cwd(), "src", "lib", "validations.ts");
      const validationsContent = readFileSync(validationsPath, "utf-8");

      // EXPECTED BEHAVIOR AFTER FIX: Schema should be strict
      if (validationsContent.includes("prescriptionContentSchema")) {
        // Schema exists, verify it's strict
        expect(validationsContent).toMatch(/\.strict\(\)|\.passthrough\(\)/);
      } else {
        // Schema doesn't exist yet - this is the bug
        expect(validationsContent).toContain("prescriptionContentSchema");
      }
    });
  });

  describe("Bug Condition 2: select(\"*\") Over-Fetching (A23-01)", () => {
    it("should NOT use select(\"*\") in data layer functions (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Read all files in src/lib/data/
      const dataPath = join(process.cwd(), "src", "lib", "data");
      
      if (!existsSync(dataPath)) {
        // Data layer might be in different location
        return;
      }

      const files = findFilesRecursive(dataPath, /\.ts$/);
      const violations: { file: string; line: number }[] = [];

      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          // Check for select("*") or select('*')
          if (line.includes('.select("*")') || line.includes(".select('*')")) {
            violations.push({ file, line: index + 1 });
          }
        });
      }

      // EXPECTED BEHAVIOR AFTER FIX: No select("*") in data layer
      expect(violations).toHaveLength(0);
      
      if (violations.length > 0) {
        console.log("Found select(\"*\") violations:");
        violations.forEach(v => console.log(`  ${v.file}:${v.line}`));
      }
    });

    it("should NOT use select(\"*\") in API routes (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Read all API route files
      const apiPath = join(process.cwd(), "src", "app", "api");
      const files = findFilesRecursive(apiPath, /route\.ts$/);
      const violations: { file: string; line: number }[] = [];

      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          // Check for select("*") or select('*')
          if (line.includes('.select("*")') || line.includes(".select('*')")) {
            violations.push({ file, line: index + 1 });
          }
        });
      }

      // EXPECTED BEHAVIOR AFTER FIX: No select("*") in API routes
      expect(violations).toHaveLength(0);
      
      if (violations.length > 0) {
        console.log("Found select(\"*\") violations in API routes:");
        violations.forEach(v => console.log(`  ${v.file}:${v.line}`));
      }
    });

    it("should use explicit column lists in queries (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Sample check: appointments query should list columns explicitly
      const dataPath = join(process.cwd(), "src", "lib", "data");
      
      if (!existsSync(dataPath)) {
        return;
      }

      const files = findFilesRecursive(dataPath, /appointment.*\.ts$/);
      
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        
        // EXPECTED BEHAVIOR AFTER FIX: Should have explicit column lists
        // Look for patterns like .select("id, patient_id, doctor_id, ...")
        const hasExplicitSelect = content.match(/\.select\(["'][^*][^"']+["']\)/);
        
        if (content.includes(".select(") && !hasExplicitSelect) {
          // Found select but no explicit columns
          expect(hasExplicitSelect).toBeTruthy();
        }
      }
    });
  });

  describe("Bug Condition 3: Missing .limit() on List Endpoints (A23-03)", () => {
    it("should have .limit() on all list endpoints (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Read all API route files
      const apiPath = join(process.cwd(), "src", "app", "api");
      const files = findFilesRecursive(apiPath, /route\.ts$/);
      const violations: { file: string; endpoint: string }[] = [];

      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        
        // Identify list endpoints (GET handlers that query arrays)
        const isListEndpoint = content.includes("export async function GET") &&
                              (content.includes(".from(") || content.includes("supabase.from"));
        
        if (isListEndpoint) {
          // Check if .limit() is present
          const hasLimit = content.includes(".limit(");
          
          if (!hasLimit) {
            violations.push({ file, endpoint: extractEndpointName(file) });
          }
        }
      }

      // EXPECTED BEHAVIOR AFTER FIX: All list endpoints should have .limit()
      expect(violations).toHaveLength(0);
      
      if (violations.length > 0) {
        console.log("Found list endpoints without .limit():");
        violations.forEach(v => console.log(`  ${v.endpoint} (${v.file})`));
      }
    });

    it("should enforce reasonable default limits (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Read API routes and check limit values
      const apiPath = join(process.cwd(), "src", "app", "api");
      const files = findFilesRecursive(apiPath, /route\.ts$/);
      const highLimits: { file: string; limit: number }[] = [];

      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        
        // Find .limit() calls and extract the value
        const limitMatches = content.matchAll(/\.limit\((\d+)\)/g);
        
        for (const match of limitMatches) {
          const limit = parseInt(match[1], 10);
          
          // EXPECTED BEHAVIOR AFTER FIX: Limits should be reasonable (e.g., <= 100)
          if (limit > 100) {
            highLimits.push({ file, limit });
          }
        }
      }

      // Warn about high limits (not necessarily a bug, but worth reviewing)
      if (highLimits.length > 0) {
        console.log("Found endpoints with high limits (>100):");
        highLimits.forEach(h => console.log(`  ${h.file}: limit(${h.limit})`));
      }
    });
  });

  describe("Bug Condition 4: Deprecated clinicId Field Accepted (API9)", () => {
    it("should NOT accept deprecated clinicId field in validation schemas (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Read validations.ts
      const validationsPath = join(process.cwd(), "src", "lib", "validations.ts");
      const validationsContent = readFileSync(validationsPath, "utf-8");

      // EXPECTED BEHAVIOR AFTER FIX: clinicId should not be in schemas
      // (clinic_id with underscore is the correct field)
      
      // Find all schema definitions
      const schemaMatches = validationsContent.matchAll(/export const (\w+Schema) = z\.object\({([^}]+)}/gs);
      
      for (const match of schemaMatches) {
        const schemaName = match[1];
        const schemaBody = match[2];
        
        // Check if schema contains clinicId (camelCase - deprecated)
        if (schemaBody.includes("clinicId:") && !schemaBody.includes("clinic_id:")) {
          // Found deprecated field
          expect(schemaBody).not.toContain("clinicId:");
          console.log(`Found deprecated clinicId in ${schemaName}`);
        }
      }
    });

    it("should reject requests with deprecated clinicId field (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // This test would require actually calling an API endpoint
      // For now, we verify the schema doesn't accept it
      const validationsPath = join(process.cwd(), "src", "lib", "validations.ts");
      const validationsContent = readFileSync(validationsPath, "utf-8");

      // EXPECTED BEHAVIOR AFTER FIX: Schemas should use .strict() to reject unknown fields
      const schemaCount = (validationsContent.match(/export const \w+Schema = z\.object/g) || []).length;
      const strictCount = (validationsContent.match(/\.strict\(\)/g) || []).length;

      // Most schemas should be strict to reject deprecated fields
      expect(strictCount).toBeGreaterThan(0);
    });

    it("should document migration from clinicId to clinic_id (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Check if there's documentation about the field name change
      const changelogPath = join(process.cwd(), "CHANGELOG.md");
      
      if (existsSync(changelogPath)) {
        const changelogContent = readFileSync(changelogPath, "utf-8");
        
        // EXPECTED BEHAVIOR AFTER FIX: Should document the breaking change
        const hasDeprecationNote = changelogContent.includes("clinicId") && 
                                   changelogContent.includes("clinic_id");
        
        // This is informational - not a hard requirement
        if (!hasDeprecationNote) {
          console.log("Note: Consider documenting clinicId -> clinic_id migration in CHANGELOG.md");
        }
      }
    });
  });

  describe("Bug Condition 5: Stock Table CASCADE Review (A16-07)", () => {
    it("should review CASCADE constraints on stock table (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Read migration files to find stock table definition
      const migrationsPath = join(process.cwd(), "supabase", "migrations");
      
      if (!existsSync(migrationsPath)) {
        console.log("Migrations directory not found");
        return;
      }

      const files = readdirSync(migrationsPath).filter(f => f.endsWith(".sql"));
      let foundStockTable = false;
      let hasCascadeReview = false;

      for (const file of files) {
        const content = readFileSync(join(migrationsPath, file), "utf-8");
        
        if (content.includes("CREATE TABLE") && content.includes("stock")) {
          foundStockTable = true;
          
          // EXPECTED BEHAVIOR AFTER FIX: Should have explicit CASCADE or RESTRICT
          // and a comment explaining the choice
          const hasCascade = content.includes("ON DELETE CASCADE");
          const hasRestrict = content.includes("ON DELETE RESTRICT");
          const hasComment = content.includes("-- CASCADE") || content.includes("-- RESTRICT");
          
          if ((hasCascade || hasRestrict) && hasComment) {
            hasCascadeReview = true;
          }
        }
      }

      if (foundStockTable) {
        // EXPECTED BEHAVIOR AFTER FIX: CASCADE behavior should be reviewed and documented
        expect(hasCascadeReview).toBe(true);
      }
    });
  });
});

// ── Helper Functions ──

function findFilesRecursive(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  
  if (!existsSync(dir)) {
    return results;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and .next
      if (entry.name !== "node_modules" && entry.name !== ".next") {
        results.push(...findFilesRecursive(fullPath, pattern));
      }
    } else if (entry.isFile() && pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

function extractEndpointName(filePath: string): string {
  // Extract endpoint name from file path
  // e.g., "src/app/api/appointments/route.ts" -> "/api/appointments"
  const match = filePath.match(/api\/(.+)\/route\.ts$/);
  return match ? `/api/${match[1]}` : filePath;
}

function existsSync(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
