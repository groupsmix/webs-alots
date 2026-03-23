"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package, HandCoins, Wrench, Clock,
  ArrowRight, AlertTriangle, CheckCircle, Bell,
} from "lucide-react";
import Link from "next/link";
import { clinicConfig } from "@/config/clinic.config";
import { fetchEquipmentInventory, fetchEquipmentRentals, fetchEquipmentMaintenance } from "@/lib/data/client";
import type { EquipmentItemView, EquipmentRentalView, EquipmentMaintenanceView } from "@/lib/data/client";
import { useEquipmentLocale } from "../../layout";
import { useEquipmentI18n } from "@/lib/hooks/use-equipment-i18n";
import { PageLoader } from "@/components/ui/page-loader";

export default function EquipmentDashboardPage() {
  const { locale } = useEquipmentLocale();
  const { t } = useEquipmentI18n(locale);
  const [inventory, setInventory] = useState<EquipmentItemView[]>([]);
  const [rentals, setRentals] = useState<EquipmentRentalView[]>([]);
  const [maintenance, setMaintenance] = useState<EquipmentMaintenanceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cId = clinicConfig.clinicId;
    Promise.all([
      fetchEquipmentInventory(cId),
      fetchEquipmentRentals(cId),
      fetchEquipmentMaintenance(cId),
    ])
      .then(([inv, rent, maint]) => {
      if (controller.signal.aborted) return;
        setInventory(inv);
        setRentals(rent);
        setMaintenance(maint);
      })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading..." />;
  }

  const available = inventory.filter((i) => i.isAvailable);
  const activeRentals = rentals.filter((r) => r.status === "active");
  const overdueRentals = rentals.filter((r) => r.status === "overdue");
  const upcomingMaint = maintenance.filter((m) => m.status === "scheduled");
  const needsRepair = inventory.filter((i) => i.condition === "needs_repair");

  const now = new Date();
  const overdueMaint = maintenance.filter((m) => {
    if (m.status !== "scheduled" || !m.nextDue) return false;
    return new Date(m.nextDue) < now;
  });

  const dateFmt = locale === "ar" ? "ar-MA" : "fr-FR";
  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      active: locale === "fr" ? "Active" : "نشط",
      overdue: locale === "fr" ? "En retard" : "متأخر",
      reserved: locale === "fr" ? "Réservé" : "محجوز",
    };
    return map[s] ?? s;
  };

  const typeLabel = (tp: string) => {
    const map: Record<string, string> = {
      routine: t("typeRoutine"),
      repair: t("typeRepair"),
      calibration: t("typeCalibration"),
      inspection: t("typeInspection"),
      cleaning: t("typeCleaning"),
    };
    return map[tp] ?? tp;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboardTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("dashboardSubtitle")}</p>
        </div>
        <Badge variant="outline" className="text-amber-600 border-amber-600">
          <Clock className="h-3 w-3 mr-1" />
          {now.toLocaleDateString(dateFmt, { weekday: "long", month: "long", day: "numeric" })}
        </Badge>
      </div>

      {/* Maintenance alerts banner */}
      {(overdueMaint.length > 0 || overdueRentals.length > 0) && (
        <Card className="mb-6 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-sm text-red-700">
                {locale === "fr" ? "Alertes" : "تنبيهات"}
              </h3>
            </div>
            <div className="space-y-1">
              {overdueMaint.length > 0 && (
                <p className="text-sm text-red-600">
                  {overdueMaint.length} {t("overdueMaintenance").toLowerCase()}
                </p>
              )}
              {overdueRentals.length > 0 && (
                <p className="text-sm text-red-600">
                  {overdueRentals.length} {t("overdueReturns").toLowerCase()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("totalEquipment")}</p>
                <p className="text-3xl font-bold">{inventory.length}</p>
                <p className="text-xs text-muted-foreground">{available.length} {t("available")}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                <Package className="h-6 w-6" />
              </div>
            </div>
            <Link href="/equipment/inventory" className="text-sm text-amber-600 hover:underline mt-2 inline-flex items-center">
              {t("viewInventory")} <ArrowRight className="h-3 w-3 ms-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("activeRentals")}</p>
                <p className="text-3xl font-bold text-blue-600">{activeRentals.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                <HandCoins className="h-6 w-6" />
              </div>
            </div>
            <Link href="/equipment/rentals" className="text-sm text-amber-600 hover:underline mt-2 inline-flex items-center">
              {t("viewRentals")} <ArrowRight className="h-3 w-3 ms-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("overdueReturns")}</p>
                <p className="text-3xl font-bold text-red-500">{overdueRentals.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("scheduledMaintenance")}</p>
                <p className="text-3xl font-bold text-orange-500">{upcomingMaint.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                <Wrench className="h-6 w-6" />
              </div>
            </div>
            <Link href="/equipment/maintenance" className="text-sm text-amber-600 hover:underline mt-2 inline-flex items-center">
              {t("viewSchedule")} <ArrowRight className="h-3 w-3 ms-1" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Rentals */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">{t("activeRentalsTitle")}</h2>
              <Link href="/equipment/rentals" className="text-sm text-amber-600 hover:underline">{t("viewAll")}</Link>
            </div>
            <div className="space-y-3">
              {[...overdueRentals, ...activeRentals].slice(0, 5).map((rental) => (
                <div key={rental.id} className={`flex items-center justify-between p-3 rounded-lg ${rental.status === "overdue" ? "bg-red-50 dark:bg-red-950/10" : "bg-muted/50"}`}>
                  <div>
                    <p className="font-medium text-sm">{rental.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {rental.clientName} &middot; {t("since")} {new Date(rental.rentalStart).toLocaleDateString(dateFmt)}
                    </p>
                  </div>
                  <Badge className={rental.status === "overdue" ? "bg-red-100 text-red-700 border-0" : "bg-blue-100 text-blue-700 border-0"}>
                    {statusLabel(rental.status)}
                  </Badge>
                </div>
              ))}
              {activeRentals.length === 0 && overdueRentals.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("noActiveRentals")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Needs Attention */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">{t("needsAttention")}</h2>
            </div>
            <div className="space-y-3">
              {needsRepair.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/10 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{t("serialNumber")}: {item.serialNumber ?? "N/A"}</p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 border-0">{t("needsRepair")}</Badge>
                </div>
              ))}
              {upcomingMaint.slice(0, 3).map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{m.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabel(m.type)} &middot; {t("nextDue")}: {m.nextDue ? new Date(m.nextDue).toLocaleDateString(dateFmt) : new Date(m.performedAt).toLocaleDateString(dateFmt)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{typeLabel(m.type)}</Badge>
                </div>
              ))}
              {needsRepair.length === 0 && upcomingMaint.length === 0 && (
                <div className="text-center py-4">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t("allEquipmentGood")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
