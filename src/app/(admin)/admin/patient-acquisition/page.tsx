"use client";

import { DollarSign, Users, Target, TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { formatCurrency, LOCALE_MAP } from "@/lib/utils";

interface ChannelStat {
  channel: string;
  patientCount: number;
  totalSpend: number;
  costPerPatient: number;
}

interface AcquisitionSummary {
  totalPatients: number;
  trackedPatients: number;
  untrackedPatients: number;
  totalMarketingSpend: number;
  overallCostPerPatient: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  google: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
  referral: "Parrainage",
  walk_in: "Sans RDV",
  website: "Site web",
  seo: "SEO",
  offline: "Hors ligne",
  other: "Autre",
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  google: "#4285F4",
  facebook: "#1877F2",
  instagram: "#E4405F",
  referral: "#FF9800",
  walk_in: "#9E9E9E",
  website: "#673AB7",
  other: "#607D8B",
};

const AcquisitionBarChart = dynamic(() => import("./_acquisition-bar-chart"), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-md bg-muted" />,
});

export default function PatientAcquisitionPage() {
  const [locale] = useLocale();
  const tenant = useTenant();
  const [channels, setChannels] = useState<ChannelStat[]>([]);
  const [summary, setSummary] = useState<AcquisitionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const intlLocale = LOCALE_MAP[locale ?? "fr"] ?? "fr-FR";

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      if (!tenant?.clinicId) return;
      setLoading(true);
      try {
        const res = await fetch("/api/clinic-owner/patient-acquisition", {
          signal: controller.signal,
        });
        const json = await res.json();
        if (controller.signal.aborted) return;
        if (json.ok) {
          setChannels(json.data.channels);
          setSummary(json.data.summary);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          logger.warn("Failed to load acquisition data", { context: "page", error: err });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => controller.abort();
  }, [tenant?.clinicId]);

  const chartData = channels
    .filter((c) => c.patientCount > 0)
    .sort((a, b) => b.patientCount - a.patientCount)
    .map((c) => ({
      channel: CHANNEL_LABELS[c.channel] ?? c.channel,
      patients: c.patientCount,
      cost: c.costPerPatient / 100,
      fill: CHANNEL_COLORS[c.channel] ?? "#607D8B",
    }));

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Acquisition patients" }]}
      />
      <h1 className="text-2xl font-bold">Coût d&apos;acquisition patient</h1>

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
                <CardTitle className="text-sm font-medium">Total patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(summary?.totalPatients ?? 0).toLocaleString(intlLocale)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Patients suivis</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(summary?.trackedPatients ?? 0).toLocaleString(intlLocale)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary?.untrackedPatients ?? 0} non suivis
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Budget marketing</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((summary?.totalMarketingSpend ?? 0) / 100, locale ?? "fr")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Coût / patient</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency((summary?.overallCostPerPatient ?? 0) / 100, locale ?? "fr")}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Patients par canal</CardTitle>
              </CardHeader>
              <CardContent>
                <AcquisitionBarChart data={chartData} />
              </CardContent>
            </Card>
          )}

          {/* Channel Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Détail par canal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-start">
                      <th className="py-3 pe-4 font-medium">Canal</th>
                      <th className="py-3 pe-4 text-end font-medium">Patients</th>
                      <th className="py-3 pe-4 text-end font-medium">Dépenses</th>
                      <th className="py-3 text-end font-medium">Coût/patient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels
                      .filter((c) => c.patientCount > 0 || c.totalSpend > 0)
                      .sort((a, b) => b.patientCount - a.patientCount)
                      .map((c) => (
                        <tr key={c.channel} className="border-b last:border-0">
                          <td className="py-3 pe-4 flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CHANNEL_COLORS[c.channel] ?? "#607D8B" }}
                            />
                            {CHANNEL_LABELS[c.channel] ?? c.channel}
                          </td>
                          <td className="py-3 pe-4 text-end">{c.patientCount}</td>
                          <td className="py-3 pe-4 text-end">
                            {formatCurrency(c.totalSpend / 100, locale ?? "fr")}
                          </td>
                          <td className="py-3 text-end font-medium">
                            {c.costPerPatient > 0
                              ? formatCurrency(c.costPerPatient / 100, locale ?? "fr")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    {channels.filter((c) => c.patientCount > 0 || c.totalSpend > 0).length ===
                      0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          Aucune donnée d&apos;acquisition disponible
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
