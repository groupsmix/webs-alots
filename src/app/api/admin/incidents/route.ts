import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import {
  createIncident,
  getContainmentProcedures,
  type IncidentCategory,
} from "@/lib/security/incident-response";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const incidentSchema = z.object({
  category: z.enum([
    "data_breach",
    "unauthorized_access",
    "malware",
    "phishing",
    "service_disruption",
    "policy_violation",
    "other",
  ]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  affectedSystems: z.array(z.string().max(100)).max(20).default([]),
  affectedPatientCount: z.number().int().min(0).nullable().default(null),
});

async function handlePost(request: NextRequest, auth: AuthContext) {
  const body: unknown = await request.json().catch(() => null);
  if (!body) {
    return apiValidationError("Invalid JSON body");
  }

  const parsed = incidentSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic context", 403);
  }

  const incident = createIncident({
    clinicId,
    category: parsed.data.category,
    severity: parsed.data.severity,
    title: parsed.data.title,
    description: parsed.data.description,
    reportedBy: auth.user.id,
    affectedSystems: parsed.data.affectedSystems,
    affectedPatientCount: parsed.data.affectedPatientCount,
  });

  const containmentProcedures = getContainmentProcedures(parsed.data.category as IncidentCategory);

  await logAuditEvent({
    supabase: auth.supabase,
    type: "security",
    action: "security_incident_reported",
    clinicId,
    actor: auth.user.id,
    metadata: {
      incidentId: incident.id,
      category: incident.category,
      severity: incident.severity,
      title: incident.title,
    },
  });

  return apiSuccess({
    incident,
    containmentProcedures,
  });
}

export const POST = withAuth(handlePost, ["clinic_admin", "super_admin"]);
