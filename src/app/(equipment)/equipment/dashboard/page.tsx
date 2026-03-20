"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package, HandCoins, Wrench, Clock,
  ArrowRight, AlertTriangle, CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { clinicConfig } from "@/config/clinic.config";
import { fetchEquipmentInventory, fetchEquipmentRentals, fetchEquipmentMaintenance } from "@/lib/data/client";
import type { EquipmentItemView, EquipmentRentalView, EquipmentMaintenanceView } from "@/lib/data/client";

export default function EquipmentDashboardPage() {
  const [inventory, setInventory] = useState<EquipmentItemView[]>([]);
  const [rentals, setRentals] = useState<EquipmentRentalView[]>([]);
  const [maintenance, setMaintenance] = useState<EquipmentMaintenanceView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cId = clinicConfig.clinicId;
    Promise.all([
      fetchEquipmentInventory(cId),
      fetchEquipmentRentals(cId),
      fetchEquipmentMaintenance(cId),
    ])
      .then(([inv, rent, maint]) => {
        setInventory(inv);
        setRentals(rent);
        setMaintenance(maint);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const available = inventory.filter((i) => i.isAvailable);
  const activeRentals = rentals.filter((r) => r.status === "active");
  const overdueRentals = rentals.filter((r) => r.status === "overdue");
  const upcomingMaint = maintenance.filter((m) => m.status === "scheduled");
  const needsRepair = inventory.filter((i) => i.condition === "needs_repair");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Equipment Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of medical equipment operations</p>
        </div>
        <Badge variant="outline" className="text-amber-600 border-amber-600">
          <Clock className="h-3 w-3 mr-1" />
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Equipment</p>
                <p className="text-3xl font-bold">{inventory.length}</p>
                <p className="text-xs text-muted-foreground">{available.length} available</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                <Package className="h-6 w-6" />
              </div>
            </div>
            <Link href="/equipment/inventory" className="text-sm text-amber-600 hover:underline mt-2 inline-flex items-center">
              View Inventory <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Rentals</p>
                <p className="text-3xl font-bold text-blue-600">{activeRentals.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                <HandCoins className="h-6 w-6" />
              </div>
            </div>
            <Link href="/equipment/rentals" className="text-sm text-amber-600 hover:underline mt-2 inline-flex items-center">
              View Rentals <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue Returns</p>
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
                <p className="text-sm text-muted-foreground">Scheduled Maintenance</p>
                <p className="text-3xl font-bold text-orange-500">{upcomingMaint.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                <Wrench className="h-6 w-6" />
              </div>
            </div>
            <Link href="/equipment/maintenance" className="text-sm text-amber-600 hover:underline mt-2 inline-flex items-center">
              View Schedule <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Rentals */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Active Rentals</h2>
              <Link href="/equipment/rentals" className="text-sm text-amber-600 hover:underline">View All</Link>
            </div>
            <div className="space-y-3">
              {[...overdueRentals, ...activeRentals].slice(0, 5).map((rental) => (
                <div key={rental.id} className={`flex items-center justify-between p-3 rounded-lg ${rental.status === "overdue" ? "bg-red-50 dark:bg-red-950/10" : "bg-muted/50"}`}>
                  <div>
                    <p className="font-medium text-sm">{rental.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {rental.clientName} &middot; Since {new Date(rental.rentalStart).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={rental.status === "overdue" ? "bg-red-100 text-red-700 border-0" : "bg-blue-100 text-blue-700 border-0"}>
                    {rental.status}
                  </Badge>
                </div>
              ))}
              {activeRentals.length === 0 && overdueRentals.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No active rentals</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Needs Attention */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Needs Attention</h2>
            </div>
            <div className="space-y-3">
              {needsRepair.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/10 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">S/N: {item.serialNumber ?? "N/A"}</p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 border-0">Needs Repair</Badge>
                </div>
              ))}
              {upcomingMaint.slice(0, 3).map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{m.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.type} &middot; Due: {m.nextDue ? new Date(m.nextDue).toLocaleDateString() : new Date(m.performedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{m.type}</Badge>
                </div>
              ))}
              {needsRepair.length === 0 && upcomingMaint.length === 0 && (
                <div className="text-center py-4">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">All equipment in good condition</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
