"use client";

import { DollarSign, Users, TrendingDown, BarChart3 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

export default function RevenuePerDoctorPage() {
  const [locale] = useLocale();
  const tenant = useTenant();
  const [doctors, setDoctors] = useState<DoctorMetric[]>([]);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clinic-owner/revenue-per-doctor?period=${period}`);
      const json = await res.json();
      if (json.ok) {
        setDoctors(json.data.doctors);
        setSummary(json.data.summary);
      }
    } catch (err) {
      logger.warn("Failed to load revenue data", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (tenant?.clinicId) loadData();
  }, [tenant?.clinicId, loadData]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <h1 className="text-2xl font-bold">Revenu par médecin</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <SelectItem value="7d">7 jours</SelectItem>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <SelectItem value="30d">30 jours</SelectItem>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <SelectItem value="90d">90 jours</SelectItem>
            {/* eslint-disable-next-line i18next/no-literal-string */}
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
                {/* eslint-disable-next-line i18next/no-literal-string */}
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
                {/* eslint-disable-next-line i18next/no-literal-string */}
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
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <CardTitle className="text-sm font-medium">Taux d&apos;annulation</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.avgCancellationRate ?? 0}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                {/* eslint-disable-next-line i18next/no-literal-string */}
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
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <CardTitle>Revenu par médecin (MAD)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        new Intl.NumberFormat(intlLocale, {
                          style: "currency",
                          currency: "MAD",
                        }).format(Number(value))
                      }
                    />
                    <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardHeader>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <CardTitle>Détail par médecin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 pr-4 font-medium">Médecin</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 pr-4 font-medium text-right">Revenu</th>
                      <th className="py-3 pr-4 font-medium text-right">RDV</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 pr-4 font-medium text-right">Complétés</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 pr-4 font-medium text-right">Annulés</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 pr-4 font-medium text-right">Taux ann.</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 font-medium text-right">Moy./RDV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((d) => (
                      <tr key={d.doctorId} className="border-b last:border-0">
                        <td className="py-3 pr-4">{d.doctorName}</td>
                        <td className="py-3 pr-4 text-right">
                          {formatCurrency(d.totalRevenue / 100, locale ?? "fr")}
                        </td>
                        <td className="py-3 pr-4 text-right">{d.totalAppointments}</td>
                        <td className="py-3 pr-4 text-right">{d.completedAppointments}</td>
                        <td className="py-3 pr-4 text-right">{d.cancelledAppointments}</td>
                        <td className="py-3 pr-4 text-right">{d.cancellationRate}%</td>
                        <td className="py-3 text-right">
                          {formatCurrency(d.avgRevenuePerAppointment / 100, locale ?? "fr")}
                        </td>
                      </tr>
                    ))}
                    {doctors.length === 0 && (
                      <tr>
                        {/* eslint-disable-next-line i18next/no-literal-string */}
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
