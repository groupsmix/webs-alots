"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, Package, Truck, AlertCircle, RefreshCw, Eye, Loader2 } from "lucide-react";
import { useTenant } from "@/components/tenant-provider";
import { clinicConfig } from "@/config/clinic.config";
import { createClient } from "@/lib/supabase-client";

interface PrescriptionItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  available: boolean;
  price: number;
  notes?: string;
}

interface PharmacyPrescription {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  imageUrl: string;
  uploadedAt: string;
  status: "pending" | "reviewing" | "partially-ready" | "ready" | "picked-up" | "delivered" | "rejected";
  pharmacistNotes?: string;
  items: PrescriptionItem[];
  totalPrice: number;
  currency: string;
  deliveryOption: "pickup" | "delivery";
  deliveryAddress?: string;
  isChronic: boolean;
  refillReminderDate?: string;
  whatsappNotified: boolean;
}

async function fetchPrescriptionsClient(clinicId: string): Promise<PharmacyPrescription[]> {
  const supabase = createClient();

  const { data: requests, error } = await supabase
    .from("prescription_requests")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error || !requests) return [];

  const patientIds = [...new Set((requests as Record<string, unknown>[]).map((r) => r.patient_id as string))];
  const { data: users } = await supabase
    .from("users")
    .select("id, name, phone")
    .in("id", patientIds);

  const userMap = new Map(
    ((users ?? []) as { id: string; name: string; phone: string | null }[]).map((u) => [u.id, u]),
  );

  return requests.map((r: Record<string, unknown>) => {
    const patient = userMap.get(r.patient_id as string);
    let uiStatus = (r.status as string) ?? "pending";
    if (uiStatus === "partial") uiStatus = "partially-ready";

    return {
      id: r.id as string,
      patientId: (r.patient_id as string) ?? "",
      patientName: patient?.name ?? "Patient",
      patientPhone: patient?.phone ?? "",
      imageUrl: (r.image_url as string) ?? "",
      uploadedAt: (r.created_at as string) ?? "",
      status: uiStatus as PharmacyPrescription["status"],
      pharmacistNotes: (r.notes as string) ?? undefined,
      items: ((r.items as PrescriptionItem[]) ?? []),
      totalPrice: (r.total_price as number) ?? 0,
      currency: clinicConfig.currency,
      deliveryOption: ((r.delivery_option as string) ?? "pickup") as "pickup" | "delivery",
      deliveryAddress: (r.delivery_address as string) ?? undefined,
      isChronic: (r.is_chronic as boolean) ?? false,
      refillReminderDate: (r.refill_reminder_date as string) ?? undefined,
      whatsappNotified: (r.whatsapp_notified as boolean) ?? false,
    };
  });
}

const statusConfig: Record<PharmacyPrescription["status"], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending Review", color: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-3 w-3" /> },
  reviewing: { label: "Under Review", color: "bg-blue-100 text-blue-700", icon: <Eye className="h-3 w-3" /> },
  "partially-ready": { label: "Partially Ready", color: "bg-orange-100 text-orange-700", icon: <AlertCircle className="h-3 w-3" /> },
  ready: { label: "Ready", color: "bg-emerald-100 text-emerald-700", icon: <Check className="h-3 w-3" /> },
  "picked-up": { label: "Picked Up", color: "bg-gray-100 text-gray-700", icon: <Package className="h-3 w-3" /> },
  delivered: { label: "Delivered", color: "bg-gray-100 text-gray-700", icon: <Truck className="h-3 w-3" /> },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700", icon: <AlertCircle className="h-3 w-3" /> },
};

export default function PrescriptionHistoryPage() {
  const tenant = useTenant();
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPrescriptionsClient(tenant?.clinicId ?? "")
      .then((d) => { if (!controller.signal.aborted) setPrescriptions(d); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Prescription History</h1>
        <p className="text-muted-foreground mb-8">
          Track the status of your uploaded prescriptions
        </p>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Prescription History</h1>
      <p className="text-muted-foreground mb-8">
        Track the status of your uploaded prescriptions
      </p>

      {prescriptions.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No prescriptions yet</h3>
          <p className="text-muted-foreground">Upload your first prescription to get started</p>
        </div>
      ) : (
      <div className="space-y-4">
        {prescriptions.map((rx) => {
          const status = statusConfig[rx.status] ?? statusConfig.pending;
          const availableCount = rx.items.filter((i) => i.available).length;
          const totalItems = rx.items.length;

          return (
            <Card key={rx.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">Prescription #{rx.id.slice(0, 8).toUpperCase()}</h3>
                      <Badge className={`${status.color} border-0 gap-1`}>
                        {status.icon}
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Uploaded: {new Date(rx.uploadedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>

                    {/* Items */}
                    {rx.items.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {rx.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            {item.available ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-orange-500" />
                            )}
                            <span>{item.productName}</span>
                            <span className="text-muted-foreground">x{item.quantity}</span>
                          </div>
                          <span className="font-medium">{item.price} {rx.currency}</span>
                        </div>
                      ))}
                    </div>
                    )}

                    {rx.status === "partially-ready" && totalItems > 0 && (
                      <div className="flex items-center gap-2 text-sm text-orange-600 mb-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>{availableCount} of {totalItems} items ready</span>
                      </div>
                    )}

                    {rx.pharmacistNotes && (
                      <p className="text-sm text-muted-foreground italic">
                        Note: {rx.pharmacistNotes}
                      </p>
                    )}

                    {rx.isChronic && rx.refillReminderDate && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
                        <RefreshCw className="h-3 w-3" />
                        <span>Refill reminder: {rx.refillReminderDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {rx.totalPrice > 0 && (
                    <p className="text-lg font-bold text-emerald-600">
                      {rx.totalPrice} {rx.currency}
                    </p>
                    )}
                    <Badge variant="outline" className="mt-1 capitalize text-xs">
                      {rx.deliveryOption === "delivery" ? (
                        <><Truck className="h-3 w-3 mr-1" /> Delivery</>
                      ) : (
                        <><Package className="h-3 w-3 mr-1" /> Pickup</>
                      )}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}
