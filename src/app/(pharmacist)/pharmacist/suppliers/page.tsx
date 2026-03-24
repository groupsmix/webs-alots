"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus, Phone, Mail, MapPin, Star, Clock,
  Truck, ShoppingCart, Package,
} from "lucide-react";
import { useTenant } from "@/components/tenant-provider";
import { fetchSuppliers, fetchPurchaseOrders } from "@/lib/data/client";
import type { SupplierView, PurchaseOrderView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function SuppliersPage() {
  const tenant = useTenant();
  const [allSuppliers, setAllSuppliers] = useState<SupplierView[]>([]);
  const [allOrders, setAllOrders] = useState<PurchaseOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cId = tenant?.clinicId ?? "";
    Promise.all([fetchSuppliers(cId), fetchPurchaseOrders(cId)])
      .then(([s, o]) => { setAllSuppliers(s); setAllOrders(o); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading suppliers..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Supplier Contacts</h1>
          <p className="text-muted-foreground text-sm">Manage your supplier network and quick reorder</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" /> Add Supplier
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {allSuppliers.map((supplier) => {
          const activeOrders = allOrders.filter(
            (o) => o.supplierId === supplier.id && o.status !== "delivered" && o.status !== "cancelled"
          );

          return (
            <Card key={supplier.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{supplier.name}</h3>
                    <p className="text-sm text-muted-foreground">{supplier.contactPerson}</p>
                  </div>
                  <Badge variant={supplier.active ? "outline" : "secondary"}
                    className={supplier.active ? "text-emerald-600 border-emerald-600" : ""}>
                    {supplier.active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{supplier.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{supplier.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{supplier.address}, {supplier.city}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {supplier.categories.map((cat) => (
                    <Badge key={cat} variant="secondary" className="text-xs capitalize">
                      {cat}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3 py-3 border-t border-b mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
                      <Star className="h-3 w-3 fill-current" />
                      <span className="font-semibold text-sm">{supplier.rating}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Truck className="h-3 w-3" />
                      <span className="font-semibold text-sm">{supplier.deliveryDays} days</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Delivery</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Clock className="h-3 w-3" />
                      <span className="font-semibold text-sm">{supplier.paymentTerms}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Terms</p>
                  </div>
                </div>

                {activeOrders.length > 0 && (
                  <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-950/10 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">
                      <Package className="h-3 w-3 inline mr-1" />
                      {activeOrders.length} active order{activeOrders.length > 1 ? "s" : ""}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Phone className="mr-2 h-3 w-3" /> Call
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Mail className="mr-2 h-3 w-3" /> Email
                  </Button>
                  <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <ShoppingCart className="mr-2 h-3 w-3" /> Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
