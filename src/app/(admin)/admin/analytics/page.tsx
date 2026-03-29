import { createClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";

/**
 * Admin Analytics Dashboard
 *
 * Server Component that fetches revenue, demographics, and scheduling data
 * directly from Supabase. No client-side useEffect needed.
 */

interface RevenueData {
  total: number;
  count: number;
  byMethod: Record<string, number>;
}

interface DemographicsData {
  totalPatients: number;
}

async function getRevenueData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
): Promise<RevenueData> {
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, method, status")
    .eq("clinic_id", clinicId)
    .eq("status", "completed");

  const result: RevenueData = { total: 0, count: 0, byMethod: {} };
  if (!payments) return result;

  for (const p of payments) {
    result.total += p.amount ?? 0;
    result.count += 1;
    const method = p.method ?? "other";
    result.byMethod[method] = (result.byMethod[method] ?? 0) + (p.amount ?? 0);
  }
  return result;
}

async function getDemographicsData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
): Promise<DemographicsData> {
  const { data: patients } = await supabase
    .from("users")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("role", "patient");

  const result: DemographicsData = { totalPatients: 0 };
  if (!patients) return result;

  result.totalPatients = patients.length;
  return result;
}

export default async function AnalyticsPage() {
  const tenant = await requireTenant();
  const supabase = await createClient();

  const [revenue, demographics] = await Promise.all([
    getRevenueData(supabase, tenant.clinicId),
    getDemographicsData(supabase, tenant.clinicId),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("fr", "accounting.title")}</h1>

      {/* Revenue Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("fr", "accounting.revenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {revenue.total.toLocaleString("fr-MA")} MAD
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("fr", "payment.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenue.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("fr", "nav.patients")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demographics.totalPatients}</div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t("fr", "payment.method")}</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(revenue.byMethod).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("fr", "directory.noResults")}
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(revenue.byMethod).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{method}</span>
                  <span className="text-sm font-medium">
                    {amount.toLocaleString("fr-MA")} MAD
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
