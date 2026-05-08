"use client";

import {
  TrendingUp, DollarSign, Users, AlertTriangle,
  BarChart3, Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import {
  SUBSCRIPTION_PLANS,
  PLAN_ORDER,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type PlanSlug,
} from "@/lib/config/subscription-plans";
import { logger } from "@/lib/logger";
import {
  fetchRevenueStats as fetchRevenueStatsAction,
  type RevenueStats,
} from "@/lib/super-admin-actions";

export default function RevenueDashboardPage() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchRevenueStatsAction();
      setStats(data);
    } catch (err) {
      logger.warn("Failed to load revenue stats", { context: "revenue-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div>
      <Breadcrumb items={[
        { label: "Super Admin", href: "/super-admin/dashboard" },
        { label: "Billing", href: "/super-admin/billing" },
        { label: "Revenue" },
      ]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor MRR, subscriptions, and churn across all clinics
          </p>
        </div>
      </div>

      {loading && <CardSkeleton count={4} className="mb-6" />}

      {!loading && stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">MRR</span>
                </div>
                <p className="text-2xl font-bold">{stats.mrr.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">MAD / mois</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">ARR</span>
                </div>
                <p className="text-2xl font-bold">{stats.arr.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">MAD / an</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-muted-foreground">Abonnés payants</span>
                </div>
                <p className="text-2xl font-bold">{stats.activePaidClinics}</p>
                <p className="text-xs text-muted-foreground">sur {stats.totalClinics} cliniques</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-muted-foreground">Churn</span>
                </div>
                <p className="text-2xl font-bold">{stats.churnRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{stats.churnedThisMonth} ce mois</p>
              </CardContent>
            </Card>
          </div>

          {/* Subscriptions by Plan */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Abonnements par plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {PLAN_ORDER.map((slug) => {
                  const plan = SUBSCRIPTION_PLANS[slug];
                  const count = stats.planBreakdown[slug] ?? 0;
                  const total = stats.totalClinics || 1;
                  const percentage = Math.round((count / total) * 100);
                  const revenue = count * plan.price;

                  return (
                    <div key={slug} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">{plan.name}</h4>
                        <Badge variant="outline" className="text-[10px]">
                          {plan.price === 0 ? "Gratuit" : `${plan.price} MAD`}
                        </Badge>
                      </div>
                      <p className="text-3xl font-bold">{count}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">{percentage}% des cliniques</p>
                        {plan.price > 0 && (
                          <p className="text-xs font-medium text-green-600">
                            {revenue.toLocaleString()} MAD/mois
                          </p>
                        )}
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Over Time */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Revenus mensuels
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.revenueByMonth.length > 0 ? (
                <div className="space-y-2">
                  {stats.revenueByMonth.map((entry) => (
                    <div key={entry.month} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{entry.month}</span>
                      <span className="text-sm font-bold">{entry.revenue.toLocaleString()} MAD</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Les données de revenus mensuels seront disponibles une fois les abonnements actifs.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MRR estimé actuel : <span className="font-medium">{stats.mrr.toLocaleString()} MAD</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
