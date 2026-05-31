/**
 * HIPAA compliance scanner.
 *
 * Checks application state against HIPAA technical safeguard requirements.
 * While Oltigo primarily operates under Moroccan Law 09-08, HIPAA provides
 * a well-defined checklist for healthcare data protection.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ComplianceStatus = "compliant" | "non_compliant" | "partial" | "not_applicable";

export interface ComplianceCheck {
  id: string;
  category: string;
  requirement: string;
  status: ComplianceStatus;
  details: string;
  remediation: string | null;
}

export interface ComplianceReport {
  framework: string;
  generatedAt: string;
  overallStatus: ComplianceStatus;
  checks: ComplianceCheck[];
  compliantCount: number;
  nonCompliantCount: number;
  partialCount: number;
}

// ─── HIPAA Technical Safeguard Checks ────────────────────────────────────────

export interface SystemCapabilities {
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  auditLogging: boolean;
  accessControls: boolean;
  automaticLogoff: boolean;
  uniqueUserIds: boolean;
  emergencyAccess: boolean;
  integrityControls: boolean;
  transmissionSecurity: boolean;
  backupProcedures: boolean;
  disasterRecoveryPlan: boolean;
  dataDisposalPolicy: boolean;
}

export function runHIPAAChecks(capabilities: SystemCapabilities): ComplianceReport {
  const checks: ComplianceCheck[] = [
    {
      id: "164.312(a)(2)(iv)",
      category: "Access Control",
      requirement: "Encryption and decryption of ePHI",
      status: capabilities.encryptionAtRest ? "compliant" : "non_compliant",
      details: capabilities.encryptionAtRest
        ? "AES-256-GCM encryption applied to all PHI at rest"
        : "PHI stored without encryption",
      remediation: capabilities.encryptionAtRest
        ? null
        : "Implement AES-256-GCM encryption for all PHI storage",
    },
    {
      id: "164.312(e)(2)(ii)",
      category: "Transmission Security",
      requirement: "Encryption of ePHI in transit",
      status: capabilities.encryptionInTransit ? "compliant" : "non_compliant",
      details: capabilities.encryptionInTransit
        ? "TLS 1.3 enforced on all endpoints"
        : "Some endpoints lack TLS enforcement",
      remediation: capabilities.encryptionInTransit
        ? null
        : "Enforce TLS 1.3 minimum on all API endpoints",
    },
    {
      id: "164.312(b)",
      category: "Audit Controls",
      requirement: "Hardware, software, and procedural mechanisms to record and examine access",
      status: capabilities.auditLogging ? "compliant" : "non_compliant",
      details: capabilities.auditLogging
        ? "All PHI access logged with actor, timestamp, and action"
        : "Audit logging not fully implemented",
      remediation: capabilities.auditLogging
        ? null
        : "Implement comprehensive audit logging for all PHI access",
    },
    {
      id: "164.312(a)(1)",
      category: "Access Control",
      requirement: "Unique user identification",
      status: capabilities.uniqueUserIds ? "compliant" : "non_compliant",
      details: capabilities.uniqueUserIds
        ? "UUID-based unique user identification with RBAC"
        : "Shared accounts detected",
      remediation: capabilities.uniqueUserIds
        ? null
        : "Eliminate shared accounts; assign unique IDs to all users",
    },
    {
      id: "164.312(a)(2)(iii)",
      category: "Access Control",
      requirement: "Automatic logoff after inactivity",
      status: capabilities.automaticLogoff ? "compliant" : "partial",
      details: capabilities.automaticLogoff
        ? "Session timeout configured at 30 minutes"
        : "Session timeout not enforced",
      remediation: capabilities.automaticLogoff
        ? null
        : "Configure automatic session expiry after 30 minutes of inactivity",
    },
    {
      id: "164.312(c)(1)",
      category: "Integrity",
      requirement: "Mechanisms to protect ePHI from improper alteration or destruction",
      status: capabilities.integrityControls ? "compliant" : "non_compliant",
      details: capabilities.integrityControls
        ? "Row-level security and audit trails protect data integrity"
        : "Insufficient integrity controls",
      remediation: capabilities.integrityControls
        ? null
        : "Implement checksums and immutable audit trails",
    },
    {
      id: "164.308(a)(7)",
      category: "Contingency Plan",
      requirement: "Data backup and disaster recovery",
      status:
        capabilities.backupProcedures && capabilities.disasterRecoveryPlan
          ? "compliant"
          : capabilities.backupProcedures
            ? "partial"
            : "non_compliant",
      details:
        capabilities.backupProcedures && capabilities.disasterRecoveryPlan
          ? "Daily backups with tested disaster recovery"
          : "Backup or DR plan incomplete",
      remediation:
        capabilities.backupProcedures && capabilities.disasterRecoveryPlan
          ? null
          : "Implement daily automated backups with quarterly DR testing",
    },
    {
      id: "164.310(d)(2)(i)",
      category: "Device and Media Controls",
      requirement: "Disposal of ePHI media",
      status: capabilities.dataDisposalPolicy ? "compliant" : "non_compliant",
      details: capabilities.dataDisposalPolicy
        ? "Secure data disposal policy documented and enforced"
        : "No formal data disposal policy",
      remediation: capabilities.dataDisposalPolicy
        ? null
        : "Create and enforce a data disposal/sanitization policy",
    },
  ];

  const compliantCount = checks.filter((c) => c.status === "compliant").length;
  const nonCompliantCount = checks.filter((c) => c.status === "non_compliant").length;
  const partialCount = checks.filter((c) => c.status === "partial").length;

  const overallStatus: ComplianceStatus =
    nonCompliantCount > 0 ? "non_compliant" : partialCount > 0 ? "partial" : "compliant";

  return {
    framework: "HIPAA Technical Safeguards (45 CFR 164.312)",
    generatedAt: new Date().toISOString(),
    overallStatus,
    checks,
    compliantCount,
    nonCompliantCount,
    partialCount,
  };
}
