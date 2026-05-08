#!/usr/bin/env tsx
/**
 * Backfill Script for Patient Files Table (A7-01)
 *
 * This script populates the patient_files table with existing R2 objects
 * that were uploaded before the file ownership tracking was implemented.
 * 
 * Usage:
 *   npm run backfill:patient-files [--dry-run] [--clinic-id=<uuid>]
 *
 * Options:
 *   --dry-run: Show what would be done without making changes
 *   --clinic-id: Process only files for a specific clinic
 *   --batch-size: Number of files to process per batch (default: 100)
 *   --max-files: Maximum number of files to process (default: unlimited)
 *
 * The script:
 * 1. Lists all R2 objects under clinics/ prefix
 * 2. Parses R2 keys to extract clinic_id and patient_id
 * 3. Inserts records into patient_files table for trackable files
 * 4. Skips files that don't follow the expected key pattern
 * 5. Handles duplicates gracefully (upsert behavior)
 *
 * Key Pattern Expected:
 *   clinics/{clinicId}/patients/{patientId}/{category}/{filename}
 *   clinics/{clinicId}/{category}/{filename} (staff-only files, no patient_id)
 */

import { createAdminClient } from "../src/lib/supabase-server";
import { logger } from "../src/lib/logger";
import { isR2Configured } from "../src/lib/r2";

// Command line argument parsing
interface BackfillOptions {
  dryRun: boolean;
  clinicId?: string;
  batchSize: number;
  maxFiles?: number;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {
    dryRun: false,
    batchSize: 100,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--clinic-id=")) {
      options.clinicId = arg.split("=")[1];
    } else if (arg.startsWith("--batch-size=")) {
      options.batchSize = parseInt(arg.split("=")[1], 10) || 100;
    } else if (arg.startsWith("--max-files=")) {
      options.maxFiles = parseInt(arg.split("=")[1], 10);
    }
  }

  return options;
}

// R2 key parsing utilities
interface ParsedKey {
  clinicId: string;
  patientId?: string;
  category: string;
  filename: string;
  isPatientFile: boolean;
}

function parseR2Key(key: string): ParsedKey | null {
  // Expected patterns:
  // clinics/{clinicId}/patients/{patientId}/{category}/{filename}
  // clinics/{clinicId}/{category}/{filename}
  
  const parts = key.split("/");
  
  if (parts.length < 4 || parts[0] !== "clinics") {
    return null; // Not a clinic file
  }

  const clinicId = parts[1];
  if (!clinicId || !/^[0-9a-fA-F-]{36}$/.test(clinicId)) {
    return null; // Invalid clinic UUID
  }

  // Check if it's a patient-specific file
  if (parts[2] === "patients" && parts.length >= 6) {
    const patientId = parts[3];
    if (!/^[0-9a-fA-F-]{36}$/.test(patientId)) {
      return null; // Invalid patient UUID
    }
    
    return {
      clinicId,
      patientId,
      category: parts[4],
      filename: parts.slice(5).join("/"), // Handle nested paths
      isPatientFile: true,
    };
  } else if (parts.length >= 4) {
    // Staff-only file (no patient_id)
    return {
      clinicId,
      category: parts[2],
      filename: parts.slice(3).join("/"),
      isPatientFile: false,
    };
  }

  return null;
}

// Mock R2 listing function (replace with actual R2 SDK calls)
async function listR2Objects(prefix: string, maxKeys?: number): Promise<string[]> {
  // In a real implementation, this would use the R2 SDK to list objects
  // For now, return a mock list for demonstration
  
  if (!isR2Configured()) {
    throw new Error("R2 is not configured");
  }

  // This is a placeholder - in real implementation you would use:
  // const r2 = new R2Bucket(...);
  // const objects = await r2.list({ prefix, maxKeys });
  // return objects.objects.map(obj => obj.key);
  
  logger.warn("Mock R2 listing - replace with actual R2 SDK implementation", {
    context: "backfill-patient-files",
    prefix,
    maxKeys,
  });
  
  return [
    "clinics/550e8400-e29b-41d4-a716-446655440000/patients/6ba7b810-9dad-11d1-80b4-00c04fd430c8/documents/report.pdf",
    "clinics/550e8400-e29b-41d4-a716-446655440000/patients/6ba7b811-9dad-11d1-80b4-00c04fd430c8/lab_results/blood_test.pdf",
    "clinics/550e8400-e29b-41d4-a716-446655440000/logos/clinic_logo.png",
    "clinics/550e8401-e29b-41d4-a716-446655440000/patients/6ba7b812-9dad-11d1-80b4-00c04fd430c8/x_rays/chest_xray.jpg",
  ];
}

// Database operations
async function insertPatientFile(
  supabase: ReturnType<typeof createAdminClient>,
  record: {
    clinic_id: string;
    patient_id: string;
    r2_key: string;
    content_type: string;
    uploaded_by: null; // Legacy files have no uploader tracking
  },
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    logger.info("DRY RUN: Would insert patient file record", {
      context: "backfill-patient-files",
      record,
    });
    return true;
  }

  try {
    const { error } = await supabase
      .from("patient_files")
      .upsert(record, {
        onConflict: "clinic_id,r2_key",
        ignoreDuplicates: false,
      });

    if (error) {
      logger.error("Failed to insert patient file record", {
        context: "backfill-patient-files",
        record,
        error,
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error("Exception during patient file insert", {
      context: "backfill-patient-files",
      record,
      error: err,
    });
    return false;
  }
}

// Content type detection from file extension
function detectContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  
  const contentTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    txt: "text/plain",
    html: "text/html",
    json: "application/json",
  };

  return contentTypes[ext || ""] || "application/octet-stream";
}

