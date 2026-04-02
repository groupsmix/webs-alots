"use client";

import { UtensilsCrossed, Search, ShoppingCart, Send, X, QrCode } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";

interface MenuItem {
  id: string;
  menu_id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  is_available: boolean;
  allergens: string[] | null;
  is_halal: boolean;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export default function PublicMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/menu-items");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { items: MenuItem[] };
      setItems((data.items ?? []).filter((item) => item.is_available));
    } catch (err) {
      logger.warn("Failed to load menu items", { context: "public-menu", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItem.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((c) =>
        c.menuItem.id === itemId ? { ...c, quantity } : c,
      ),
    );
  };

  const totalAmount = cart.reduce(
    (sum, c) => sum + c.menuItem.price * c.quantity,
    0,
  );

  const handleWhatsAppOrder = () => {
    const orderText = cart
      .map((c) => `${c.quantity}x ${c.menuItem.name} (${(c.menuItem.price * c.quantity).toFixed(2)} MAD)`)
      .join("\n");
    const message = encodeURIComponent(
      `Bonjour, je souhaite commander:\n\n${orderText}\n\nTotal: ${totalAmount.toFixed(2)} MAD`,
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()),
  );

  const categories = [...new Set(filtered.map((i) => i.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <UtensilsCrossed className="h-10 w-10 mx-auto text-primary mb-2" />
        <h1 className="text-2xl font-bold">Our Menu</h1>
        <p className="text-sm text-muted-foreground">Browse our dishes and order via WhatsApp</p>
      </div>

      {/* Search + Cart toggle */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu..." className="pl-9" />
        </div>
        <Button
          variant="outline"
          className="relative"
          onClick={() => setShowCart(!showCart)}
        >
          <ShoppingCart className="h-4 w-4" />
          {cart.length > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
              {cart.reduce((sum, c) => sum + c.quantity, 0)}
            </Badge>
          )}
        </Button>
      </div>

      {/* Cart */}
      {showCart && cart.length > 0 && (
        <Card className="mb-4 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Your Order
              </span>
              <Badge>{totalAmount.toFixed(2)} MAD</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-3">
              {cart.map((c) => (
                <div key={c.menuItem.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="truncate">{c.menuItem.name}</span>
                    <span className="text-muted-foreground">×</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(c.menuItem.id, c.quantity - 1)}
                        className="h-5 w-5 rounded border text-xs flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-5 text-center">{c.quantity}</span>
                      <button
                        onClick={() => updateQuantity(c.menuItem.id, c.quantity + 1)}
                        className="h-5 w-5 rounded border text-xs flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{(c.menuItem.price * c.quantity).toFixed(2)}</span>
                    <button onClick={() => removeFromCart(c.menuItem.id)}>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handleWhatsAppOrder} className="w-full" size="sm">
              <Send className="h-3.5 w-3.5 mr-1" />
              Order via WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Menu Items by Category */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No menu items available at the moment.
          </CardContent>
        </Card>
      ) : (
        categories.map((category) => (
          <div key={category} className="mb-6">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">{category}</h2>
            <div className="space-y-2">
              {filtered
                .filter((item) => item.category === category)
                .map((item) => (
                  <Card key={item.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => addToCart(item)}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.name}</span>
                            {item.is_halal && (
                              <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">Halal</Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                          )}
                          {item.allergens && item.allergens.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {item.allergens.map((a) => (
                                <Badge key={a} variant="destructive" className="text-[9px] px-1 py-0">{a}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-bold whitespace-nowrap">{item.price.toFixed(2)} MAD</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={(e) => { e.stopPropagation(); addToCart(item); }}>
                            <Plus className="h-3 w-3 mr-0.5" />
                            Add
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
