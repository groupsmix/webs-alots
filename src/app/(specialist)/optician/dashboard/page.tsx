"use client";

import { Eye, Package, Glasses, FileText, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
  fetchOpticalPrescriptions,
  fetchLensInventory,
  fetchFrameCatalog,
} from "@/lib/data/client";
import { t, type Locale } from "@/lib/i18n";
import type {
  OpticalPrescription,
  LensInventoryItem,
  FrameCatalogItem,
} from "@/lib/types/para-medical";

function withinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return false;
  return Date.now() - d <= days * 24 * 60 * 60 * 1000;
}

function statusLabel(locale: Locale, status: OpticalPrescription["status"]): string {
  const keys: Record<OpticalPrescription["status"], string> = {
    pending: "spec.opt.status.pending",
    in_progress: "spec.opt.status.inProgress",
    ready: "spec.opt.status.ready",
    delivered: "spec.opt.status.delivered",
  };
  return t(locale, keys[status]);
}

export default function OpticianDashboardPage() {
  const tenant = useTenant();
  const [locale] = useLocale();
  const [prescriptions, setPrescriptions] = useState<OpticalPrescription[]>([]);
  const [lenses, setLenses] = useState<LensInventoryItem[]>([]);
  const [frames, setFrames] = useState<FrameCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cId = tenant?.clinicId ?? "";
    Promise.all([fetchOpticalPrescriptions(cId), fetchLensInventory(cId), fetchFrameCatalog(cId)])
      .then(([rx, lens, frame]) => {
        if (!controller.signal.aborted) {
          setPrescriptions(rx);
          setLenses(lens);
          setFrames(frame);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e as Error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [tenant?.clinicId]);

  if (loading) {
    return <PageLoader message={t(locale, "spec.dash.loading")} />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">{t(locale, "spec.dash.loadError")}</p>
      </div>
    );
  }

  const inStockLenses = lenses.filter((l) => l.stock_quantity > 0).length;
  const activeFrames = frames.filter((f) => f.is_active).length;
  const pending = prescriptions.filter((p) => p.status === "pending" || p.status === "in_progress");
  const deliveredThisMonth = prescriptions.filter(
    (p) => p.status === "delivered" && withinDays(p.updated_at, 30),
  ).length;
  const lowStockLenses = lenses.filter((l) => l.stock_quantity <= l.min_threshold);

  const stats = [
    {
      icon: Package,
      label: t(locale, "spec.opt.lensTypesInStock"),
      value: inStockLenses,
      color: "text-blue-600",
    },
    {
      icon: Glasses,
      label: t(locale, "spec.opt.frameModels"),
      value: activeFrames,
      color: "text-green-600",
    },
    {
      icon: FileText,
      label: t(locale, "spec.opt.pendingPrescriptions"),
      value: pending.length,
      color: "text-orange-600",
    },
    {
      icon: Eye,
      label: t(locale, "spec.opt.deliveredThisMonth"),
      value: deliveredThisMonth,
      color: "text-purple-600",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t(locale, "spec.opt.title")}</h1>
        </div>
        <Link href="/optician/prescriptions" className="shrink-0">
          <Button size="lg">
            <FileText className="h-4 w-4 me-2" />
            {t(locale, "spec.opt.viewPrescriptions")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t(locale, "spec.opt.prescriptionsInProgress")}
            </CardTitle>
            <Link href="/optician/prescriptions" className="text-sm text-primary hover:underline">
              {t(locale, "spec.dash.viewAll")}
            </Link>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(locale, "spec.opt.noPrescriptionsInProgress")}
              </p>
            ) : (
              <div className="space-y-3">
                {pending.slice(0, 5).map((rx) => (
                  <div
                    key={rx.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{rx.patient_name}</p>
                      <p className="text-xs text-muted-foreground">{rx.prescription_date}</p>
                    </div>
                    <Badge variant="outline">{statusLabel(locale, rx.status)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t(locale, "spec.opt.inventoryAlerts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockLenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "spec.opt.noStockAlerts")}</p>
            ) : (
              <div className="space-y-3">
                {lowStockLenses.slice(0, 5).map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm capitalize">{l.type.replace("_", " ")}</span>
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      {t(locale, "spec.opt.left", { n: l.stock_quantity })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
