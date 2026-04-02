"use client";

import { MessageCircle, Phone, Package, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase-client";

const DEFAULT_CURRENCY = "MAD";

interface ProductDetail {
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

function buildWhatsAppUrl(phone: string, product: ProductDetail): string {
  const text = encodeURIComponent(
    `Bonjour, je souhaite commander : ${product.name} (${product.price} ${product.currency}). Merci !`
  );
  const cleanPhone = phone.replace(/\s+/g, "");
  return `https://wa.me/${cleanPhone}?text=${text}`;
}

async function fetchProduct(clinicId: string, productId: string): Promise<ProductDetail | null> {
  const supabase = createClient();

  const [{ data: product }, { data: stockRow }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, generic_name, category, description, price, requires_prescription, is_active, manufacturer, barcode, dosage_form, strength")
      .eq("clinic_id", clinicId)
      .eq("id", productId)
      .maybeSingle(),
    supabase
      .from("stock")
      .select("quantity, min_threshold, expiry_date")
      .eq("clinic_id", clinicId)
      .eq("product_id", productId)
      .maybeSingle(),
  ]);

  if (!product) return null;

  const p = product as Record<string, unknown>;
  return {
    id: p.id as string,
    name: p.name as string,
    genericName: (p.generic_name as string) ?? undefined,
    category: (p.category as string) ?? "medication",
    description: (p.description as string) ?? "",
    price: (p.price as number) ?? 0,
    currency: DEFAULT_CURRENCY,
    requiresPrescription: (p.requires_prescription as boolean) ?? false,
    stockQuantity: (stockRow as Record<string, unknown> | null)?.quantity as number ?? 0,
    minimumStock: (stockRow as Record<string, unknown> | null)?.min_threshold as number ?? 0,
    manufacturer: (p.manufacturer as string) ?? undefined,
    dosageForm: (p.dosage_form as string) ?? undefined,
    strength: (p.strength as string) ?? undefined,
    active: (p.is_active as boolean) ?? true,
  };
}

export default function ProductLandingPage() {
  const params = useParams();
  const productId = params.id as string;
  const tenant = useTenant();
  const clinicPhone = "+212000000000";

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!tenant?.clinicId || !productId) {
      return;
    }

    fetchProduct(tenant.clinicId, productId)
      .then((p) => {
        if (!controller.signal.aborted) setProduct(p);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load product");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => { controller.abort(); };
  }, [tenant?.clinicId, productId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
        <p className="text-muted-foreground mb-6">
          {error ?? "The product you are looking for does not exist or has been removed."}
        </p>
        <Link
          href="/pharmacy/catalog"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Catalog
        </Link>
      </div>
    );
  }

  const stock = getStockLabel(product.stockQuantity, product.minimumStock);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Breadcrumb
        className="mb-6"
        items={[
          { label: "Catalog", href: "/pharmacy/catalog" },
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left column: Product info */}
        <div className="space-y-6">
          {/* Title & badges */}
          <div>
            <h1 className="text-3xl font-bold mb-3">{product.name}</h1>
            {product.genericName && (
              <p className="text-lg text-muted-foreground italic mb-3">
                {product.genericName}
              </p>
            )}
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
          </div>

          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Description</h2>
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Product details card */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">Product Details</h3>
              <div className="space-y-2 text-sm">
                {product.dosageForm && (
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Dosage Form</span>
                    <span className="font-medium">{product.dosageForm}</span>
                  </div>
                )}
                {product.strength && (
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Strength</span>
                    <span className="font-medium">{product.strength}</span>
                  </div>
                )}
                {product.manufacturer && (
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Manufacturer</span>
                    <span className="font-medium">{product.manufacturer}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Availability</span>
                  <span className="font-medium">{product.stockQuantity} units in stock</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Price & actions */}
        <div>
          <Card className="sticky top-24">
            <CardContent className="pt-6 space-y-6">
              {/* Price */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Price</p>
                <p className="text-4xl font-bold text-emerald-600">
                  {product.price} {product.currency}
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <a
                  href={buildWhatsAppUrl(clinicPhone, product)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Order via WhatsApp
                </a>
                <a
                  href={`tel:${clinicPhone.replace(/\s+/g, "")}`}
                  className="w-full inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call to Order
                </a>
              </div>

              {/* Prescription notice */}
              {product.requiresPrescription && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                  This product requires a valid prescription. Please have your
                  prescription ready when ordering.
                </div>
              )}

              {/* Back link */}
              <Link
                href="/pharmacy/catalog"
                className="w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Catalog
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