// Main backfill logic
async function backfillPatientFiles(options: BackfillOptions): Promise<void> {
  logger.info("Starting patient files backfill", {
    context: "backfill-patient-files",
    options,
  });

  const supabase = createAdminClient();
  
  // Determine R2 prefix to scan
  const prefix = options.clinicId 
    ? `clinics/${options.clinicId}/`
    : "clinics/";

  try {
    // List R2 objects
    logger.info("Listing R2 objects", {
      context: "backfill-patient-files",
      prefix,
    });

    const allKeys = await listR2Objects(prefix, options.maxFiles);
    
    logger.info("Found R2 objects", {
      context: "backfill-patient-files",
      totalKeys: allKeys.length,
    });

    // Process in batches
    let processed = 0;
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < allKeys.length; i += options.batchSize) {
      const batch = allKeys.slice(i, i + options.batchSize);
      
      logger.info("Processing batch", {
        context: "backfill-patient-files",
        batchStart: i + 1,
        batchEnd: Math.min(i + options.batchSize, allKeys.length),
        totalKeys: allKeys.length,
      });

      for (const key of batch) {
        processed++;
        
        // Parse the R2 key
        const parsed = parseR2Key(key);
        
        if (!parsed) {
          logger.debug("Skipping unparseable key", {
            context: "backfill-patient-files",
            key,
          });
          skipped++;
          continue;
        }

        // Skip staff-only files (no patient_id)
        if (!parsed.isPatientFile || !parsed.patientId) {
          logger.debug("Skipping staff-only file", {
            context: "backfill-patient-files",
            key,
            parsed,
          });
          skipped++;
          continue;
        }

        // Filter by clinic if specified
        if (options.clinicId && parsed.clinicId !== options.clinicId) {
          skipped++;
          continue;
        }

        // Prepare record for insertion
        const record = {
          clinic_id: parsed.clinicId,
          patient_id: parsed.patientId,
          r2_key: key,
          content_type: detectContentType(parsed.filename),
          uploaded_by: null, // Legacy files have no uploader tracking
        };

        // Insert into database
        const success = await insertPatientFile(supabase, record, options.dryRun);
        
        if (success) {
          inserted++;
        } else {
          errors++;
        }

        // Progress logging
        if (processed % 50 === 0) {
          logger.info("Backfill progress", {
            context: "backfill-patient-files",
            processed,
            inserted,
            skipped,
            errors,
            remaining: allKeys.length - processed,
          });
        }
      }
    }

    // Final summary
    logger.info("Backfill completed", {
      context: "backfill-patient-files",
      summary: {
        totalKeys: allKeys.length,
        processed,
        inserted,
        skipped,
        errors,
        dryRun: options.dryRun,
      },
    });

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN SUMMARY:");
      console.log(`📁 Total R2 objects found: ${allKeys.length}`);
      console.log(`✅ Would insert: ${inserted} patient file records`);
      console.log(`⏭️  Would skip: ${skipped} files (staff-only or unparseable)`);
      console.log(`❌ Would fail: ${errors} files`);
      console.log("\nRun without --dry-run to perform actual backfill.");
    } else {
      console.log("\n✅ BACKFILL COMPLETE:");
      console.log(`📁 Total R2 objects processed: ${allKeys.length}`);
      console.log(`✅ Successfully inserted: ${inserted} patient file records`);
      console.log(`⏭️  Skipped: ${skipped} files`);
      console.log(`❌ Failed: ${errors} files`);
    }

  } catch (err) {
    logger.error("Backfill failed", {
      context: "backfill-patient-files",
      error: err,
    });
    
    console.error("\n❌ BACKFILL FAILED:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// Validation and safety checks
async function validateEnvironment(): Promise<void> {
  // Check R2 configuration
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured. Check R2_* environment variables.");
  }

  // Check database connection
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("patient_files").select("id").limit(1);
    
    if (error && error.code !== "PGRST116") { // PGRST116 = no rows, which is fine
      throw new Error(`Database connection failed: ${error.message}`);
    }
  } catch (err) {
    throw new Error(`Database validation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  logger.info("Environment validation passed", {
    context: "backfill-patient-files",
  });
}

// Main execution
async function main(): Promise<void> {
  const options = parseArgs();
  
  console.log("🔧 Patient Files Backfill Script");
  console.log("================================");
  console.log(`Mode: ${options.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Clinic filter: ${options.clinicId || "ALL"}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log(`Max files: ${options.maxFiles || "UNLIMITED"}`);
  console.log("");

  try {
    // Validate environment
    await validateEnvironment();
    
    // Confirm execution for live runs
    if (!options.dryRun) {
      console.log("⚠️  WARNING: This will modify the database!");
      console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Run backfill
    await backfillPatientFiles(options);
    
  } catch (err) {
    logger.error("Script execution failed", {
      context: "backfill-patient-files",
      error: err,
    });
    
    console.error("\n❌ SCRIPT FAILED:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
}

export { backfillPatientFiles, parseR2Key, detectContentType };