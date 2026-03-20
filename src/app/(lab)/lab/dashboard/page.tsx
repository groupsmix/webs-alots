"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, AlertTriangle, Clock, FlaskConical,
  ArrowRight, CheckCircle, Hourglass,
} from "lucide-react";
import Link from "next/link";
import { clinicConfig } from "@/config/clinic.config";
import { fetchLabTestOrders } from "@/lib/data/client";
import type { LabTestOrderView } from "@/lib/data/client";

export default function LabDashboardPage() {
  const [orders, setOrders] = useState<LabTestOrderView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLabTestOrders(clinicConfig.clinicId)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const pending = orders.filter((o) => o.status === "pending");
  const inProgress = orders.filter((o) => o.status === "sample_collected" || o.status === "in_progress");
  const completedToday = orders.filter((o) => {
    if (o.status !== "completed" && o.status !== "validated") return false;
    const today = new Date().toISOString().split("T")[0];
    return o.completedAt?.startsWith(today);
  });
  const urgent = orders.filter((o) => o.priority === "urgent" || o.priority === "stat");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lab Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of laboratory operations</p>
        </div>
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Clock className="h-3 w-3 mr-1" />
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Orders</p>
                <p className="text-3xl font-bold">{pending.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 flex items-center justify-center">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>
            <Link href="/lab/test-orders" className="text-sm text-blue-600 hover:underline mt-2 inline-flex items-center">
              View Orders <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{inProgress.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                <Hourglass className="h-6 w-6" />
              </div>
            </div>
            <Link href="/lab/results" className="text-sm text-blue-600 hover:underline mt-2 inline-flex items-center">
              Enter Results <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <p className="text-3xl font-bold text-emerald-600">{completedToday.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
            <Link href="/lab/reports" className="text-sm text-blue-600 hover:underline mt-2 inline-flex items-center">
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
        {/* Recent Orders */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Recent Orders</h2>
              <Link href="/lab/test-orders" className="text-sm text-blue-600 hover:underline">View All</Link>
            </div>
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{order.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.orderNumber} &middot; {order.testCount} test{order.testCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge className={
                    order.status === "pending" ? "bg-yellow-100 text-yellow-700 border-0" :
                    order.status === "in_progress" ? "bg-blue-100 text-blue-700 border-0" :
                    order.status === "completed" ? "bg-emerald-100 text-emerald-700 border-0" :
                    order.status === "validated" ? "bg-green-100 text-green-700 border-0" :
                    "bg-gray-100 text-gray-700 border-0"
                  }>
                    {order.priority === "stat" && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {order.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
              {orders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No test orders yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Urgent Queue */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Urgent Queue</h2>
            </div>
            <div className="space-y-3">
              {urgent.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/10 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{order.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.orderNumber} &middot; {order.testCount} test{order.testCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs uppercase">{order.priority}</Badge>
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {urgent.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No urgent orders</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
