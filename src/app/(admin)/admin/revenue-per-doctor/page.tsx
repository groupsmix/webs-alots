"use client";

import { DollarSign, Users, TrendingDown, BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { logger } from "@/lib/logger";
import { formatCurrency, LOCALE_MAP } from "@/lib/utils";

interface DoctorMetric {
  doctorId: string;
  doctorName: string;
  totalRevenue: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  cancellationRate: number;
  avgRevenuePerAppointment: number;
}

interface RevenueSummary {
  totalRevenue: number;
  totalAppointments: number;
  avgCancellationRate: number;
  doctorCount: number;
}

const RevenueBarChart = dynamic(() => import("./_revenue-bar-chart"), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-md bg-muted" />,
});

export default function RevenuePerDoctorPage() {
  const [locale] = useLocale();
  const tenant = useTenant();
  const [doctors, setDoctors] = useState<DoctorMetric[]>([]);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      if (!tenant?.clinicId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/clinic-owner/revenue-per-doctor?period=${period}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (controller.signal.aborted) return;
        if (json.ok) {
          setDoctors(json.data.doctors);
          setSummary(json.data.summary);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          logger.warn("Failed to load revenue data", { context: "page", error: err });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => controller.abort();
  }, [tenant?.clinicId, period]);

  const intlLocale = LOCALE_MAP[locale ?? "fr"] ?? "fr-FR";

  const chartData = doctors.map((d) => ({
    name: d.doctorName?.split(" ").slice(0, 2).join(" ") ?? "—",
    revenue: d.totalRevenue / 100,
    appointments: d.totalAppointments,
  }));

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Revenu par médecin" }]}
      />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold">Revenu par médecin</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 jours</SelectItem>
            <SelectItem value="30d">30 jours</SelectItem>
            <SelectItem value="90d">90 jours</SelectItem>
            <SelectItem value="12m">12 mois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Chargement...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Revenu total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((summary?.totalRevenue ?? 0) / 100, locale ?? "fr")}
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
                  {(summary?.totalAppointments ?? 0).toLocaleString(intlLocale)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taux d&apos;annulation</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.avgCancellationRate ?? 0}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Médecins</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.doctorCount ?? 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
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

          {/* Table */}
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
                    {doctors.map((d) => (
                      <tr key={d.doctorId} className="border-b last:border-0">
                        <td className="py-3 pe-4">{d.doctorName}</td>
                        <td className="py-3 pe-4 text-end">
                          {formatCurrency(d.totalRevenue / 100, locale ?? "fr")}
                        </td>
                        <td className="py-3 pe-4 text-end">{d.totalAppointments}</td>
                        <td className="py-3 pe-4 text-end">{d.completedAppointments}</td>
                        <td className="py-3 pe-4 text-end">{d.cancelledAppointments}</td>
                        <td className="py-3 pe-4 text-end">{d.cancellationRate}%</td>
                        <td className="py-3 text-end">
                          {formatCurrency(d.avgRevenuePerAppointment / 100, locale ?? "fr")}
                        </td>
                      </tr>
                    ))}
                    {doctors.length === 0 && (
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
