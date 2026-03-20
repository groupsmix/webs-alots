"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Download } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchLabTestOrders } from "@/lib/data/client";
import type { LabTestOrderView } from "@/lib/data/client";

export default function LabReportsPage() {
  const [orders, setOrders] = useState<LabTestOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchLabTestOrders(clinicConfig.clinicId)
      .then((all) => {
        setOrders(all.filter((o) => o.status === "completed" || o.status === "validated"));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading reports...</div>
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.patientName.toLowerCase().includes(q) || o.orderNumber.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lab Reports</h1>
          <p className="text-muted-foreground text-sm">Completed and validated test reports</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by patient or order number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((order) => (
          <Card key={order.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium">{order.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.orderNumber} &middot; {order.testCount} test{order.testCount !== 1 ? "s" : ""} &middot; Completed {order.completedAt ? new Date(order.completedAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={
                    order.status === "validated"
                      ? "bg-green-100 text-green-700 border-0"
                      : "bg-emerald-100 text-emerald-700 border-0"
                  }>
                    {order.status}
                  </Badge>
                  {order.pdfUrl ? (
                    <a
                      href={order.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      PDF
                    </a>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <FileText className="h-3 w-3 mr-1" />
                      No PDF
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No completed reports found</p>
          </div>
        )}
      </div>
    </div>
  );
}
