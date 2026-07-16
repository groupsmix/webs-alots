"use client";

import { Plus, Phone, Mail, MapPin, Star, Clock, Truck, ShoppingCart, Package } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import { fetchSuppliers, fetchPurchaseOrders, createSupplier } from "@/lib/data/client";
import type { SupplierView, PurchaseOrderView } from "@/lib/data/client";

const EMPTY_FORM = { name: "", contactPerson: "", phone: "", email: "", city: "" };

export default function SuppliersPage() {
  const tenant = useTenant();
  const { addToast } = useToast();
  const [allSuppliers, setAllSuppliers] = useState<SupplierView[]>([]);
  const [allOrders, setAllOrders] = useState<PurchaseOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const controller = new AbortController();
    const cId = tenant?.clinicId ?? "";
    Promise.all([fetchSuppliers(cId), fetchPurchaseOrders(cId)])
      .then(([s, o]) => {
        setAllSuppliers(s);
        setAllOrders(o);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [tenant?.clinicId]);

  async function handleAdd() {
    if (!form.name.trim()) return;
    const clinicId = tenant?.clinicId ?? "";
    if (!clinicId) {
      addToast("No clinic context found.", "error");
      return;
    }
    setSaving(true);
    const res = await createSupplier(clinicId, {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
    });
    setSaving(false);
    if (!res.success) {
      addToast(res.error.message || "Could not add supplier", "error");
      return;
    }
    setAllSuppliers((prev) => [res.data, ...prev]);
    addToast("Supplier added", "success");
    setAddOpen(false);
    setForm(EMPTY_FORM);
  }

  if (loading) {
    return <PageLoader message="Loading suppliers..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">
          Failed to load data. Please try refreshing the page.
        </p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Supplier Contacts</h1>
          <p className="text-muted-foreground text-sm">
            Manage your supplier network and quick reorder
          </p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setAddOpen(true)}>
          <Plus className="me-2 h-4 w-4" /> Add Supplier
        </Button>
      </div>

      {allSuppliers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No suppliers yet</p>
            <p className="text-sm mt-1">Add your first supplier to start tracking reorders.</p>
            <Button
              className="mt-4 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="me-2 h-4 w-4" /> Add Supplier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {allSuppliers.map((supplier) => {
            const activeOrders = allOrders.filter(
              (o) =>
                o.supplierId === supplier.id &&
                o.status !== "delivered" &&
                o.status !== "cancelled",
            );

            return (
              <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{supplier.name}</h3>
                      <p className="text-sm text-muted-foreground">{supplier.contactPerson}</p>
                    </div>
                    <Badge
                      variant={supplier.active ? "outline" : "secondary"}
                      className={supplier.active ? "text-emerald-600 border-emerald-600" : ""}
                    >
                      {supplier.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{supplier.phone || "\u2014"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{supplier.email || "\u2014"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {[supplier.address, supplier.city].filter(Boolean).join(", ") || "\u2014"}
                      </span>
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
                        <Package className="h-3 w-3 inline me-1" />
                        {activeOrders.length} active order{activeOrders.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {supplier.phone ? (
                      <a
                        href={`tel:${supplier.phone}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                          className: "flex-1",
                        })}
                      >
                        <Phone className="me-2 h-3 w-3" /> Call
                      </a>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1" disabled>
                        <Phone className="me-2 h-3 w-3" /> Call
                      </Button>
                    )}
                    {supplier.email ? (
                      <a
                        href={`mailto:${supplier.email}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                          className: "flex-1",
                        })}
                      >
                        <Mail className="me-2 h-3 w-3" /> Email
                      </a>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1" disabled>
                        <Mail className="me-2 h-3 w-3" /> Email
                      </Button>
                    )}
                    <Link
                      href={`/pharmacist/orders?supplier=${supplier.id}`}
                      className={buttonVariants({
                        size: "sm",
                        className: "flex-1 bg-emerald-600 hover:bg-emerald-700",
                      })}
                    >
                      <ShoppingCart className="me-2 h-3 w-3" /> Order
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
            <DialogDescription>Add a new supplier to your network.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="supName">Supplier Name</Label>
              <Input
                id="supName"
                placeholder="e.g. Cooper Pharma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supContact">Contact Person</Label>
              <Input
                id="supContact"
                placeholder="Full name"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supPhone">Phone</Label>
                <Input
                  id="supPhone"
                  type="tel"
                  placeholder="+212 5XX XX XX XX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supCity">City</Label>
                <Input
                  id="supCity"
                  placeholder="Casablanca"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supEmail">Email</Label>
              <Input
                id="supEmail"
                type="email"
                placeholder="contact@supplier.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAdd}
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Adding..." : "Add Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
