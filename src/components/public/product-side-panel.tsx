"use client";

import { MessageCircle, Phone, Package } from "lucide-react";
import type { ProductInfo } from "@/components/public/product-detail-modal";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

function getStockLabel(qty: number, min: number): { label: string; variant: "outline" | "secondary" | "destructive"; color: string } {
  if (qty === 0) return { label: "Out of Stock", variant: "destructive", color: "" };
  if (qty <= min) return { label: "Low Stock", variant: "secondary", color: "text-yellow-600" };
  return { label: "In Stock", variant: "outline", color: "text-emerald-600 border-emerald-600" };
}

function buildWhatsAppUrl(phone: string, product: ProductInfo): string {
  const text = encodeURIComponent(
    `Bonjour, je souhaite commander : ${product.name} (${product.price} ${product.currency}). Merci !`
  );
  const cleanPhone = phone.replace(/\s+/g, "");
  return `https://wa.me/${cleanPhone}?text=${text}`;
}

interface ProductSidePanelProps {
  product: ProductInfo | null;
  open: boolean;
  onClose: () => void;
  clinicPhone?: string;
}

export function ProductSidePanel({
  product,
  open,
  onClose,
  clinicPhone = "+212000000000",
}: ProductSidePanelProps) {
  if (!product) return null;

  const stock = getStockLabel(product.stockQuantity, product.minimumStock);

  return (
    <Sheet open={open}>
      <SheetContent side="right" onClose={onClose} className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{product.name}</SheetTitle>
          {product.genericName && (
            <SheetDescription className="italic">
              {product.genericName}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={product.requiresPrescription ? "destructive" : "secondary"}
            >
              {product.requiresPrescription ? "Rx Required" : "OTC"}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {product.category.replace("-", " ")}
            </Badge>
            <Badge variant={stock.variant} className={stock.color}>
              {stock.label}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed">{product.description}</p>

          {/* Details */}
          <div className="space-y-2 text-sm">
            {product.dosageForm && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Form</span>
                <span className="font-medium">
                  {product.dosageForm}
                  {product.strength ? ` - ${product.strength}` : ""}
                </span>
              </div>
            )}
            {product.manufacturer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manufacturer</span>
                <span className="font-medium">{product.manufacturer}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock</span>
              <span className="font-medium">{product.stockQuantity} units</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 border-t pt-4">
            <Package className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold text-emerald-600">
              {product.price} {product.currency}
            </span>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <a
              href={buildWhatsAppUrl(clinicPhone, product)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Order via WhatsApp
            </a>
            <a
              href={`tel:${clinicPhone.replace(/\s+/g, "")}`}
              className="w-full inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
