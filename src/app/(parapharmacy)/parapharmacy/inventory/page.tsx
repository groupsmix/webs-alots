"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Package, AlertTriangle } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchParapharmacyProducts, getStockStatus, getExpiryStatus } from "@/lib/data/client";
import type { ProductView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function ParapharmacyInventoryPage() {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("all");

  useEffect(() => {
    fetchParapharmacyProducts(clinicConfig.clinicId)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageLoader message="Loading inventory..." />;
  }

  const filtered = products.filter((p) => {
    if (stockFilter === "low" && getStockStatus(p) !== "low") return false;
    if (stockFilter === "out" && getStockStatus(p) !== "out") return false;
    if (stockFilter === "ok" && getStockStatus(p) !== "ok") return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Manage parapharmacy stock levels</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {["all", "ok", "low", "out"].map((f) => (
            <Button key={f} variant={stockFilter === f ? "default" : "outline"} size="sm" onClick={() => setStockFilter(f)} className="capitalize">
              {f === "all" ? "All" : f === "ok" ? "In Stock" : f === "low" ? "Low Stock" : "Out of Stock"}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-medium">Product</th>
              <th className="pb-3 font-medium">Category</th>
              <th className="pb-3 font-medium text-right">Price</th>
              <th className="pb-3 font-medium text-right">Stock</th>
              <th className="pb-3 font-medium text-right">Min</th>
              <th className="pb-3 font-medium">Expiry</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const stockStatus = getStockStatus(p);
              const expiryStatus = p.expiryDate ? getExpiryStatus(p.expiryDate) : "green";
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-3">
                    <p className="font-medium">{p.name}</p>
                    {p.manufacturer && <p className="text-xs text-muted-foreground">{p.manufacturer}</p>}
                  </td>
                  <td className="py-3 text-muted-foreground">{p.category}</td>
                  <td className="py-3 text-right">{p.price} MAD</td>
                  <td className="py-3 text-right font-medium">{p.stockQuantity}</td>
                  <td className="py-3 text-right text-muted-foreground">{p.minimumStock}</td>
                  <td className="py-3">
                    {p.expiryDate ? (
                      <Badge className={
                        expiryStatus === "red" ? "bg-red-100 text-red-700 border-0" :
                        expiryStatus === "yellow" ? "bg-yellow-100 text-yellow-700 border-0" :
                        "bg-emerald-100 text-emerald-700 border-0"
                      }>
                        {p.expiryDate}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    <Badge className={
                      stockStatus === "out" ? "bg-red-100 text-red-700 border-0" :
                      stockStatus === "low" ? "bg-orange-100 text-orange-700 border-0" :
                      "bg-emerald-100 text-emerald-700 border-0"
                    }>
                      {stockStatus === "out" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {stockStatus === "out" ? "Out" : stockStatus === "low" ? "Low" : "OK"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No products match your filters</p>
        </div>
      )}
    </div>
  );
}
