"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Package, Plus, Filter,
  ArrowUpDown, ShoppingCart,
} from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import {
  fetchProducts,
  searchProductsLocal,
  getStockStatus,
  getExpiryStatus,
} from "@/lib/data/client";
import type { ProductView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

const categories = [
  { value: "all", label: "All" },
  { value: "medication", label: "Medications" },
  { value: "otc", label: "OTC" },
  { value: "cosmetics", label: "Cosmetics" },
  { value: "baby", label: "Baby" },
  { value: "medical-devices", label: "Devices" },
  { value: "supplements", label: "Supplements" },
];

const stockFilters = [
  { value: "all", label: "All Stock" },
  { value: "low", label: "Low Stock" },
  { value: "out", label: "Out of Stock" },
  { value: "ok", label: "In Stock" },
];

export default function StockPage() {
  const [allProducts, setAllProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "stock" | "expiry">("name");

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

  const filtered = useMemo(() => {
    let results: ProductView[];
    if (query.trim()) {
      results = searchProductsLocal(allProducts, query);
    } else {
      results = allProducts.filter((p) => p.active);
    }
    if (categoryFilter !== "all") {
      results = results.filter((p) => p.category === categoryFilter);
    }
    if (stockFilter !== "all") {
      results = results.filter((p) => getStockStatus(p) === stockFilter);
    }
    results.sort((a, b) => {
      if (sortBy === "stock") return a.stockQuantity - b.stockQuantity;
      if (sortBy === "expiry") return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      return a.name.localeCompare(b.name);
    });
    return results;
  }, [allProducts, query, categoryFilter, stockFilter, sortBy]);

  const totalValue = filtered.reduce((sum, p) => sum + p.price * p.stockQuantity, 0);

  if (loading) {
    return <PageLoader message="Loading stock data..." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Stock Management</h1>
          <p className="text-muted-foreground text-sm">Manage your pharmacy inventory</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Products</p>
            <p className="text-2xl font-bold">{allProducts.filter((p) => p.active).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Stock Value</p>
            <p className="text-2xl font-bold">{totalValue.toLocaleString()} <span className="text-sm font-normal">MAD</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Low Stock Items</p>
            <p className="text-2xl font-bold text-orange-500">{allProducts.filter((p) => getStockStatus(p) === "low").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Out of Stock</p>
            <p className="text-2xl font-bold text-red-500">{allProducts.filter((p) => getStockStatus(p) === "out").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2">
            {stockFilters.map((f) => (
              <button key={f.value} onClick={() => setStockFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${stockFilter === f.value ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {categories.map((cat) => (
            <button key={cat.value} onClick={() => setCategoryFilter(cat.value)}
              className={`px-2.5 py-1 rounded text-xs ${categoryFilter === cat.value ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
              {cat.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={() => setSortBy("name")} className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 ${sortBy === "name" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
              <ArrowUpDown className="h-3 w-3" /> Name
            </button>
            <button onClick={() => setSortBy("stock")} className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 ${sortBy === "stock" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
              <ArrowUpDown className="h-3 w-3" /> Stock
            </button>
            <button onClick={() => setSortBy("expiry")} className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 ${sortBy === "expiry" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
              <ArrowUpDown className="h-3 w-3" /> Expiry
            </button>
          </div>
        </div>
      </div>

      {/* Product Table */}
      <Card>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="py-3 px-2 font-medium">Product</th>
                  <th className="py-3 px-2 font-medium">Category</th>
                  <th className="py-3 px-2 font-medium">Price</th>
                  <th className="py-3 px-2 font-medium">Stock</th>
                  <th className="py-3 px-2 font-medium">Min Stock</th>
                  <th className="py-3 px-2 font-medium">Expiry</th>
                  <th className="py-3 px-2 font-medium">Status</th>
                  <th className="py-3 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const stock = getStockStatus(product);
                  const expiry = getExpiryStatus(product.expiryDate);
                  return (
                    <tr key={product.id} className="border-b hover:bg-muted/50 text-sm">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.genericName && <p className="text-xs text-muted-foreground">{product.genericName}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs capitalize">{product.category.replace("-", " ")}</Badge>
                      </td>
                      <td className="py-3 px-2 font-medium">{product.price} MAD</td>
                      <td className="py-3 px-2">
                        <span className={`font-bold ${stock === "out" ? "text-red-500" : stock === "low" ? "text-orange-500" : "text-emerald-600"}`}>
                          {product.stockQuantity}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{product.minimumStock}</td>
                      <td className="py-3 px-2">
                        <span className={`text-sm ${expiry === "red" ? "text-red-500 font-bold" : expiry === "yellow" ? "text-yellow-600" : "text-muted-foreground"}`}>
                          {product.expiryDate}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={stock === "ok" ? "outline" : "destructive"}
                          className={stock === "ok" ? "text-emerald-600 border-emerald-600 text-xs" : stock === "low" ? "bg-orange-100 text-orange-700 border-0 text-xs" : "text-xs"}>
                          {stock === "ok" ? "OK" : stock === "low" ? "Low" : "Out"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <Button variant="ghost" size="sm" className="text-xs">
                          <ShoppingCart className="h-3 w-3 mr-1" /> Reorder
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No products found</h3>
          <p className="text-muted-foreground">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}
