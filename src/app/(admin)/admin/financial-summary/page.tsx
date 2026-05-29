"use client";

import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CreditCard,
  Banknote,
  Shield,
  Clock,
  Send,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";

interface FinancialData {
  period: { start_date: string; end_date: string };
  revenue: { total_centimes: number; invoice_count: number };
  outstanding: { total_centimes: number; invoice_count: number };
  payment_method_breakdown: Record<string, number>;
  status_counts: Record<string, number>;
  trends: { month: string; revenue_centimes: number; count: number }[];
  payment_plans: {
    active_count: number;
    overdue_installment_total_centimes: number;
  };
}

interface AIInsight {
  answer: string;
  disclaimer: string;
  aiGenerated: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  card: "Carte bancaire",
  cmi: "CMI",
  insurance: "Assurance",
  bank_transfer: "Virement",
  other: "Autre",
};

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  cash: Banknote,
  card: CreditCard,
  cmi: CreditCard,
  insurance: Shield,
  bank_transfer: DollarSign,
  other: DollarSign,
};

export default function FinancialSummaryPage() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [period, setPeriod] = useState("month");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/financial-summary?period=${period}`);
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch (err) {
      logger.warn("Failed to load financial summary", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const askAI = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/revenue-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: aiQuestion }),
      });
      const json = await res.json();
      if (json.ok) {
        setAiInsight(json.data);
      }
    } catch (err) {
      logger.warn("AI insights query failed", { context: "page", error: err });
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Impossible de charger les données financières.
      </div>
    );
  }

  const revenueMAD = data.revenue.total_centimes / 100;
  const outstandingMAD = data.outstanding.total_centimes / 100;
  const prevMonth = data.trends.length >= 2 ? data.trends[data.trends.length - 2] : null;
  const currentMonth = data.trends.length >= 1 ? data.trends[data.trends.length - 1] : null;
  const revenueChange =
    prevMonth && prevMonth.revenue_centimes > 0
      ? ((currentMonth?.revenue_centimes ?? 0) - prevMonth.revenue_centimes) /
        prevMonth.revenue_centimes
      : 0;

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Résumé Financier" }]}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Résumé Financier</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aperçu de la performance financière de votre clinique
          </p>
        </div>
        <div className="flex gap-2">
          {(["week", "month", "quarter", "year"] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === "week"
                ? "Semaine"
                : p === "month"
                  ? "Mois"
                  : p === "quarter"
                    ? "Trimestre"
                    : "Année"}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Revenus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(revenueMAD, "fr", "MAD")}</p>
            <div className="flex items-center gap-1 mt-1">
              {revenueChange >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              )}
              <span className={`text-xs ${revenueChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                {(revenueChange * 100).toFixed(1)}% vs mois précédent
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              En attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(outstandingMAD, "fr", "MAD")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.outstanding.invoice_count} factures
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Impayés en retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(
                data.payment_plans.overdue_installment_total_centimes / 100,
                "fr",
                "MAD",
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.payment_plans.active_count} plans de paiement actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Factures payées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.revenue.invoice_count}</p>
            <p className="text-xs text-muted-foreground mt-1">cette période</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Breakdown + Status */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par mode de paiement</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(data.payment_method_breakdown).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paiement cette période</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(data.payment_method_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, centimes]) => {
                    const Icon = METHOD_ICONS[method] ?? DollarSign;
                    const pct =
                      data.revenue.total_centimes > 0
                        ? (centimes / data.revenue.total_centimes) * 100
                        : 0;
                    return (
                      <div key={method} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{METHOD_LABELS[method] ?? method}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {formatCurrency(centimes / 100, "fr", "MAD")}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {pct.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statut des factures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(data.status_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge
                      variant={
                        status === "paid"
                          ? "default"
                          : status === "overdue"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {status}
                    </Badge>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Tendance des revenus (6 derniers mois)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {data.trends.map((trend) => {
              const maxRevenue = Math.max(...data.trends.map((t) => t.revenue_centimes), 1);
              const height = (trend.revenue_centimes / maxRevenue) * 100;
              return (
                <div key={trend.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(trend.revenue_centimes / 100, "fr", "MAD")}
                  </span>
                  <div
                    className="w-full bg-primary/80 rounded-t-sm min-h-[4px]"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{trend.month}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* AI Revenue Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Insights IA — Analyse Financière
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askAI()}
              placeholder="Posez une question sur vos finances... (ex: Comment améliorer la collecte?)"
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
            <Button onClick={askAI} disabled={aiLoading || !aiQuestion.trim()} size="sm">
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {aiInsight && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{aiInsight.answer}</p>
              {aiInsight.disclaimer && (
                <p className="text-xs text-muted-foreground mt-3 italic">{aiInsight.disclaimer}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
