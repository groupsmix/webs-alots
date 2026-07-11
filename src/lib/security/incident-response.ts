/**
 * Security incident response system.
 *
 * Provides incident classification, containment procedures,
 * and structured documentation for compliance reporting.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

type IncidentSeverity = "critical" | "high" | "medium" | "low";
type IncidentStatus = "reported" | "investigating" | "contained" | "resolved" | "closed";
export type IncidentCategory =
  | "data_breach"
  | "unauthorized_access"
  | "malware"
  | "phishing"
  | "service_disruption"
  | "policy_violation"
  | "other";

export interface SecurityIncident {
  id: string;
  clinicId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  reportedBy: string;
  reportedAt: string;
  containedAt: string | null;
  resolvedAt: string | null;
  affectedSystems: string[];
  affectedPatientCount: number | null;
  containmentActions: string[];
  remediationSteps: string[];
  rootCause: string | null;
  lessonsLearned: string | null;
}

export interface IncidentCreateInput {
  clinicId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  description: string;
  reportedBy: string;
  affectedSystems: string[];
  affectedPatientCount: number | null;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export function createIncident(input: IncidentCreateInput): SecurityIncident {
  return {
    id: crypto.randomUUID(),
    clinicId: input.clinicId,
    category: input.category,
    severity: input.severity,
    status: "reported",
    title: input.title,
    description: input.description,
    reportedBy: input.reportedBy,
    reportedAt: new Date().toISOString(),
    containedAt: null,
    resolvedAt: null,
    affectedSystems: input.affectedSystems,
    affectedPatientCount: input.affectedPatientCount,
    containmentActions: [],
    remediationSteps: [],
    rootCause: null,
    lessonsLearned: null,
  };
}

export function getContainmentProcedures(category: IncidentCategory): string[] {
  switch (category) {
    case "data_breach":
      return [
        "Revoke compromised credentials immediately",
        "Isolate affected systems from network",
        "Preserve forensic evidence (logs, memory dumps)",
        "Notify DPO within 1 hour (Moroccan Law 09-08)",
        "Document all patient records potentially exposed",
      ];
    case "unauthorized_access":
      return [
        "Disable compromised user accounts",
        "Force logout all sessions for affected accounts",
        "Review audit logs for access scope",
        "Reset credentials for affected systems",
        "Enable additional monitoring on affected endpoints",
      ];
    case "malware":
      return [
        "Isolate infected endpoints from network",
        "Block identified IOCs at firewall",
        "Scan all connected systems",
        "Preserve malware samples for analysis",
        "Verify backup integrity",
      ];
    case "phishing":
      return [
        "Block sender domain/address",
        "Identify all recipients who opened the message",
        "Reset credentials for anyone who interacted",
        "Scan for secondary payloads",
        "Issue staff alert notification",
      ];
    case "service_disruption":
      return [
        "Activate failover procedures",
        "Identify root cause of disruption",
        "Communicate status to affected users",
        "Monitor for cascading failures",
        "Document timeline of events",
      ];
    case "policy_violation":
      return [
        "Document the violation details",
        "Preserve evidence of the violation",
        "Restrict access for involved parties",
        "Notify compliance officer",
        "Schedule investigation interview",
      ];
    default:
      return [
        "Document the incident details",
        "Assess potential impact",
        "Notify security team",
        "Preserve relevant logs",
      ];
  }
}
