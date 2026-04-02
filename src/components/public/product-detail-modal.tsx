"use client";

import { MessageCircle, Phone, Package, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ProductInfo {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  requiresPrescription: boolean;
  stockQuantity: number;
  minimumStock: number;
  manufacturer?: string;
  dosageForm?: string;
  strength?: string;
  active: boolean;
}

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

interface ProductDetailModalProps {
  product: ProductInfo | null;
  open: boolean;
  onClose: () => void;
  clinicPhone?: string;
}

export function ProductDetailModal({
  product,
  open,
  onClose,
  clinicPhone = "+212000000000",
}: ProductDetailModalProps) {
  if (!product) return null;

  const stock = getStockLabel(product.stockQuantity, product.minimumStock);

  return (
    <Dialog open={open}>
      <DialogContent
        onClose={onClose}
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
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

          {/* Generic name */}
          {product.genericName && (
            <p className="text-sm text-muted-foreground italic">
              {product.genericName}
            </p>
          )}

          {/* Description */}
          <p className="text-sm leading-relaxed">{product.description}</p>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {product.dosageForm && (
              <div>
                <span className="text-muted-foreground">Form:</span>{" "}
                <span className="font-medium">{product.dosageForm}</span>
              </div>
            )}
            {product.strength && (
              <div>
                <span className="text-muted-foreground">Strength:</span>{" "}
                <span className="font-medium">{product.strength}</span>
              </div>
            )}
            {product.manufacturer && (
              <div>
                <span className="text-muted-foreground">Manufacturer:</span>{" "}
                <span className="font-medium">{product.manufacturer}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Stock:</span>{" "}
              <span className="font-medium">{product.stockQuantity} units</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold text-emerald-600">
                {product.price} {product.currency}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={buildWhatsAppUrl(clinicPhone, product)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Order via WhatsApp
            </a>
            <a
              href={`tel:${clinicPhone.replace(/\s+/g, "")}`}
              className="flex-1 inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call
            </a>
          </div>

          {/* Close button for mobile */}
          <Button
            variant="ghost"
            className="w-full sm:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
