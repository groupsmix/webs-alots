import {
  applyHealthScoreTrend,
  computeClinicHealthScore,
  type ClinicSignals,
} from "@/lib/ai/clinic-health-score";

const HEALTH_GRADES = ["A", "B", "C", "D", "F"] as const;
const HEALTH_TRENDS = ["improving", "stable", "declining"] as const;
const HEALTH_RISKS = ["low", "medium", "high", "critical"] as const;

const SIGNAL_LABELS: Record<string, string> = {
  loginFrequency: "fréquence de connexion",
  appointmentBookingRate: "taux de rendez-vous confirmés",
  noShowRateInverted: "présence aux rendez-vous",
  featureAdoption: "adoption des fonctionnalités",
  paymentHealthy: "santé de paiement",
  negativeSupportRateInverted: "qualité du support",
};

export type HealthGrade = (typeof HEALTH_GRADES)[number];
export type HealthTrend = (typeof HEALTH_TRENDS)[number];
export type HealthRisk = (typeof HEALTH_RISKS)[number];

export type OwnerClinicSignals = ClinicSignals;

export interface LatestClinicHealthScoreRow {
  clinic_id: string;
  score: number | null;
  grade: string | null;
  churn_risk: string | null;
  trend: string | null;
  top_risk_signal: string | null;
  top_strength_signal: string | null;
  signals_snapshot: unknown;
  computed_at: string;
}

export interface BaseClinicHealthRecord {
  clinicId: string;
  clinicName: string;
  score: number;
  grade: HealthGrade;
  topRiskSignal: string;
  topStrengthSignal: string;
  trend: HealthTrend;
  churnRisk: HealthRisk;
  computedAt: string;
}

export interface ComputedClinicHealthRecord extends BaseClinicHealthRecord {
  previousScore: number | null;
  signalsSnapshot: Record<string, unknown>;
}

export interface PersistedClinicHealthRecord extends BaseClinicHealthRecord {
  signalsSnapshot: Record<string, unknown>;
}

export interface HealthScoreSummary {
  totalClinics: number;
  averageScore: number;
  countsByGrade: Record<HealthGrade, number>;
  countsByRisk: Record<HealthRisk, number>;
  improvingCount: number;
  decliningCount: number;
  topAtRisk: Array<Pick<BaseClinicHealthRecord, "clinicId" | "clinicName" | "score" | "churnRisk" | "trend" | "topRiskSignal">>;
  topPerformers: Array<Pick<BaseClinicHealthRecord, "clinicId" | "clinicName" | "score" | "grade" | "topStrengthSignal">>;
}

export interface PlatformAlertDraft {
  clinic_id: string;
  alert_type: string;
  message: string;
  severity: "info" | "warning" | "critical";
  is_read: boolean;
  created_at: string;
}

export type ApprovedAdminQueryId =
  | "top_at_risk_clinics"
  | "best_performing_clinics"
  | "stalled_onboardings"
  | "critical_platform_alerts"
  | "support_backlog";

export interface ApprovedAdminQueryDefinition {
  id: ApprovedAdminQueryId;
  title: string;
  description: string;
  keywords: string[];
  supportsClinicFilter: boolean;
  buildSql: (params: { limit: number; clinicId?: string | null }) => string;
}

