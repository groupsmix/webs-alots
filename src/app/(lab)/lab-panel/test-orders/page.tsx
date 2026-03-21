"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Filter, AlertTriangle, Clock, CheckCircle,
  FlaskConical, ChevronDown,
} from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchLabTestOrders } from "@/lib/data/client";
import type { LabTestOrderView } from "@/lib/data/client";

const statusOptions = ["all", "pending", "sample_collected", "in_progress", "completed", "validated", "cancelled"] as const;

export default function TestOrdersPage() {
  const [orders, setOrders] = useState<LabTestOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchLabTestOrders(clinicConfig.clinicId)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading test orders...</div>
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.patientName.toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q) ||
        (o.assignedTechnicianName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Test Orders</h1>
          <p className="text-muted-foreground text-sm">{orders.length} total orders</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient, order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="capitalize"
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((order) => (
          <Card key={order.id}>
            <CardContent className="pt-4 pb-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FlaskConical className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{order.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.orderNumber} &middot; {order.testCount} test{order.testCount !== 1 ? "s" : ""} &middot; {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(order.priority === "urgent" || order.priority === "stat") && (
                    <Badge variant="destructive" className="text-xs uppercase">{order.priority}</Badge>
                  )}
                  <Badge className={
                    order.status === "pending" ? "bg-yellow-100 text-yellow-700 border-0" :
                    order.status === "sample_collected" ? "bg-cyan-100 text-cyan-700 border-0" :
                    order.status === "in_progress" ? "bg-blue-100 text-blue-700 border-0" :
                    order.status === "completed" ? "bg-emerald-100 text-emerald-700 border-0" :
                    order.status === "validated" ? "bg-green-100 text-green-700 border-0" :
                    "bg-gray-100 text-gray-700 border-0"
                  }>
                    {order.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                    {order.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                    {order.status.replace("_", " ")}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === order.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedId === order.id && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Ordering Doctor</p>
                      <p className="font-medium">{order.orderingDoctorName ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Technician</p>
                      <p className="font-medium">{order.assignedTechnicianName ?? "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fasting Required</p>
                      <p className="font-medium">{order.fastingRequired ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Sample Collected</p>
                      <p className="font-medium">{order.sampleCollectedAt ? new Date(order.sampleCollectedAt).toLocaleString() : "—"}</p>
                    </div>
                  </div>
                  {order.clinicalNotes && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Clinical Notes</p>
                      <p>{order.clinicalNotes}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground text-xs mb-2">Tests</p>
                    <div className="flex flex-wrap gap-2">
                      {order.tests.map((t) => (
                        <Badge key={t.id} variant="outline" className="text-xs">
                          {t.testName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No orders match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
