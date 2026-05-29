/**
 * PHI/PII Compliance Utilities
 *
 * Adapted from ECC healthcare-phi-compliance skill.
 * Provides PHI data classification, leak vector checks,
 * and enhanced audit trail types for healthcare compliance.
 *
 * Applicable to Moroccan Law 09-08 and general healthcare data protection.
 */

import type { Json } from "@/lib/types/database";

// ── PHI Data Classification ──

export type PHICategory =
  | "patient_name"
  | "date_of_birth"
  | "address"
  | "phone"
  | "email"
  | "national_id"
  | "medical_record"
  | "diagnosis"
  | "medication"
  | "lab_result"
  | "imaging"
  | "insurance"
  | "appointment"
  | "financial";

export type PIICategory =
  | "clinician_details"
  | "fee_structure"
  | "salary"
  | "bank_details"
  | "vendor_payment";

// ── Enhanced Audit Entry (PHI-aware) ──

export type PHIAuditAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "print"
  | "export"
  | "sign"
  | "addendum"
  | "override";

export interface PHIAuditEntry {
  timestamp: string;
  userId: string;
  patientId: string;
  action: PHIAuditAction;
  resourceType: string;
  resourceId: string;
  clinicId: string;
  changes?: { before: Json; after: Json };
  ipAddress?: string;
  sessionId?: string;
  overrideReason?: string;
}

// ── PHI Leak Vector Checks ──

const PHI_PATTERNS = [
  /\b\d{2}\/\d{2}\/\d{4}\b/, // Date of birth patterns
  /\b[A-Z]{1,2}\d{6,}\b/, // National ID patterns (Moroccan CIN, etc.)
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/, // SSN-like patterns
];

/**
 * Check if a string potentially contains PHI data that should not be exposed.
 * Use this before logging, error messages, or URL parameters.
 */
export function containsPotentialPHI(text: string): boolean {
  return PHI_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Sanitize an error message by removing potential PHI.
 * Returns a safe error message suitable for client-facing responses.
 */
export function sanitizeErrorMessage(message: string): string {
  if (containsPotentialPHI(message)) {
    return "Une erreur s'est produite. Veuillez réessayer.";
  }
  return message;
}

/**
 * Create a safe log entry that only includes opaque UUIDs, not PHI.
 * Use this instead of logging full patient objects.
 */
export function safeLogContext(context: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (
      key === "id" ||
      key.endsWith("Id") ||
      key.endsWith("_id") ||
      key === "clinicId" ||
      key === "action" ||
      key === "type" ||
      key === "context" ||
      key === "status"
    ) {
      safe[key] = value;
    }
  }
  return safe;
}

// ── Deployment Security Checklist ──

export interface DeploymentCheckItem {
  id: string;
  category: string;
  description: string;
  critical: boolean;
}

export const DEPLOYMENT_SECURITY_CHECKLIST: DeploymentCheckItem[] = [
  {
    id: "phi-error-messages",
    category: "PHI",
    description: "Pas de PHI dans les messages d'erreur ou les stack traces",
    critical: true,
  },
  {
    id: "phi-console-log",
    category: "PHI",
    description: "Pas de PHI dans console.log/console.error",
    critical: true,
  },
  {
    id: "phi-url-params",
    category: "PHI",
    description: "Pas de PHI dans les paramètres URL",
    critical: true,
  },
  {
    id: "phi-browser-storage",
    category: "PHI",
    description: "Pas de PHI dans localStorage ou sessionStorage",
    critical: true,
  },
  {
    id: "service-role-key",
    category: "Sécurité",
    description: "Pas de clé service_role dans le code client",
    critical: true,
  },
  {
    id: "rls-enabled",
    category: "Base de données",
    description: "RLS activé sur toutes les tables PHI/PII",
    critical: true,
  },
  {
    id: "audit-trail",
    category: "Conformité",
    description: "Journal d'audit pour toutes les modifications de données",
    critical: true,
  },
  {
    id: "session-timeout",
    category: "Sécurité",
    description: "Délai d'expiration de session configuré",
    critical: false,
  },
  {
    id: "api-auth",
    category: "Sécurité",
    description: "Authentification API sur tous les endpoints PHI",
    critical: true,
  },
  {
    id: "clinic-isolation",
    category: "Multi-tenant",
    description: "Isolation des données inter-cliniques vérifiée",
    critical: true,
  },
  {
    id: "cloudflare-headers",
    category: "Déploiement",
    description: "En-têtes de sécurité configurés dans Cloudflare Workers",
    critical: false,
  },
  {
    id: "encryption-at-rest",
    category: "PHI",
    description: "Chiffrement AES-256-GCM pour les fichiers patients dans R2",
    critical: true,
  },
];