const APPROVED_ADMIN_QUERIES: ApprovedAdminQueryDefinition[] = [
  {
    id: "top_at_risk_clinics",
    title: "Cliniques à risque",
    description: "Liste les cliniques avec le plus faible health score récent.",
    keywords: ["risk", "risque", "churn", "watch", "danger", "critique", "declin"],
    supportsClinicFilter: true,
    buildSql: ({ limit, clinicId }) => `
WITH latest_scores AS (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    score,
    grade,
    churn_risk,
    trend,
    top_risk_signal,
    computed_at
  FROM clinic_health_scores
  ORDER BY clinic_id, computed_at DESC
)
SELECT
  c.id,
  c.name,
  c.tier,
  c.status,
  ls.score,
  ls.grade,
  ls.churn_risk,
  ls.trend,
  ls.top_risk_signal,
  ls.computed_at
FROM latest_scores ls
JOIN clinics c ON c.id = ls.clinic_id
WHERE c.deleted_at IS NULL${buildClinicFilter("c.id", clinicId)}
ORDER BY ls.score ASC, ls.computed_at DESC
LIMIT ${limit}`,
  },
  {
    id: "best_performing_clinics",
    title: "Cliniques les plus performantes",
    description: "Liste les cliniques avec le meilleur health score récent.",
    keywords: ["best", "healthy", "healthiest", "perform", "meilleures", "fortes", "top"],
    supportsClinicFilter: true,
    buildSql: ({ limit, clinicId }) => `
WITH latest_scores AS (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    score,
    grade,
    churn_risk,
    trend,
    top_strength_signal,
    computed_at
  FROM clinic_health_scores
  ORDER BY clinic_id, computed_at DESC
)
SELECT
  c.id,
  c.name,
  c.tier,
  c.status,
  ls.score,
  ls.grade,
  ls.churn_risk,
  ls.trend,
  ls.top_strength_signal,
  ls.computed_at
FROM latest_scores ls
JOIN clinics c ON c.id = ls.clinic_id
WHERE c.deleted_at IS NULL${buildClinicFilter("c.id", clinicId)}
ORDER BY ls.score DESC, ls.computed_at DESC
LIMIT ${limit}`,
  },
  {
    id: "stalled_onboardings",
    title: "Onboardings bloqués",
    description: "Cliniques en onboarding bloqué depuis plus de 3 jours.",
    keywords: ["onboarding", "stuck", "bloque", "pending", "nudge", "activation"],
    supportsClinicFilter: true,
    buildSql: ({ limit, clinicId }) => `
SELECT
  co.id,
  co.clinic_id,
  co.clinic_name,
  co.specialty,
  co.status,
  co.current_step,
  co.completion_percentage,
  co.nudge_count,
  co.step_entered_at,
  co.last_nudge_at
FROM clinic_onboardings co
WHERE co.status IN ('pending', 'in_progress')
  AND co.step_entered_at < now() - interval '3 days'${buildClinicFilter("co.clinic_id", clinicId)}
ORDER BY co.step_entered_at ASC
LIMIT ${limit}`,
  },
  {
    id: "critical_platform_alerts",
    title: "Alertes critiques non lues",
    description: "Alertes plateforme critiques non lues par clinique.",
    keywords: ["alert", "alerte", "incident", "warning", "critical", "urgent"],
    supportsClinicFilter: true,
    buildSql: ({ limit, clinicId }) => `
SELECT
  pa.id,
  pa.clinic_id,
  c.name AS clinic_name,
  pa.alert_type,
  pa.severity,
  pa.created_at
FROM platform_alerts pa
LEFT JOIN clinics c ON c.id = pa.clinic_id
WHERE pa.is_read = false
  AND pa.severity = 'critical'${buildClinicFilter("pa.clinic_id", clinicId)}
ORDER BY pa.created_at DESC
LIMIT ${limit}`,
  },
  {
    id: "support_backlog",
    title: "Backlog support par équipe",
    description: "Charge support en cours par membre de l'équipe interne.",
    keywords: ["support", "ticket", "backlog", "team", "equipe", "assignment", "triage"],
    supportsClinicFilter: false,
    buildSql: ({ limit }) => `
SELECT
  tm.id AS team_member_id,
  tm.name,
  tm.role,
  tm.is_available,
  tm.current_ticket_count,
  COUNT(st.id) FILTER (WHERE st.status IN ('open', 'in_progress')) AS open_tickets,
  COUNT(st.id) FILTER (WHERE st.ai_priority IN ('critical', 'high')) AS urgent_ai_tickets
FROM team_members tm
LEFT JOIN support_tickets st ON st.assigned_team_member_id = tm.id
GROUP BY tm.id, tm.name, tm.role, tm.is_available, tm.current_ticket_count
ORDER BY open_tickets DESC, tm.current_ticket_count DESC, tm.name ASC
LIMIT ${limit}`,
  },
];

function buildClinicFilter(column: string, clinicId?: string | null): string {
  return clinicId ? `\n  AND ${column} = '${clinicId}'` : "";
}

