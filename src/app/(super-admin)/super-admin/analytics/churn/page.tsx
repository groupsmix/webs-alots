/* eslint-disable i18next/no-literal-string */
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
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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

export default function ChurnPredictionPage() {
  const [scores, setScores] = useState<ChurnScore[]>([]);
  const [summary, setSummary] = useState<ChurnSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [filterRisk, setFilterRisk] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filterRisk !== "all") params.set("risk_level", filterRisk);
      params.set("limit", "100");

      const res = await fetch(`/api/admin/churn-prediction?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to load churn data");

      setScores(json.data.scores);
      setSummary(json.data.summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      logger.warn("Failed to load churn scores", { context: "churn-page", error: err });
    } finally {
      setLoading(false);
    }
  }, [filterRisk]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const res = await fetch("/api/admin/churn-prediction", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Recalculation failed");
      await fetchScores();
    } catch (err) {
      logger.warn("Churn recalculation failed", { context: "churn-page", error: err });
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Analytique", href: "/super-admin/analytics" },
          { label: "Prédiction de désabonnement" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prédiction de désabonnement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Évaluation des risques par IA pour la rétention des cliniques
          </p>
        </div>
        <Button onClick={handleRecalculate} disabled={recalculating} variant="outline">
          {recalculating ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Recalculer
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
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total évalué</span>
                </div>
                <p className="text-2xl font-bold">{summary.total}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-red-600">Critique</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{summary.critical}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-orange-600">Risque élevé</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{summary.high}</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs text-yellow-600">Moyen</span>
                </div>
                <p className="text-2xl font-bold text-yellow-600">{summary.medium}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600">Risque faible</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{summary.low}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Filtrer par risque :</span>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les niveaux</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
                <SelectItem value="high">Élevé</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scores Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scores de risque des cliniques</CardTitle>
            </CardHeader>
            <CardContent>
              {scores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun score calculé. Cliquez sur &quot;Recalculer&quot; pour générer les scores.
                </p>
              ) : (
                <div className="space-y-3">
                  {scores.map((score) => (
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
                            <span>Forfait : {score.clinic_tier}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{score.score}</div>
                          <div className="text-xs text-muted-foreground">/ 100</div>
                        </div>
                      </div>

                      {/* Score Bar */}
                      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${RISK_BAR_COLORS[score.risk_level]}`}
                          style={{ width: `${score.score}%` }}
                        />
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{score.appointment_volume_30d} rdv (30j)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          <span>{score.login_frequency_30d} connexions (30j)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{score.support_tickets_30d} tickets (30j)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>{Number(score.revenue_30d).toLocaleString()} MAD (30j)</span>
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
