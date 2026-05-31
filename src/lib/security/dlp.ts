/**
 * Data Loss Prevention (DLP) engine.
 *
 * Scans outbound content for PHI patterns and prevents unintentional
 * data exfiltration. Returns actionable findings with severity levels.
 */

import { logger } from "@/lib/logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DLPSeverity = "critical" | "high" | "medium" | "low";

export interface DLPFinding {
  pattern: string;
  severity: DLPSeverity;
  matchedText: string;
  startIndex: number;
  endIndex: number;
  recommendation: string;
}

export interface DLPScanResult {
  hasSensitiveData: boolean;
  blocked: boolean;
  findings: DLPFinding[];
  scannedAt: string;
}

// ─── PHI Detection Patterns ──────────────────────────────────────────────────

interface PHIPattern {
  name: string;
  regex: RegExp;
  severity: DLPSeverity;
  recommendation: string;
}

const PHI_PATTERNS: PHIPattern[] = [
  {
    name: "moroccan_cin",
    regex: /\b[A-Z]{1,2}\d{5,7}\b/g,
    severity: "high",
    recommendation: "Moroccan CIN detected — mask or remove before transmission",
  },
  {
    name: "moroccan_phone",
    regex: /\+212[5-7]\d{8}\b/g,
    severity: "medium",
    recommendation: "Moroccan phone number detected — verify consent before sharing",
  },
  {
    name: "email_address",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: "low",
    recommendation: "Email address detected — confirm intended recipient",
  },
  {
    name: "credit_card",
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    severity: "critical",
    recommendation: "Credit card number detected — never transmit in plaintext",
  },
  {
    name: "iban_morocco",
    regex: /\bMA\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/gi,
    severity: "high",
    recommendation: "Moroccan IBAN detected — sensitive financial data",
  },
  {
    name: "date_of_birth",
    regex: /\b(?:0[1-9]|[12]\d|3[01])[-/](?:0[1-9]|1[0-2])[-/](?:19|20)\d{2}\b/g,
    severity: "medium",
    recommendation: "Date of birth pattern detected — potential PHI",
  },
  {
    name: "medical_record_number",
    regex: /\bMRN[-:]?\s*\d{6,10}\b/gi,
    severity: "critical",
    recommendation: "Medical record number detected — must not leave system boundary",
  },
  {
    name: "blood_type",
    regex: /\b(?:A|B|AB|O)[+-]\b/g,
    severity: "medium",
    recommendation: "Blood type detected — contextual PHI",
  },
];

// ─── Implementation ──────────────────────────────────────────────────────────

export function scanForPHI(content: string): DLPScanResult {
  const findings: DLPFinding[] = [];

  for (const pattern of PHI_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      findings.push({
        pattern: pattern.name,
        severity: pattern.severity,
        matchedText: maskSensitive(match[0]),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        recommendation: pattern.recommendation,
      });
    }
  }

  const hasSensitiveData = findings.length > 0;
  const blocked = findings.some((f) => f.severity === "critical");

  if (blocked) {
    logger.warn("DLP blocked outbound content", {
      findingCount: findings.length,
      criticalCount: findings.filter((f) => f.severity === "critical").length,
    });
  }

  return {
    hasSensitiveData,
    blocked,
    findings,
    scannedAt: new Date().toISOString(),
  };
}

export function redactPHI(content: string): string {
  let redacted = content;

  for (const pattern of PHI_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    redacted = redacted.replace(regex, () => "[REDACTED-" + pattern.name.toUpperCase() + "]");
  }

  return redacted;
}

function maskSensitive(text: string): string {
  if (text.length <= 4) return "****";
  return text.slice(0, 2) + "*".repeat(text.length - 4) + text.slice(-2);
}