function clampScore(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function asGrade(value: string | null | undefined): HealthGrade {
  return (HEALTH_GRADES as readonly string[]).includes(value ?? "")
    ? (value as HealthGrade)
    : "F";
}

function asTrend(value: string | null | undefined): HealthTrend {
  return (HEALTH_TRENDS as readonly string[]).includes(value ?? "")
    ? (value as HealthTrend)
    : "stable";
}

function asRisk(value: string | null | undefined): HealthRisk {
  return (HEALTH_RISKS as readonly string[]).includes(value ?? "")
    ? (value as HealthRisk)
    : "medium";
}

function asSnapshot(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function displaySignal(signal: string | null | undefined): string {
  if (!signal) return "signal indisponible";
  return SIGNAL_LABELS[signal] ?? signal;
}

function normalizeQuestion(question: string): string {
  return question
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function computeHealthScoreRecords(
  signalRows: OwnerClinicSignals[],
  previousScores: Map<string, number | null | undefined>,
): ComputedClinicHealthRecord[] {
  return signalRows
    .map((signals) => {
      const computed = applyHealthScoreTrend(
        computeClinicHealthScore(signals),
        previousScores.get(signals.clinicId) ?? null,
      );

      return {
        ...computed,
        clinicName: signals.clinicName,
        previousScore: previousScores.get(signals.clinicId) ?? null,
        signalsSnapshot: {
          loginFrequency: signals.loginFrequency,
          appointmentBookingRate: signals.appointmentBookingRate,
          noShowRate: signals.noShowRate,
          featureAdoption: signals.featureAdoption,
          paymentHealthy: signals.paymentHealthy,
          negativeSupportRate: signals.negativeSupportRate,
          lastLoginDaysAgo: signals.lastLoginDaysAgo,
          totalAppointments7d: signals.totalAppointments7d,
          planTier: signals.planTier,
        },
      } satisfies ComputedClinicHealthRecord;
    })
    .sort((a, b) => a.score - b.score || a.clinicName.localeCompare(b.clinicName));
}

export function toLatestHealthRows(
  rows: LatestClinicHealthScoreRow[],
  clinicId?: string | null,
): LatestClinicHealthScoreRow[] {
  const latest = new Map<string, LatestClinicHealthScoreRow>();
  for (const row of rows) {
    if (clinicId && row.clinic_id !== clinicId) continue;
    if (!latest.has(row.clinic_id)) {
      latest.set(row.clinic_id, row);
    }
  }
  return [...latest.values()];
}

export function mapLatestHealthRowsToRecords(
  rows: LatestClinicHealthScoreRow[],
  clinicNames: Map<string, string>,
): PersistedClinicHealthRecord[] {
  return rows
    .map((row) => ({
      clinicId: row.clinic_id,
      clinicName: clinicNames.get(row.clinic_id) ?? "Clinique inconnue",
      score: clampScore(row.score),
      grade: asGrade(row.grade),
      topRiskSignal: row.top_risk_signal ?? "unknown",
      topStrengthSignal: row.top_strength_signal ?? "unknown",
      trend: asTrend(row.trend),
      churnRisk: asRisk(row.churn_risk),
      computedAt: row.computed_at,
      signalsSnapshot: asSnapshot(row.signals_snapshot),
    }))
    .sort((a, b) => a.score - b.score || a.clinicName.localeCompare(b.clinicName));
}

export function summariseHealthScores<T extends BaseClinicHealthRecord>(
  records: T[],
): HealthScoreSummary {
  const countsByGrade: Record<HealthGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const countsByRisk: Record<HealthRisk, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  let improvingCount = 0;
  let decliningCount = 0;
  let totalScore = 0;

  for (const record of records) {
    countsByGrade[record.grade]++;
    countsByRisk[record.churnRisk]++;
    totalScore += record.score;
    if (record.trend === "improving") improvingCount++;
    if (record.trend === "declining") decliningCount++;
  }

  const averageScore = records.length > 0 ? Math.round(totalScore / records.length) : 0;

  return {
    totalClinics: records.length,
    averageScore,
    countsByGrade,
    countsByRisk,
    improvingCount,
    decliningCount,
    topAtRisk: records.slice(0, 5).map((record) => ({
      clinicId: record.clinicId,
      clinicName: record.clinicName,
      score: record.score,
      churnRisk: record.churnRisk,
      trend: record.trend,
      topRiskSignal: record.topRiskSignal,
    })),
    topPerformers: [...records]
      .sort((a, b) => b.score - a.score || a.clinicName.localeCompare(b.clinicName))
      .slice(0, 5)
      .map((record) => ({
        clinicId: record.clinicId,
        clinicName: record.clinicName,
        score: record.score,
        grade: record.grade,
        topStrengthSignal: record.topStrengthSignal,
      })),
  };
}

export function buildPlatformAlerts(records: ComputedClinicHealthRecord[]): PlatformAlertDraft[] {
  const createdAt = new Date().toISOString();
  const alerts: PlatformAlertDraft[] = [];

  for (const record of records) {
    if (record.churnRisk === "critical") {
      alerts.push({
        clinic_id: record.clinicId,
        alert_type: "clinic_health_critical",
        severity: "critical",
        message: `${record.clinicName} est en risque critique (${record.score}/100). Principal risque: ${displaySignal(record.topRiskSignal)}.`,
        is_read: false,
        created_at: createdAt,
      });
    } else if (record.churnRisk === "high") {
      alerts.push({
        clinic_id: record.clinicId,
        alert_type: "clinic_health_high_risk",
        severity: "warning",
        message: `${record.clinicName} nécessite un suivi: health score ${record.score}/100, risque élevé lié à ${displaySignal(record.topRiskSignal)}.`,
        is_read: false,
        created_at: createdAt,
      });
    }

    if (record.trend === "declining" && typeof record.previousScore === "number") {
      alerts.push({
        clinic_id: record.clinicId,
        alert_type: "clinic_health_declining",
        severity: record.score < 50 ? "critical" : "warning",
        message: `${record.clinicName} recule de ${Math.abs(record.score - record.previousScore)} points (de ${record.previousScore} à ${record.score}).`,
        is_read: false,
        created_at: createdAt,
      });
    }
  }

  return alerts;
}

export function buildPlatformNarrativeFallback(params: {
  summary: HealthScoreSummary;
  unreadAlerts: number;
  stalledOnboardings: number;
}): string {
  const topRisk = params.summary.topAtRisk[0];
  const topPerformer = params.summary.topPerformers[0];

  const lines = [
    `Vue plateforme: ${params.summary.totalClinics} cliniques analysées, score moyen ${params.summary.averageScore}/100.`,
    `Risque: ${params.summary.countsByRisk.critical} critiques, ${params.summary.countsByRisk.high} élevées, ${params.summary.decliningCount} en déclin.`,
    `Opérations: ${params.unreadAlerts} alertes critiques non lues et ${params.stalledOnboardings} onboardings bloqués.`,
  ];

  if (topRisk) {
    lines.push(
      `Priorité immédiate: ${topRisk.clinicName} (${topRisk.score}/100), signal principal ${displaySignal(topRisk.topRiskSignal)}.`,
    );
  }

  if (topPerformer) {
    lines.push(
      `Point positif: ${topPerformer.clinicName} mène avec ${topPerformer.score}/100 grâce à ${displaySignal(topPerformer.topStrengthSignal)}.`,
    );
  }

  return lines.join("\n");
}

export function buildClinicNarrativeFallback(params: {
  record: BaseClinicHealthRecord;
  unreadAlerts: number;
  onboardingStep?: string | null;
  supportBacklog: number;
}): string {
  const lines = [
    `${params.record.clinicName} a un health score de ${params.record.score}/100 (${params.record.grade}), avec un risque ${params.record.churnRisk}.`,
    `Le principal risque est ${displaySignal(params.record.topRiskSignal)} et la tendance actuelle est ${params.record.trend}.`,
    `La clinique a ${params.unreadAlerts} alertes non lues et ${params.supportBacklog} tickets support ouverts ou en cours.`,
  ];

  if (params.onboardingStep) {
    lines.push(`Étape d'onboarding en cours: ${params.onboardingStep}.`);
  }

  return lines.join("\n");
}

export function getApprovedAdminQueries(): ApprovedAdminQueryDefinition[] {
  return APPROVED_ADMIN_QUERIES;
}

export function clampAdminQueryLimit(limit?: number | null): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 10;
  return Math.max(1, Math.min(Math.round(limit), 50));
}

export function selectApprovedAdminQuery(question: string): ApprovedAdminQueryDefinition | null {
  const normalized = normalizeQuestion(question);
  let bestMatch: ApprovedAdminQueryDefinition | null = null;
  let bestScore = 0;

  for (const candidate of APPROVED_ADMIN_QUERIES) {
    const score = candidate.keywords.reduce(
      (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

export function buildApprovedAdminSql(
  definition: ApprovedAdminQueryDefinition,
  params: { limit?: number | null; clinicId?: string | null },
): string {
  return definition.buildSql({
    limit: clampAdminQueryLimit(params.limit),
    clinicId: params.clinicId ?? null,
  });
}
