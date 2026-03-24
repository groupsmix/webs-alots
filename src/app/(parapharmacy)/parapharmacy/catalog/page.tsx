"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, ShoppingBag, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  getCurrentUser,
  fetchParapharmacyProducts, fetchParapharmacyCategories, getStockStatus,
  createParapharmacyProduct, updateParapharmacyProduct, deleteParapharmacyProduct,
} from "@/lib/data/client";
import type { ProductView, ParapharmacyCategoryView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

const defaultForm = {
  name: "",
  genericName: "",
  category: "General",
  description: "",
  price: "",
  manufacturer: "",
  dosageForm: "",
  strength: "",
};

export default function ParapharmacyCatalogPage() {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [categories, setCategories] = useState<ParapharmacyCategoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // CRUD state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [clinicId, setClinicId] = useState<string | null>(null);

  const refreshProducts = useCallback(() => {
    if (!clinicId) return;
    fetchParapharmacyProducts(clinicId).then(setProducts);
  }, [clinicId]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      const cId = user?.clinic_id;
      if (!cId) { setLoading(false); return; }
      setClinicId(cId);
      const [p, c] = await Promise.all([
        fetchParapharmacyProducts(cId),
        fetchParapharmacyCategories(cId),
      ]);
      if (controller.signal.aborted) return;
      setProducts(p);
      setCategories(c);
    }
    load()
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  };

  const openEdit = (p: ProductView) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      genericName: p.genericName ?? "",
      category: p.category,
      description: p.description ?? "",
      price: String(p.price),
      manufacturer: p.manufacturer ?? "",
      dosageForm: p.dosageForm ?? "",
      strength: p.strength ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateParapharmacyProduct(editingId, {
          name: form.name,
          generic_name: form.genericName || null,
          category: form.category,
          description: form.description || null,
          price: parseFloat(form.price) || 0,
          manufacturer: form.manufacturer || null,
          dosage_form: form.dosageForm || null,
          strength: form.strength || null,
        });
      } else {
        await createParapharmacyProduct({
          clinic_id: clinicId!,
          name: form.name,
          generic_name: form.genericName || undefined,
          category: form.category || undefined,
          description: form.description || undefined,
          price: parseFloat(form.price) || 0,
          manufacturer: form.manufacturer || undefined,
          dosage_form: form.dosageForm || undefined,
          strength: form.strength || undefined,
        });
      }
      setDialogOpen(false);
      refreshProducts();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteParapharmacyProduct(deleteId);
      setDeleteId(null);
      refreshProducts();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageLoader message="Loading catalog..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
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
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Product
        </Button>
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
                <div className="flex gap-1 mt-3 pt-3 border-t">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(product)}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => setDeleteId(product.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
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

      {/* Add / Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update product details." : "Add a new product to the catalog."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Product name" />
              </div>
              <div className="grid gap-2">
                <Label>Generic Name</Label>
                <Input value={form.genericName} onChange={(e) => setForm((p) => ({ ...p, genericName: e.target.value }))} placeholder="Generic name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="Cosmetics">Cosmetics</SelectItem>
                    <SelectItem value="Supplements">Supplements</SelectItem>
                    <SelectItem value="Baby Care">Baby Care</SelectItem>
                    <SelectItem value="Hygiene">Hygiene</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Price (MAD)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Product description" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Manufacturer</Label>
                <Input value={form.manufacturer} onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))} placeholder="Brand" />
              </div>
              <div className="grid gap-2">
                <Label>Dosage Form</Label>
                <Input value={form.dosageForm} onChange={(e) => setForm((p) => ({ ...p, dosageForm: e.target.value }))} placeholder="e.g., Cream" />
              </div>
              <div className="grid gap-2">
                <Label>Strength</Label>
                <Input value={form.strength} onChange={(e) => setForm((p) => ({ ...p, strength: e.target.value }))} placeholder="e.g., 50mg" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open: boolean) => { if (!open) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
