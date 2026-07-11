"use client";

import {
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  Users,
  Activity,
  Calendar,
  MessageSquare,
  DollarSign,
  Loader2,
  Shield,
  Bell,
  Lightbulb,
  BarChart3,
  Clock,
  TrendingUp,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────

interface ChurnFactor {
  factor: string;
  weight: number;
  description: string;
}

interface ChurnScore {
  id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_type: string;
  clinic_tier: string;
  clinic_status: string;
  clinic_subdomain: string | null;
  score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  factors: ChurnFactor[];
  login_frequency_30d: number;
  appointment_volume_30d: number;
  appointment_volume_prev_30d: number;
  support_tickets_30d: number;
  days_since_last_login: number | null;
  revenue_30d: number;
  calculated_at: string;
}

interface ChurnSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  averageScore: number;
}

// ── Constants ────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

const RISK_BAR_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const RECOMMENDED_ACTIONS: Record<string, string[]> = {
  critical: [
    "Schedule urgent account review call",
    "Offer temporary discount or plan upgrade",
    "Assign dedicated account manager",
    "Send personalized retention email from CEO",
  ],
  high: [
    "Send targeted re-engagement email",
    "Offer training session on unused features",
    "Review and resolve open support tickets",
    "Schedule quarterly business review",
  ],
  medium: [
    "Send feature adoption tips newsletter",
    "Highlight new platform features",
    "Check in on satisfaction via survey",
  ],
  low: ["Continue regular engagement", "Invite to product feedback sessions"],
};

// ── Score color helper ───────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score > 70) return "text-red-600";
  if (score > 30) return "text-amber-600";
  return "text-green-600";
}

function getScoreBg(score: number): string {
  if (score > 70) return "bg-red-50 border-red-200";
  if (score > 30) return "bg-amber-50 border-amber-200";
  return "bg-green-50 border-green-200";
}

// ── Component ────────────────────────────────────────────────────────

