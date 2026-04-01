"use client";

/**
 * Public Menu Display (Restaurant Vertical)
 *
 * Customer-facing menu page showing available items grouped by category.
 * Designed for QR code scanning — mobile-first, no authentication required.
 * Includes WhatsApp ordering integration.
 */

import {
  UtensilsCrossed,
  Leaf,
  AlertTriangle,
  RefreshCw,
  ShoppingCart,
  X,
  Plus,
  Minus,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Menu, MenuItem } from "@/lib/types/database";

// ── Types ──

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface PublicMenuDisplayProps {
  /** Clinic slug or ID for fetching the menu */
  clinicSlug: string;
  /** WhatsApp phone number for ordering (with country code) */
  whatsappNumber?: string;
  /** Table name (from QR code) */
  tableName?: string;
}

// ── Component ──

export function PublicMenuDisplay({
  clinicSlug,
  whatsappNumber,
  tableName,
}: PublicMenuDisplayProps) {
  const [menus, setMenus] = useState<(Menu & { items: MenuItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/menu?slug=${encodeURIComponent(clinicSlug)}`);
      const json = (await res.json()) as {
        ok: boolean;
        data?: { menus: (Menu & { items: MenuItem[] })[] };
        error?: string;
      };

      if (!json.ok || !json.data) {
        setError(json.error ?? "Menu indisponible.");
        return;
      }

      setMenus(json.data.menus);
    } catch {
      setError("Impossible de charger le menu.");
    } finally {
      setLoading(false);
    }
  }, [clinicSlug]);

  useEffect(() => {
    void fetchMenu();
  }, [fetchMenu]);

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
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((c) =>
          c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c,
        );
      }
      return prev.filter((c) => c.menuItem.id !== itemId);
    });
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const sendWhatsAppOrder = () => {
    if (!whatsappNumber || cart.length === 0) return;

    const lines = cart.map(
      (c) => `${c.quantity}x ${c.menuItem.name} — ${(c.menuItem.price * c.quantity).toFixed(2)} MAD`,
    );
    const tableInfo = tableName ? `\nTable: ${tableName}` : "";
    const message = encodeURIComponent(
      `Bonjour, je souhaite commander :\n\n${lines.join("\n")}\n\nTotal: ${cartTotal.toFixed(2)} MAD${tableInfo}`,
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  // Group items by category across all active menus
  const allItems = menus.flatMap((m) => m.items.filter((i) => i.is_available));
  const categories: Record<string, MenuItem[]> = {};
  for (const item of allItems) {
    const cat = item.category || "Autre";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchMenu()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      {/* Header */}
      <div className="text-center mb-6">
        <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 text-orange-500" />
        <h1 className="text-xl font-bold">Notre Menu</h1>
        {tableName && (
          <p className="text-sm text-muted-foreground mt-1">Table : {tableName}</p>
        )}
      </div>

      {/* Menu items by category */}
      {Object.entries(categories).map(([category, items]) => (
        <div key={category} className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 border-b pb-1">
            {category}
          </h2>
          <div className="space-y-3">
            {items.map((item) => {
              const inCart = cart.find((c) => c.menuItem.id === item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  {item.photo_url && (
                    <img
                      src={item.photo_url}
                      alt={item.name}
                      className="h-16 w-16 rounded-md object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">{item.name}</span>
                      {item.is_halal && (
                        <Leaf className="h-3 w-3 text-green-600 shrink-0" aria-label="Halal" />
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {item.allergens.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.allergens.map((a) => (
                          <Badge key={a} variant="outline" className="text-[9px] text-amber-600">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold text-orange-600">
                        {item.price.toFixed(2)} MAD
                      </span>
                      {whatsappNumber && (
                        <div className="flex items-center gap-1">
                          {inCart ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeFromCart(item.id)}
                                className="h-7 w-7 p-0"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm font-medium w-6 text-center">
                                {inCart.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addToCart(item)}
                                className="h-7 w-7 p-0"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addToCart(item)}
                              className="h-7 px-2 text-xs"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Ajouter
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {allItems.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Le menu est actuellement vide.</p>
          </CardContent>
        </Card>
      )}

      {/* Floating cart button */}
      {whatsappNumber && cartCount > 0 && (
        <>
          <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-50">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg"
              onClick={() => setShowCart(!showCart)}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Panier ({cartCount}) — {cartTotal.toFixed(2)} MAD
            </Button>
          </div>

          {/* Cart overlay */}
          {showCart && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
              <div className="bg-background w-full max-w-lg rounded-t-xl p-4 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Votre commande</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowCart(false)} className="h-7 w-7 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 mb-4">
                  {cart.map((c) => (
                    <div key={c.menuItem.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.quantity}x</span>
                        <span>{c.menuItem.name}</span>
                      </div>
                      <span className="font-medium">
                        {(c.menuItem.price * c.quantity).toFixed(2)} MAD
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 flex items-center justify-between font-semibold mb-4">
                  <span>Total</span>
                  <span>{cartTotal.toFixed(2)} MAD</span>
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={sendWhatsAppOrder}
                >
                  Commander via WhatsApp
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
