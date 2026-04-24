"use client";

import { useState, useEffect } from "react";
import { MaterialStockAlert } from "@/components/dental/material-stock-alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { getCurrentUser, fetchProducts, type ProductView } from "@/lib/data/client";

export default function DoctorStockPage() {
  const [stock, setStock] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }
      const products = await fetchProducts(user.clinic_id);
      setStock(products);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading stock..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Stock" }]} />
      <h1 className="text-2xl font-bold">Material Stock</h1>
      <MaterialStockAlert stock={stock.map(p => ({ id: p.id, name: p.name, category: p.category ?? "General", quantity: p.stockQuantity, unit: "pcs", minThreshold: p.minimumStock, lastRestocked: p.expiryDate ?? "", supplier: p.manufacturer ?? "Unknown" }))} />
    </div>
  );
}
