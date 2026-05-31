/**
 * Moroccan Law 09-08 compliance checker.
 *
 * Law 09-08 (relative à la protection des personnes physiques à l'égard
 * du traitement des données à caractère personnel) governs personal data
 * processing in Morocco. This module validates application compliance
 * against key requirements.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ComplianceStatus = "compliant" | "non_compliant" | "partial";

export interface Law0908Check {
  id: string;
  article: string;
  requirement: string;
  status: ComplianceStatus;
  details: string;
  remediation: string | null;
}

export interface Law0908Report {
  framework: string;
  generatedAt: string;
  overallStatus: ComplianceStatus;
  checks: Law0908Check[];
  compliantCount: number;
  nonCompliantCount: number;
}

// ─── System State Interface ──────────────────────────────────────────────────

export interface DataProcessingState {
  consentCollected: boolean;
  purposeLimitation: boolean;
  dataMinimization: boolean;
  retentionPolicyDefined: boolean;
  cndpRegistered: boolean;
  crossBorderTransferSafeguards: boolean;
  dataSubjectRightsImplemented: boolean;
  securityMeasuresDocumented: boolean;
  dataProcessorAgreements: boolean;
  breachNotificationProcess: boolean;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export function runLaw0908Checks(state: DataProcessingState): Law0908Report {
  const checks: Law0908Check[] = [
    {
      id: "L09-08-ART4",
      article: "Article 4",
      requirement: "Consent: data subjects must provide informed consent",
      status: state.consentCollected ? "compliant" : "non_compliant",
      details: state.consentCollected
        ? "Explicit consent collected before data processing"
        : "Consent mechanism missing or insufficient",
      remediation: state.consentCollected
        ? null
        : "Implement explicit consent collection with records of consent",
    },
    {
      id: "L09-08-ART3",
      article: "Article 3",
      requirement: "Purpose limitation: data processed only for declared purposes",
      status: state.purposeLimitation ? "compliant" : "non_compliant",
      details: state.purposeLimitation
        ? "Data processing limited to declared healthcare purposes"
        : "Data used beyond declared purposes",
      remediation: state.purposeLimitation
        ? null
        : "Document and enforce purpose limitation for all data processing",
    },
    {
      id: "L09-08-ART3-B",
      article: "Article 3(b)",
      requirement: "Data minimization: collect only necessary data",
      status: state.dataMinimization ? "compliant" : "partial",
      details: state.dataMinimization
        ? "Only clinically necessary data collected"
        : "Some forms collect more data than required",
      remediation: state.dataMinimization
        ? null
        : "Audit all data collection forms for minimization compliance",
    },
    {
      id: "L09-08-ART3-E",
      article: "Article 3(e)",
      requirement: "Retention: data kept no longer than necessary",
      status: state.retentionPolicyDefined ? "compliant" : "non_compliant",
      details: state.retentionPolicyDefined
        ? "Retention periods defined per data category (medical: 20 years)"
        : "No formal retention policy",
      remediation: state.retentionPolicyDefined
        ? null
        : "Define retention periods for each data category and implement automated purging",
    },
    {
      id: "L09-08-ART12",
      article: "Article 12",
      requirement: "CNDP registration: processing must be declared to CNDP",
      status: state.cndpRegistered ? "compliant" : "non_compliant",
      details: state.cndpRegistered
        ? "Processing registered with Commission Nationale de protection des Données Personnelles"
        : "CNDP registration not completed",
      remediation: state.cndpRegistered
        ? null
        : "Submit data processing declaration to CNDP (cndp.ma)",
    },
    {
      id: "L09-08-ART43",
      article: "Article 43",
      requirement: "Cross-border transfer: adequate safeguards for international transfers",
      status: state.crossBorderTransferSafeguards ? "compliant" : "non_compliant",
      details: state.crossBorderTransferSafeguards
        ? "Standard contractual clauses in place for all international transfers"
        : "International data transfers lack adequate safeguards",
      remediation: state.crossBorderTransferSafeguards
        ? null
        : "Implement SCCs or obtain CNDP authorization for cross-border transfers",
    },
    {
      id: "L09-08-ART7-8",
      article: "Articles 7-8",
      requirement: "Data subject rights: access, rectification, opposition, deletion",
      status: state.dataSubjectRightsImplemented ? "compliant" : "partial",
      details: state.dataSubjectRightsImplemented
        ? "All data subject rights implemented with response within 30 days"
        : "Some data subject rights not fully implemented",
      remediation: state.dataSubjectRightsImplemented
        ? null
        : "Implement all ARCO rights (Access, Rectification, Cancellation, Opposition)",
    },
    {
      id: "L09-08-ART23",
      article: "Article 23",
      requirement: "Security: appropriate technical and organizational measures",
      status: state.securityMeasuresDocumented ? "compliant" : "non_compliant",
      details: state.securityMeasuresDocumented
        ? "Security measures documented and regularly reviewed"
        : "Security measures not formally documented",
      remediation: state.securityMeasuresDocumented
        ? null
        : "Document all security measures and schedule periodic reviews",
    },
    {
      id: "L09-08-ART21",
      article: "Article 21",
      requirement: "Data processor agreements: written contracts with sub-processors",
      status: state.dataProcessorAgreements ? "compliant" : "non_compliant",
      details: state.dataProcessorAgreements
        ? "DPA signed with all sub-processors (Supabase, Cloudflare, Stripe)"
        : "Missing data processor agreements",
      remediation: state.dataProcessorAgreements
        ? null
        : "Execute DPAs with all third-party data processors",
    },
    {
      id: "L09-08-BREACH",
      article: "Regulatory guidance",
      requirement: "Breach notification: notify CNDP and affected individuals",
      status: state.breachNotificationProcess ? "compliant" : "non_compliant",
      details: state.breachNotificationProcess
        ? "Breach notification process documented with 72-hour timeline"
        : "No formal breach notification process",
      remediation: state.breachNotificationProcess
        ? null
        : "Establish breach notification process with 72h CNDP notification deadline",
    },
  ];

  const compliantCount = checks.filter((c) => c.status === "compliant").length;
  const nonCompliantCount = checks.filter((c) => c.status === "non_compliant").length;

  const overallStatus: ComplianceStatus = nonCompliantCount > 0 ? "non_compliant" : "compliant";

  return {
    framework: "Moroccan Law 09-08 (Protection des Données Personnelles)",
    generatedAt: new Date().toISOString(),
    overallStatus,
    checks,
    compliantCount,
    nonCompliantCount,
  };
}
