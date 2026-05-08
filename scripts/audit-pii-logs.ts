#!/usr/bin/env tsx
/**
 * PII Log Audit Script (A8-01)
 *
 * Scans production logs for PII patterns to ensure compliance.
 * Run weekly as part of security compliance checks.
 *
 * Usage:
 *   npm run audit:pii-logs
 *   tsx scripts/audit-pii-logs.ts --days 7 --format json
 *   tsx scripts/audit-pii-logs.ts --help
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { glob } from "glob";

// PII detection patterns (same as logger.ts)
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\+?[0-9]{6,}/g,
  moroccanPhone: /(\+212|0)[5-7][0-9]{8}/g,
  name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Simple name pattern
  uuid: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
};

// Sensitive field names that should be redacted
const SENSITIVE_FIELDS = [
  "email", "phone", "name", "full_name", "first_name", "last_name",
  "doctor_name", "clinic_name", "owner_name", "patient_name",
  "emergency_contact", "next_of_kin", "patient_address", "address",
  "contact_info", "personal_info", "medical_record_number", "mrn",
];

interface AuditOptions {
  days: number;
  logDir: string;
  format: "json" | "text";
  verbose: boolean;
  outputFile?: string;
  alertThreshold: number;
}

interface PiiViolation {
  timestamp: string;
  level: string;
  message: string;
  file: string;
  line: number;
  pattern: string;
  match: string;
  context: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

interface AuditResult {
  summary: {
    totalLogs: number;
    violationsFound: number;
    filesScanned: number;
    scanDuration: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
  };
  violations: PiiViolation[];
  recommendations: string[];
}

class PiiLogAuditor {
  private options: AuditOptions;
  private violations: PiiViolation[] = [];
  private totalLogs = 0;
  private filesScanned = 0;

  constructor(options: AuditOptions) {
    this.options = options;
  }

  async audit(): Promise<AuditResult> {
    const startTime = Date.now();
    
    console.log(`🔍 Starting PII log audit...`);
    console.log(`📅 Scanning logs from last ${this.options.days} days`);
    console.log(`📁 Log directory: ${this.options.logDir}`);

    try {
      const logFiles = await this.findLogFiles();
      
      if (logFiles.length === 0) {
        console.log("⚠️  No log files found");
        return this.buildResult(Date.now() - startTime);
      }

      console.log(`📄 Found ${logFiles.length} log files to scan`);

      for (const logFile of logFiles) {
        await this.scanLogFile(logFile);
      }

      const result = this.buildResult(Date.now() - startTime);
      await this.outputResult(result);
      
      return result;
    } catch (error) {
      console.error("❌ Audit failed:", error);
      throw error;
    }
  }

  private async findLogFiles(): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.days);

    // Look for log files in common locations
    const patterns = [
      join(this.options.logDir, "**/*.log"),
      join(this.options.logDir, "**/*.json"),
      join(this.options.logDir, "**/app-*.log"),
      join(this.options.logDir, "**/error-*.log"),
      join(this.options.logDir, "**/access-*.log"),
    ];

    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern);
        allFiles.push(...files);
      } catch (error) {
        if (this.options.verbose) {
          console.warn(`⚠️  Pattern ${pattern} failed:`, error);
        }
      }
    }

    // Filter by modification time
    const recentFiles = allFiles.filter(file => {
      try {
        const stats = require("fs").statSync(file);
        return stats.mtime >= cutoffDate;
      } catch {
        return false;
      }
    });

    return [...new Set(recentFiles)]; // Remove duplicates
  }

  private async scanLogFile(filePath: string): Promise<void> {
    if (this.options.verbose) {
      console.log(`📖 Scanning: ${filePath}`);
    }

    this.filesScanned++;
    let lineNumber = 0;

    try {
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        lineNumber++;
        this.totalLogs++;
        
        await this.scanLogLine(line, filePath, lineNumber);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to scan ${filePath}:`, error);
    }
  }

  private async scanLogLine(line: string, file: string, lineNumber: number): Promise<void> {
    try {
      // Try to parse as JSON log
      let logData: any;
      let timestamp = new Date().toISOString();
      let level = "unknown";
      let message = line;

      try {
        logData = JSON.parse(line);
        timestamp = logData.timestamp || logData.time || timestamp;
        level = logData.level || logData.severity || level;
        message = logData.message || logData.msg || line;
      } catch {
        // Not JSON, treat as plain text
        // Try to extract timestamp from common formats
        const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
        if (timestampMatch) {
          timestamp = timestampMatch[1];
        }
      }

      // Check for PII patterns
      await this.checkPiiPatterns(line, file, lineNumber, timestamp, level, message);
      
      // Check for sensitive field names in JSON logs
      if (logData) {
        await this.checkSensitiveFields(logData, file, lineNumber, timestamp, level);
      }

    } catch (error) {
      if (this.options.verbose) {
        console.warn(`⚠️  Error scanning line ${lineNumber} in ${file}:`, error);
      }
    }
  }

  private async checkPiiPatterns(
    line: string,
    file: string,
    lineNumber: number,
    timestamp: string,
    level: string,
    message: string
  ): Promise<void> {
    for (const [patternName, regex] of Object.entries(PII_PATTERNS)) {
      const matches = line.match(regex);
      
      if (matches) {
        for (const match of matches) {
          // Skip UUIDs as they're not PII
          if (patternName === "uuid") continue;
          
          // Skip if it looks like a redacted value
          if (match.includes("***") || match.includes("[REDACTED]")) continue;
          
          // Skip common false positives
          if (this.isFalsePositive(patternName, match)) continue;

          const violation: PiiViolation = {
            timestamp,
            level,
            message: message.substring(0, 200), // Truncate for safety
            file,
            line: lineNumber,
            pattern: patternName,
            match: this.maskPii(match),
            context: this.extractContext(line, match),
            severity: this.getSeverity(patternName, level),
          };

          this.violations.push(violation);
        }
      }
    }
  }

  private async checkSensitiveFields(
    logData: any,
    file: string,
    lineNumber: number,
    timestamp: string,
    level: string
  ): Promise<void> {
    const sensitiveFields = this.findSensitiveFields(logData);
    
    for (const fieldPath of sensitiveFields) {
      const violation: PiiViolation = {
        timestamp,
        level,
        message: "Sensitive field found in log metadata",
        file,
        line: lineNumber,
        pattern: "sensitive_field",
        match: fieldPath,
        context: `Field: ${fieldPath}`,
        severity: "HIGH",
      };

      this.violations.push(violation);
    }
  }

  private findSensitiveFields(obj: any, path = ""): string[] {
    const found: string[] = [];
    
    if (typeof obj !== "object" || obj === null) {
      return found;
    }

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check if field name is sensitive
      if (SENSITIVE_FIELDS.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        found.push(currentPath);
      }
      
      // Recursively check nested objects
      if (typeof value === "object" && value !== null) {
        found.push(...this.findSensitiveFields(value, currentPath));
      }
    }
    
    return found;
  }

  private isFalsePositive(patternName: string, match: string): boolean {
    switch (patternName) {
      case "email":
        // Skip common test/example emails
        return /example\.com|test\.com|localhost|noreply/i.test(match);
      
      case "phone":
        // Skip common test numbers or short numbers
        return match.length < 8 || /1234567|0000000|9999999/.test(match);
      
      case "name":
        // Skip common technical terms that look like names
        return /User Agent|Content Type|File Name|Class Name/i.test(match);
      
      default:
        return false;
    }
  }

  private maskPii(value: string): string {
    if (value.length <= 4) {
      return "***";
    }
    return value.substring(0, 2) + "***" + value.substring(value.length - 2);
  }

  private extractContext(line: string, match: string): string {
    const index = line.indexOf(match);
    const start = Math.max(0, index - 30);
    const end = Math.min(line.length, index + match.length + 30);
    
    let context = line.substring(start, end);
    
    // Replace the actual PII with masked version
    context = context.replace(match, this.maskPii(match));
    
    return context;
  }

  private getSeverity(patternName: string, level: string): "HIGH" | "MEDIUM" | "LOW" {
    // High severity for error logs or sensitive patterns
    if (level.toLowerCase() === "error" || patternName === "email") {
      return "HIGH";
    }
    
    // Medium severity for warn logs or phone numbers
    if (level.toLowerCase() === "warn" || patternName === "phone") {
      return "MEDIUM";
    }
    
    return "LOW";
  }

  private buildResult(scanDuration: number): AuditResult {
    const highSeverityCount = this.violations.filter(v => v.severity === "HIGH").length;
    const mediumSeverityCount = this.violations.filter(v => v.severity === "MEDIUM").length;
    const lowSeverityCount = this.violations.filter(v => v.severity === "LOW").length;

    const recommendations: string[] = [];
    
    if (this.violations.length > 0) {
      recommendations.push("🚨 PII detected in logs - immediate action required");
      recommendations.push("📝 Review and update logging statements to remove PII");
      recommendations.push("🔧 Ensure logger.redactPhi() is used for all user data");
      recommendations.push("🧪 Add unit tests to verify PII redaction");
    }
    
    if (highSeverityCount > 0) {
      recommendations.push("⚠️  High severity violations found - prioritize fixes");
    }
    
    if (this.violations.length > this.options.alertThreshold) {
      recommendations.push(`📊 Violation count (${this.violations.length}) exceeds threshold (${this.options.alertThreshold})`);
    }

    return {
      summary: {
        totalLogs: this.totalLogs,
        violationsFound: this.violations.length,
        filesScanned: this.filesScanned,
        scanDuration,
        highSeverityCount,
        mediumSeverityCount,
        lowSeverityCount,
      },
      violations: this.violations,
      recommendations,
    };
  }

  private async outputResult(result: AuditResult): Promise<void> {
    if (this.options.format === "json") {
      const output = JSON.stringify(result, null, 2);
      
      if (this.options.outputFile) {
        require("fs").writeFileSync(this.options.outputFile, output);
        console.log(`📄 Results written to: ${this.options.outputFile}`);
      } else {
        console.log(output);
      }
    } else {
      this.printTextReport(result);
    }
  }

  private printTextReport(result: AuditResult): void {
    console.log("\n" + "=".repeat(60));
    console.log("🔍 PII LOG AUDIT REPORT");
    console.log("=".repeat(60));
    
    console.log("\n📊 SUMMARY:");
    console.log(`   Files scanned: ${result.summary.filesScanned}`);
    console.log(`   Total log entries: ${result.summary.totalLogs}`);
    console.log(`   Scan duration: ${(result.summary.scanDuration / 1000).toFixed(2)}s`);
    console.log(`   Violations found: ${result.summary.violationsFound}`);
    
    if (result.summary.violationsFound > 0) {
      console.log(`   ├─ High severity: ${result.summary.highSeverityCount}`);
      console.log(`   ├─ Medium severity: ${result.summary.mediumSeverityCount}`);
      console.log(`   └─ Low severity: ${result.summary.lowSeverityCount}`);
    }

    if (result.violations.length > 0) {
      console.log("\n🚨 VIOLATIONS:");
      
      // Group by severity
      const byFile = result.violations.reduce((acc, v) => {
        if (!acc[v.file]) acc[v.file] = [];
        acc[v.file].push(v);
        return acc;
      }, {} as Record<string, PiiViolation[]>);

      for (const [file, violations] of Object.entries(byFile)) {
        console.log(`\n📄 ${file}:`);
        
        for (const violation of violations.slice(0, 10)) { // Limit output
          console.log(`   Line ${violation.line}: [${violation.severity}] ${violation.pattern}`);
          console.log(`   Context: ${violation.context}`);
        }
        
        if (violations.length > 10) {
          console.log(`   ... and ${violations.length - 10} more violations`);
        }
      }
    }

    if (result.recommendations.length > 0) {
      console.log("\n💡 RECOMMENDATIONS:");
      for (const rec of result.recommendations) {
        console.log(`   ${rec}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    
    if (result.summary.violationsFound === 0) {
      console.log("✅ No PII violations found - logs are compliant!");
    } else {
      console.log(`❌ ${result.summary.violationsFound} PII violations found - action required!`);
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
PII Log Audit Script

Usage:
  tsx scripts/audit-pii-logs.ts [options]

Options:
  --days <number>        Days of logs to scan (default: 7)
  --log-dir <path>       Log directory path (default: ./logs)
  --format <json|text>   Output format (default: text)
  --output <file>        Output file (default: stdout)
  --verbose              Verbose output
  --threshold <number>   Alert threshold (default: 0)
  --help                 Show this help

Examples:
  tsx scripts/audit-pii-logs.ts --days 30 --format json
  tsx scripts/audit-pii-logs.ts --log-dir /var/log/app --verbose
  tsx scripts/audit-pii-logs.ts --output audit-report.json
`);
    process.exit(0);
  }

  const options: AuditOptions = {
    days: parseInt(getArg(args, "--days") || "7"),
    logDir: getArg(args, "--log-dir") || "./logs",
    format: (getArg(args, "--format") as "json" | "text") || "text",
    verbose: args.includes("--verbose"),
    outputFile: getArg(args, "--output"),
    alertThreshold: parseInt(getArg(args, "--threshold") || "0"),
  };

  // Validate options
  if (!existsSync(options.logDir)) {
    console.error(`❌ Log directory not found: ${options.logDir}`);
    process.exit(1);
  }

  if (options.days < 1 || options.days > 365) {
    console.error("❌ Days must be between 1 and 365");
    process.exit(1);
  }

  try {
    const auditor = new PiiLogAuditor(options);
    await auditor.audit();
  } catch (error) {
    console.error("❌ Audit failed:", error);
    process.exit(1);
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { PiiLogAuditor, type AuditOptions, type AuditResult, type PiiViolation };