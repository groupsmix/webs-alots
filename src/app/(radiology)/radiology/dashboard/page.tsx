"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, Clock, Image as ImageIcon,
  ArrowRight, CheckCircle, Hourglass, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { clinicConfig } from "@/config/clinic.config";
import { useTenant } from "@/lib/hooks/use-tenant";
import { fetchRadiologyOrders } from "@/lib/data/client";
import type { RadiologyOrderView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function RadiologyDashboardPage() {
  const { clinicId } = useTenant();
  const [orders, setOrders] = useState<RadiologyOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchRadiologyOrders(clinicId)
      .then((d) => { if (!controller.signal.aborted) setOrders(d); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  const pending = orders.filter((o) => o.status === "pending" || o.status === "scheduled");
  const inProgress = orders.filter((o) => o.status === "in_progress" || o.status === "images_ready");
  const reported = orders.filter((o) => o.status === "reported" || o.status === "validated");
  const urgent = orders.filter((o) => o.priority === "urgent" || o.priority === "stat");

  const modalityCounts: Record<string, number> = {};
  for (const o of orders) {
    modalityCounts[o.modality] = (modalityCounts[o.modality] || 0) + 1;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Radiology Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of imaging operations</p>
        </div>
        <Badge variant="outline" className="text-indigo-600 border-indigo-600">
          <Clock className="h-3 w-3 mr-1" />
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Studies</p>
                <p className="text-3xl font-bold">{pending.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 flex items-center justify-center">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>
            <Link href="/radiology/orders" className="text-sm text-indigo-600 hover:underline mt-2 inline-flex items-center">
              View Orders <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-3xl font-bold text-indigo-600">{inProgress.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                <Hourglass className="h-6 w-6" />
              </div>
            </div>
            <Link href="/radiology/images" className="text-sm text-indigo-600 hover:underline mt-2 inline-flex items-center">
              Image Gallery <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reported</p>
                <p className="text-3xl font-bold text-emerald-600">{reported.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
            <Link href="/radiology/reports" className="text-sm text-indigo-600 hover:underline mt-2 inline-flex items-center">
              View Reports <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent / STAT</p>
                <p className="text-3xl font-bold text-red-500">{urgent.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Modality Breakdown */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-lg mb-4">Studies by Modality</h2>
            <div className="space-y-3">
              {Object.entries(modalityCounts).sort((a, b) => b[1] - a[1]).map(([modality, count]) => (
                <div key={modality} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium text-sm uppercase">{modality}</span>
                  </div>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
              {Object.keys(modalityCounts).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No studies yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Recent Orders</h2>
              <Link href="/radiology/orders" className="text-sm text-indigo-600 hover:underline">View All</Link>
            </div>
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{order.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.modality.toUpperCase()} &middot; {order.bodyPart ?? "N/A"} &middot; {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={
                    order.status === "pending" ? "bg-yellow-100 text-yellow-700 border-0" :
                    order.status === "in_progress" ? "bg-blue-100 text-blue-700 border-0" :
                    order.status === "reported" ? "bg-emerald-100 text-emerald-700 border-0" :
                    "bg-gray-100 text-gray-700 border-0"
                  }>
                    {order.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
              {orders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No orders yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
