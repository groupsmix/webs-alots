"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, Package, Truck, AlertCircle, RefreshCw, Eye } from "lucide-react";
import { pharmacyPrescriptions } from "@/lib/pharmacy-demo-data";
import type { PharmacyPrescription } from "@/lib/pharmacy-demo-data";

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
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Prescription History</h1>
      <p className="text-muted-foreground mb-8">
        Track the status of your uploaded prescriptions
      </p>

      <div className="space-y-4">
        {pharmacyPrescriptions.map((rx) => {
          const status = statusConfig[rx.status];
          const availableCount = rx.items.filter((i) => i.available).length;
          const totalItems = rx.items.length;

          return (
            <Card key={rx.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">Prescription #{rx.id.toUpperCase()}</h3>
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
                          <span className="font-medium">{item.price} MAD</span>
                        </div>
                      ))}
                    </div>

                    {rx.status === "partially-ready" && (
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
                    <p className="text-lg font-bold text-emerald-600">
                      {rx.totalPrice} {rx.currency}
                    </p>
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
    </div>
  );
}
