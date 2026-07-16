import { AlertTriangle, BarChart3, DollarSign, Loader2, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupportedLocale, t, type Locale } from "@/lib/i18n";
import { PLAN_ORDER, getPlanConfig } from "@/lib/subscription-billing";
import { fetchRevenueStats } from "@/lib/super-admin-actions";
import { getTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";
import RevenueLineChart from "./_revenue-line-chart-wrapper";

export default async function RevenueDashboardPage() {
  const stats = await fetchRevenueStats();
  const tenant = await getTenant();
  const locale: Locale = isSupportedLocale(tenant?.locale) ? tenant.locale : "fr";

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Facturation", href: "/super-admin/billing" },
          { label: "Vue revenus" },
        ]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord revenus</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi du MRR, des abonnements et du churn sur toutes les cliniques
          </p>
        </div>
      </div>

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
              const plan = getPlanConfig(slug);
              const count = stats.planBreakdown[slug] ?? 0;
              const total = stats.totalClinics || 1;
              const percentage = Math.round((count / total) * 100);
              const revenue = count * plan.priceMonthly;

              return (
                <div key={slug} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">{plan.name}</h4>
                    <Badge variant="outline" className="text-[10px]">
                      {plan.priceMonthly === 0 ? "Gratuit" : `${formatCurrency(plan.priceMonthly)}`}
                    </Badge>
                  </div>
                  <p className="text-3xl font-bold">{count}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">{percentage}% des cliniques</p>
                    {plan.priceMonthly > 0 && (
                      <p className="text-xs font-medium text-green-600">
                        {formatCurrency(revenue)}/mois
                      </p>
                    )}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      data-width={Math.round(percentage)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenus mensuels
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.revenueByMonth.length > 0 ? (
            <RevenueLineChart
              data={stats.revenueByMonth}
              formatter={(value: number) => formatCurrency(value)}
            />
          ) : (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                {t(locale, "super-admin.billing.revenue.lesDonneesDeRevenus")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(locale, "super-admin.billing.revenue.mrrEstimeActuel")}{" "}
                <span className="font-medium">{formatCurrency(stats.mrr)}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
