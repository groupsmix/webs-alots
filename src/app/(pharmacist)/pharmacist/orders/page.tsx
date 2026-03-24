"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus, Truck, Check, Package,
  Send, X, FileText,
} from "lucide-react";
import { useTenant } from "@/components/tenant-provider";
import { fetchPurchaseOrders, fetchSuppliers } from "@/lib/data/client";
import type { PurchaseOrderView, SupplierView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

type OrderStatus = "draft" | "sent" | "confirmed" | "shipped" | "delivered" | "cancelled";

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: <FileText className="h-3 w-3" /> },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700", icon: <Send className="h-3 w-3" /> },
  confirmed: { label: "Confirmed", color: "bg-emerald-100 text-emerald-700", icon: <Check className="h-3 w-3" /> },
  shipped: { label: "Shipped", color: "bg-purple-100 text-purple-700", icon: <Truck className="h-3 w-3" /> },
  delivered: { label: "Delivered", color: "bg-gray-100 text-gray-700", icon: <Package className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: <X className="h-3 w-3" /> },
};

export default function OrdersPage() {
  const tenant = useTenant();
  const [allOrders, setAllOrders] = useState<PurchaseOrderView[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<SupplierView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    const controller = new AbortController();
    const cId = tenant?.clinicId ?? "";
    Promise.all([fetchPurchaseOrders(cId), fetchSuppliers(cId)])
      .then(([o, s]) => { setAllOrders(o); setAllSuppliers(s); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, [tenant?.clinicId]);

  if (loading) {
    return <PageLoader message="Loading orders..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  const filtered = filterStatus === "all"
    ? allOrders
    : allOrders.filter((o) => o.status === filterStatus);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground text-sm">Order from suppliers and track deliveries</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" /> New Order
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold">{allOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Pending Delivery</p>
            <p className="text-2xl font-bold text-blue-600">
              {allOrders.filter((o) => o.status === "confirmed" || o.status === "shipped").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Value (Active)</p>
            <p className="text-2xl font-bold">
              {allOrders.filter((o) => o.status !== "cancelled" && o.status !== "delivered").reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString()} <span className="text-sm font-normal">MAD</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Suppliers</p>
            <p className="text-2xl font-bold">{allSuppliers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button onClick={() => setFilterStatus("all")}
          className={`px-3 py-1.5 rounded-lg text-sm ${filterStatus === "all" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
          All
        </button>
        {(["draft", "sent", "confirmed", "shipped", "delivered"] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filterStatus === s ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="space-y-4">
        {filtered.map((order) => {
          const status = statusConfig[order.status as OrderStatus] ?? statusConfig.draft;
          return (
            <Card key={order.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">Order #{order.id.toUpperCase()}</h3>
                      <Badge className={`${status.color} border-0 gap-1`}>
                        {status.icon} {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span><strong>Supplier:</strong> {order.supplierName}</span>
                      <span><strong>Created:</strong> {order.createdAt}</span>
                      <span><strong>Expected:</strong> {order.expectedDelivery}</span>
                    </div>

                    {/* Items */}
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground font-medium mb-2 px-1">
                        <span>Product</span>
                        <span className="text-right">Qty</span>
                        <span className="text-right">Unit Price</span>
                        <span className="text-right">Total</span>
                      </div>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-4 gap-2 text-sm py-1.5 px-1 border-t border-muted">
                          <span>{item.productName}</span>
                          <span className="text-right">{item.quantity}</span>
                          <span className="text-right">{item.unitPrice} MAD</span>
                          <span className="text-right font-medium">{(item.quantity * item.unitPrice).toLocaleString()} MAD</span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">Notes: {order.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 min-w-[160px]">
                    <div className="text-right mb-2">
                      <p className="text-2xl font-bold text-emerald-600">{order.totalAmount.toLocaleString()} MAD</p>
                      <p className="text-xs text-muted-foreground">{order.items.length} item{order.items.length > 1 ? "s" : ""}</p>
                    </div>
                    {order.status === "draft" && (
                      <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                        <Send className="mr-2 h-4 w-4" /> Send to Supplier
                      </Button>
                    )}
                    {order.status === "shipped" && (
                      <Button className="bg-emerald-600 hover:bg-emerald-700 w-full">
                        <Package className="mr-2 h-4 w-4" /> Mark Delivered
                      </Button>
                    )}
                    {order.status === "delivered" && order.deliveredAt && (
                      <p className="text-xs text-muted-foreground text-center">
                        Delivered: {order.deliveredAt}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
