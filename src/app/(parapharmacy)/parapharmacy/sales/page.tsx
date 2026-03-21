"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Receipt, DollarSign, Plus, Minus, ShoppingCart, Loader2, Trash2 } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchDailySales, fetchParapharmacyProducts, createParapharmacySale } from "@/lib/data/client";
import type { DailySaleView, ProductView } from "@/lib/data/client";

interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

export default function ParapharmacySalesPage() {
  const [sales, setSales] = useState<DailySaleView[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // POS state
  const [posOpen, setPosOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const refreshSales = useCallback(() => {
    fetchDailySales(clinicConfig.clinicId).then(setSales);
  }, []);

  useEffect(() => {
    Promise.all([
      fetchDailySales(clinicConfig.clinicId),
      fetchParapharmacyProducts(clinicConfig.clinicId),
    ])
      .then(([s, p]) => {
        setSales(s);
        setProducts(p);
      })
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (product: ProductView) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        return prev.map((c) =>
          c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: 1,
      }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.productId === productId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);

  const handleCreateSale = async () => {
    if (cart.length === 0 || !customerName) return;
    setSaving(true);
    try {
      await createParapharmacySale({
        clinic_id: clinicConfig.clinicId,
        patient_name: customerName,
        payment_method: paymentMethod,
        items: cart.map((c) => ({
          product_id: c.productId,
          product_name: c.productName,
          quantity: c.quantity,
          unit_price: c.unitPrice,
        })),
      });
      setPosOpen(false);
      setCart([]);
      setCustomerName("");
      setPaymentMethod("cash");
      setProductSearch("");
      refreshSales();
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!p.active) return false;
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading sales...</div>
      </div>
    );
  }

  const filtered = sales.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.patientName.toLowerCase().includes(q) || s.items.some((i) => i.productName.toLowerCase().includes(q));
  });

  const today = new Date().toISOString().split("T")[0];
  const todaySales = filtered.filter((s) => s.date === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground text-sm">Parapharmacy sales records</p>
        </div>
        <Button onClick={() => setPosOpen(true)}>
          <ShoppingCart className="h-4 w-4 mr-2" /> New Sale
        </Button>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Today&apos;s Revenue</p>
              <p className="font-semibold">{todayRevenue.toLocaleString()} MAD</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search sales..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {filtered.map((sale) => (
          <Card key={sale.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                    <Receipt className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-medium">{sale.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.date} {sale.time} &middot; {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{sale.total} MAD</p>
                  <Badge variant="outline" className="text-xs capitalize">{sale.paymentMethod}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sale.items.map((item, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {item.productName} x{item.quantity}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No sales found</p>
          </div>
        )}
      </div>

      {/* POS Dialog */}
      <Dialog open={posOpen} onOpenChange={setPosOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Sale</DialogTitle>
            <DialogDescription>Create a new parapharmacy sale.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Customer Name *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
              </div>
              <div className="grid gap-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile">Mobile Payment</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product Search */}
            <div className="grid gap-2">
              <Label>Add Products</Label>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products to add..."
              />
              {productSearch && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {filteredProducts.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between"
                      onClick={() => { addToCart(p); setProductSearch(""); }}
                    >
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">{p.price} MAD</span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No products found</p>
                  )}
                </div>
              )}
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="border rounded-md">
                <div className="px-3 py-2 bg-muted/50 text-sm font-medium">Cart ({cart.length} items)</div>
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between px-3 py-2 border-t text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.unitPrice} MAD each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateCartQty(item.productId, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateCartQty(item.productId, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeFromCart(item.productId)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <span className="w-16 text-right font-medium">{(item.quantity * item.unitPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/50 font-semibold">
                  <span>Total</span>
                  <span>{cartTotal.toFixed(2)} MAD</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPosOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSale} disabled={saving || cart.length === 0 || !customerName}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Complete Sale ({cartTotal.toFixed(2)} MAD)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
