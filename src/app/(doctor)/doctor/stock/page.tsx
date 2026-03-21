"use client";

import { useState, useEffect } from "react";
import { MaterialStockAlert } from "@/components/dental/material-stock-alert";
import { getCurrentUser, fetchProducts, type ProductView } from "@/lib/data/client";

export default function DoctorStockPage() {
  const [stock, setStock] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user?.clinic_id) { setLoading(false); return; }
      const products = await fetchProducts(user.clinic_id);
      setStock(products);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading stock...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Material Stock</h1>
      <MaterialStockAlert stock={stock.map(p => ({ id: p.id, name: p.name, category: p.category ?? "General", quantity: p.stockQuantity, unit: "pcs", minThreshold: p.minimumStock, lastRestocked: p.expiryDate ?? "", supplier: p.manufacturer ?? "Unknown" }))} />
    </div>
  );
}
