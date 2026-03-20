"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ShoppingBag, Filter } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchParapharmacyProducts, fetchParapharmacyCategories, getStockStatus } from "@/lib/data/client";
import type { ProductView, ParapharmacyCategoryView } from "@/lib/data/client";

export default function ParapharmacyCatalogPage() {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [categories, setCategories] = useState<ParapharmacyCategoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    const cId = clinicConfig.clinicId;
    Promise.all([
      fetchParapharmacyProducts(cId),
      fetchParapharmacyCategories(cId),
    ])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading catalog...</div>
      </div>
    );
  }

  const filtered = products.filter((p) => {
    if (!p.active) return false;
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.manufacturer?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const uniqueCategories = [...new Set(products.map((p) => p.category))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Product Catalog</h1>
          <p className="text-muted-foreground text-sm">{products.filter((p) => p.active).length} active products</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={categoryFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("all")}>
            All
          </Button>
          {uniqueCategories.map((cat) => (
            <Button key={cat} variant={categoryFilter === cat ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter(cat)}>
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => {
          const stockStatus = getStockStatus(product);
          return (
            <Card key={product.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    {product.genericName && (
                      <p className="text-xs text-muted-foreground">{product.genericName}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">{product.category}</Badge>
                </div>
                {product.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{product.price} <span className="text-xs font-normal text-muted-foreground">MAD</span></p>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      stockStatus === "out" ? "bg-red-100 text-red-700 border-0" :
                      stockStatus === "low" ? "bg-orange-100 text-orange-700 border-0" :
                      "bg-emerald-100 text-emerald-700 border-0"
                    }>
                      {stockStatus === "out" ? "Out of Stock" : stockStatus === "low" ? `Low: ${product.stockQuantity}` : `In Stock: ${product.stockQuantity}`}
                    </Badge>
                  </div>
                </div>
                {product.manufacturer && (
                  <p className="text-xs text-muted-foreground mt-2">By {product.manufacturer}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No products match your search</p>
        </div>
      )}
    </div>
  );
}