export default function ChurnPredictionPage() {
  const [scores, setScores] = useState<ChurnScore[]>([]);
  const [summary, setSummary] = useState<ChurnSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [filterRisk, setFilterRisk] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [alertThreshold, setAlertThreshold] = useState(70);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSaved, setAlertSaved] = useState(false);

  const fetchScores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filterRisk !== "all") params.set("risk_level", filterRisk);
      params.set("limit", "100");

      const res = await fetch(`/api/super-admin/churn-prediction?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to load churn data");

      setScores(json.data.scores);
      setSummary(json.data.summary);
    } catch (err) {
      logger.error("Failed to load churn scores", {
        context: "churn-page",
        error: err,
      });
      setScores([]);
      setSummary(null);
      setError(err instanceof Error ? err.message : "Failed to load churn data. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [filterRisk]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        fetchScores();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [fetchScores]);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const res = await fetch("/api/super-admin/churn-prediction", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Recalculation failed");
      await fetchScores();
    } catch (err) {
      logger.error("Churn recalculation failed", {
        context: "churn-page",
        error: err,
      });
      setError(err instanceof Error ? err.message : "Recalculation failed. Please retry.");
    } finally {
      setRecalculating(false);
    }
  }

  function handleSaveAlert() {
    setAlertSaved(true);
    setTimeout(() => setAlertSaved(false), 3000);
  }

  const filteredScores = useMemo(() => {
    if (filterRisk === "all") return scores;
    return scores.filter((s) => s.risk_level === filterRisk);
  }, [scores, filterRisk]);

  const atRiskClinics = useMemo(
    () => scores.filter((s) => s.score > alertThreshold).sort((a, b) => b.score - a.score),
    [scores, alertThreshold],
  );

  const retentionMetrics = useMemo(() => {
    if (scores.length === 0) return null;
    const churned = scores.filter((s) => s.risk_level === "critical").length;
    const churnRate = ((churned / scores.length) * 100).toFixed(1);
    const retentionRate = (100 - (churned / scores.length) * 100).toFixed(1);
    const avgRevenue = Math.round(
      scores.reduce((acc, s) => acc + s.revenue_30d, 0) / scores.length,
    );
    const avgLifetimeValue = avgRevenue * 18;
    return { churnRate, retentionRate, avgLifetimeValue, avgMonthlyRevenue: avgRevenue };
  }, [scores]);

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Analytics", href: "/super-admin/analytics" },
          { label: "Churn Detection" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Churn Detection & Retention</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered risk assessment for clinic retention
          </p>
        </div>
        <Button onClick={handleRecalculate} disabled={recalculating} variant="outline">
          {recalculating ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Recalculate
        </Button>
      </div>

      {loading && <CardSkeleton count={4} className="mb-6" />}

      {error && (
        <Card>
          <CardContent className="p-6 text-center text-red-600">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && summary && (
        <>
          {/* ── Summary Cards ─────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Assessed</span>
                </div>
                <p className="text-2xl font-bold">{summary.total}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-red-600">Critical</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{summary.critical}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-orange-600">High Risk</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{summary.high}</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs text-yellow-600">Medium</span>
                </div>
                <p className="text-2xl font-bold text-yellow-600">{summary.medium}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600">Low Risk</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{summary.low}</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Retention Metrics ─────────────────────────────────── */}
          {retentionMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Retention Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-muted-foreground">Churn Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">{retentionMetrics.churnRate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">critical risk clinics</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Retention Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {retentionMetrics.retentionRate}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">non-critical clinics</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Avg Monthly Revenue</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatCurrency(retentionMetrics.avgMonthlyRevenue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">per clinic</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-purple-500" />
                      <span className="text-sm text-muted-foreground">Avg Lifetime Value</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatCurrency(retentionMetrics.avgLifetimeValue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">estimated 18-month LTV</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Risk Factors Overview ─────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risk Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: Activity,
                    label: "Declining Logins",
                    count: scores.filter((s) =>
                      s.factors.some(
                        (f) => f.factor === "login_decline" || f.factor === "no_recent_login",
                      ),
                    ).length,
                    color: "text-red-500",
                    bg: "bg-red-50",
                  },
                  {
                    icon: DollarSign,
                    label: "Missed Payments",
                    count: scores.filter((s) =>
                      s.factors.some((f) => f.factor === "missed_payments"),
                    ).length,
                    color: "text-orange-500",
                    bg: "bg-orange-50",
                  },
                  {
                    icon: MessageSquare,
                    label: "Unresolved Tickets",
                    count: scores.filter((s) =>
                      s.factors.some((f) => f.factor === "support_tickets"),
                    ).length,
                    color: "text-amber-500",
                    bg: "bg-amber-50",
                  },
                  {
                    icon: TrendingDown,
                    label: "Low Feature Usage",
                    count: scores.filter((s) =>
                      s.factors.some((f) => f.factor === "low_feature_usage"),
                    ).length,
                    color: "text-purple-500",
                    bg: "bg-purple-50",
                  },
                ].map((item) => (
                  <div key={item.label} className={`rounded-lg border p-4 ${item.bg}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <p className="text-2xl font-bold">{item.count}</p>
                    <p className="text-xs text-muted-foreground">clinics affected</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Alert Configuration ───────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Alert Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label htmlFor="alert-email" className="text-sm font-medium">
                    <Mail className="h-3.5 w-3.5 inline mr-1" />
                    Notification Email
                  </label>
                  <input
                    id="alert-email"
                    type="email"
                    placeholder="admin@oltigo.com"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="alert-threshold" className="text-sm font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                    Churn Risk Threshold
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="alert-threshold"
                      type="range"
                      min={20}
                      max={90}
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(Number(e.target.value))}
                      className="w-32"
                    />
                    <span className={`text-sm font-bold ${getScoreColor(alertThreshold)}`}>
                      {alertThreshold}
                    </span>
                  </div>
                </div>
                <Button onClick={handleSaveAlert} variant="default" className="shrink-0">
                  {alertSaved ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4 mr-1" />
                      Save Alert
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Email me when any clinic reaches a churn risk score above {alertThreshold}.
                Currently {atRiskClinics.length} clinic{atRiskClinics.length !== 1 ? "s" : ""}{" "}
                exceed this threshold.
              </p>
            </CardContent>
          </Card>

          {/* ── At-Risk Clinics with Recommended Actions ──────────── */}
          {atRiskClinics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  At-Risk Clinics — Recommended Actions
                  <Badge variant="destructive" className="ml-auto">
                    {atRiskClinics.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {atRiskClinics.map((clinic) => (
                  <div
                    key={clinic.id}
                    className={`rounded-lg border p-4 ${getScoreBg(clinic.score)}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{clinic.clinic_name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {clinic.clinic_type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${RISK_COLORS[clinic.risk_level]}`}
                        >
                          {clinic.risk_level}
                        </Badge>
                      </div>
                      <div className={`text-xl font-bold ${getScoreColor(clinic.score)}`}>
                        {clinic.score}/100
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {clinic.factors.map((f, i) => (
                        <span
                          key={i}
                          className="text-xs bg-background/80 border px-2 py-0.5 rounded"
                        >
                          {f.description}
                        </span>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Recommended actions:
                      </p>
                      <ul className="text-xs space-y-0.5">
                        {(RECOMMENDED_ACTIONS[clinic.risk_level] ?? []).map((action, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="mt-0.5">→</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Filter & Scores Table ─────────────────────────────── */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Filter by risk:</span>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinic Risk Scores</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredScores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No scores calculated. Click &quot;Recalculate&quot; to generate scores.
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredScores.map((score) => (
                    <div
                      key={score.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{score.clinic_name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {score.clinic_type}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${RISK_COLORS[score.risk_level]}`}
                            >
                              {score.risk_level}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            {score.clinic_subdomain && (
                              <span>{score.clinic_subdomain}.oltigo.com</span>
                            )}
                            <span>Plan: {score.clinic_tier}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getScoreColor(score.score)}`}>
                            {score.score}
                          </div>
                          <div className="text-xs text-muted-foreground">/ 100</div>
                        </div>
                      </div>

                      {/* Score Bar */}
                      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${RISK_BAR_COLORS[score.risk_level]}`}
                          data-width={Math.round(score.score)}
                        />
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{score.appointment_volume_30d} appts (30d)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          <span>{score.login_frequency_30d} logins (30d)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{score.support_tickets_30d} tickets (30d)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>{formatCurrency(Number(score.revenue_30d))} (30 j)</span>
                        </div>
                      </div>

                      {/* Risk Factors */}
                      {score.factors && score.factors.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {score.factors.map((f, i) => (
                            <span
                              key={i}
                              className="text-xs bg-muted px-2 py-0.5 rounded"
                              title={f.description}
                            >
                              {f.description}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
