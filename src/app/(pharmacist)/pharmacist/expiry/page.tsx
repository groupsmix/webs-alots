"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, Clock, X } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchProducts, getExpiryStatus } from "@/lib/data/client";
import type { ProductView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function ExpiryTrackerPage() {
  const [allProducts, setAllProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(clinicConfig.clinicId)
      .then((d) => { if (!controller.signal.aborted) setAllProducts(d); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  const products = useMemo(() => {
    return allProducts
      .filter((p) => p.active)
      .map((p) => ({
        ...p,
        expiryStatus: getExpiryStatus(p.expiryDate),
        daysUntilExpiry: Math.ceil(
          (new Date(p.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ),
      }))
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [allProducts]);

  if (loading) {
    return <PageLoader message="Loading expiry data..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  const expired = products.filter((p) => p.expiryStatus === "red");
  const expiringSoon = products.filter((p) => p.expiryStatus === "yellow");
  const safe = products.filter((p) => p.expiryStatus === "green");

  const colorMap = {
    red: { bg: "bg-red-50 dark:bg-red-950/10", border: "border-red-200 dark:border-red-800", badge: "bg-red-100 text-red-700", icon: <X className="h-4 w-4" />, label: "Expired" },
    yellow: { bg: "bg-yellow-50 dark:bg-yellow-950/10", border: "border-yellow-200 dark:border-yellow-800", badge: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-4 w-4" />, label: "Expiring Soon" },
    green: { bg: "bg-emerald-50 dark:bg-emerald-950/10", border: "border-emerald-200 dark:border-emerald-800", badge: "bg-emerald-100 text-emerald-700", icon: <Check className="h-4 w-4" />, label: "Safe" },
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Expiry Tracker</h1>
        <p className="text-muted-foreground text-sm">Monitor product expiration dates with color-coded alerts</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                <X className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-red-600">{expired.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expiring within 90 days</p>
                <p className="text-2xl font-bold text-yellow-600">{expiringSoon.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Safe (&gt;90 days)</p>
                <p className="text-2xl font-bold text-emerald-600">{safe.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Color-coded legend */}
      <div className="flex items-center gap-4 mb-6 text-sm">
        <span className="font-medium">Legend:</span>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-muted-foreground">Expired</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="text-muted-foreground">Expiring (within 90 days)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">Safe (&gt;90 days)</span>
        </div>
      </div>

      {/* Products List */}
      <Card>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="py-3 px-2 font-medium">Status</th>
                  <th className="py-3 px-2 font-medium">Product</th>
                  <th className="py-3 px-2 font-medium">Category</th>
                  <th className="py-3 px-2 font-medium">Expiry Date</th>
                  <th className="py-3 px-2 font-medium">Days Left</th>
                  <th className="py-3 px-2 font-medium">Stock Qty</th>
                  <th className="py-3 px-2 font-medium">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const config = colorMap[product.expiryStatus];
                  return (
                    <tr key={product.id} className={`border-b text-sm ${config.bg}`}>
                      <td className="py-3 px-2">
                        <Badge className={`${config.badge} border-0 gap-1 text-xs`}>
                          {config.icon}
                          {config.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <p className="font-medium">{product.name}</p>
                        {product.genericName && <p className="text-xs text-muted-foreground">{product.genericName}</p>}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs capitalize">{product.category.replace("-", " ")}</Badge>
                      </td>
                      <td className="py-3 px-2 font-medium">{product.expiryDate}</td>
                      <td className="py-3 px-2">
                        <span className={`font-bold ${product.expiryStatus === "red" ? "text-red-600" : product.expiryStatus === "yellow" ? "text-yellow-600" : "text-emerald-600"}`}>
                          {product.daysUntilExpiry <= 0 ? "EXPIRED" : `${product.daysUntilExpiry} days`}
                        </span>
                      </td>
                      <td className="py-3 px-2">{product.stockQuantity}</td>
                      <td className="py-3 px-2 font-medium">
                        {(product.price * product.stockQuantity).toLocaleString()} MAD
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
