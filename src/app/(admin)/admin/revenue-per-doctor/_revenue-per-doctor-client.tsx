"use client";

import { BarChart3, DollarSign, TrendingDown, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchRevenuePerDoctor, type RevenuePerDoctorView } from "@/lib/data/revenue-per-doctor";
import { logger } from "@/lib/logger";
import { formatCurrency, LOCALE_MAP } from "@/lib/utils";

const RevenueBarChart = dynamic(() => import("./_revenue-bar-chart"), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-md bg-muted" />,
});

interface RevenuePerDoctorClientProps {
  clinicId: string;
  locale: string;
  initialData: RevenuePerDoctorView;
}

const PERIOD_LABELS: Record<string, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "90 jours",
  "12m": "12 mois",
};

export default function RevenuePerDoctorClient({
  clinicId,
  locale,
  initialData,
}: RevenuePerDoctorClientProps) {
  const [data, setData] = useState<RevenuePerDoctorView>(initialData);
  const [period, setPeriod] = useState(initialData.period);
  const [loading, setLoading] = useState(false);

  const intlLocale = LOCALE_MAP[locale as keyof typeof LOCALE_MAP] ?? "fr-FR";

  const chartData = useMemo(
    () =>
      data.doctors.map((d) => ({
        name: d.doctorName?.split(" ").slice(0, 2).join(" ") ?? "—",
        revenue: d.totalRevenue / 100,
        appointments: d.totalAppointments,
      })),
    [data.doctors],
  );

  async function handlePeriodChange(next: string) {
    setPeriod(next);
    setLoading(true);
    try {
      const nextData = await fetchRevenuePerDoctor(clinicId, next);
      setData(nextData);
    } catch (err) {
      logger.warn("Failed to load revenue per doctor", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Revenu par médecin" }]}
      />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Revenu par médecin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aperçu de la performance financière de votre clinique
          </p>
        </div>
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Chargement...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Revenu total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.summary.totalRevenue / 100, locale as "fr")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Rendez-vous</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.summary.totalAppointments.toLocaleString(intlLocale)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taux d&apos;annulation</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.avgCancellationRate}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Médecins</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.doctorCount}</div>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Revenu par médecin (MAD)</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueBarChart data={chartData} intlLocale={intlLocale} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Détail par médecin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-start">
                      <th className="py-3 pe-4 font-medium">Médecin</th>
                      <th className="py-3 pe-4 text-end font-medium">Revenu</th>
                      <th className="py-3 pe-4 text-end font-medium">RDV</th>
                      <th className="py-3 pe-4 text-end font-medium">Complétés</th>
                      <th className="py-3 pe-4 text-end font-medium">Annulés</th>
                      <th className="py-3 pe-4 text-end font-medium">Taux ann.</th>
                      <th className="py-3 text-end font-medium">Moy./RDV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.doctors.map((d) => (
                      <tr key={d.doctorId} className="border-b last:border-0">
                        <td className="py-3 pe-4">{d.doctorName}</td>
                        <td className="py-3 pe-4 text-end">
                          {formatCurrency(d.totalRevenue / 100, locale as "fr")}
                        </td>
                        <td className="py-3 pe-4 text-end">{d.totalAppointments}</td>
                        <td className="py-3 pe-4 text-end">{d.completedAppointments}</td>
                        <td className="py-3 pe-4 text-end">{d.cancelledAppointments}</td>
                        <td className="py-3 pe-4 text-end">{d.cancellationRate}%</td>
                        <td className="py-3 text-end">
                          {formatCurrency(d.avgRevenuePerAppointment / 100, locale as "fr")}
                        </td>
                      </tr>
                    ))}
                    {data.doctors.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          Aucune donnée disponible
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
