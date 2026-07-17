"use client";

import { Eye, Package, Glasses, FileText, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import type {
  OpticalPrescription,
  LensInventoryItem,
  FrameCatalogItem,
} from "@/lib/types/para-medical";

const PRIMARY_ACTION_LABEL = "View prescriptions";

function withinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return false;
  return Date.now() - d <= days * 24 * 60 * 60 * 1000;
}

const STATUS_LABEL: Record<OpticalPrescription["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  ready: "Ready",
  delivered: "Delivered",
};

export default function OpticianDashboardPage() {
  const tenant = useTenant();
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
    return <PageLoader message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">
          Failed to load data. Please try refreshing the page.
        </p>
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
    { icon: Package, label: "Lens Types in Stock", value: inStockLenses, color: "text-blue-600" },
    { icon: Glasses, label: "Frame Models", value: activeFrames, color: "text-green-600" },
    {
      icon: FileText,
      label: "Pending Prescriptions",
      value: pending.length,
      color: "text-orange-600",
    },
    {
      icon: Eye,
      label: "Delivered This Month",
      value: deliveredThisMonth,
      color: "text-purple-600",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Optician Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Opticien — نظاراتي</p>
        </div>
        <Link href="/optician/prescriptions" className="shrink-0">
          <Button size="lg">
            <FileText className="h-4 w-4 me-2" />
            {PRIMARY_ACTION_LABEL}
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
              Prescriptions in Progress
            </CardTitle>
            <Link href="/optician/prescriptions" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prescriptions in progress.</p>
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
                    <Badge variant="outline">{STATUS_LABEL[rx.status]}</Badge>
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
              Inventory Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockLenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No low stock alerts.</p>
            ) : (
              <div className="space-y-3">
                {lowStockLenses.slice(0, 5).map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm capitalize">{l.type.replace("_", " ")}</span>
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      {l.stock_quantity} left
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
