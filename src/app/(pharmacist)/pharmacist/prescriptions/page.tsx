"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Clock, Check, Eye, AlertCircle, Package, Truck,
  Search, Phone, MessageCircle, RefreshCw, X, ClipboardList,
} from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { useTenant } from "@/lib/hooks/use-tenant";
import { fetchPrescriptionRequests } from "@/lib/data/client";
import type { PharmacyPrescriptionView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

type PrescriptionStatus = "pending" | "reviewing" | "partially-ready" | "ready" | "picked-up" | "delivered" | "rejected";

const statusConfig: Record<PrescriptionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-3 w-3" /> },
  reviewing: { label: "Reviewing", color: "bg-blue-100 text-blue-700", icon: <Eye className="h-3 w-3" /> },
  "partially-ready": { label: "Partial", color: "bg-orange-100 text-orange-700", icon: <AlertCircle className="h-3 w-3" /> },
  ready: { label: "Ready", color: "bg-emerald-100 text-emerald-700", icon: <Check className="h-3 w-3" /> },
  "picked-up": { label: "Picked Up", color: "bg-gray-100 text-gray-700", icon: <Package className="h-3 w-3" /> },
  delivered: { label: "Delivered", color: "bg-gray-100 text-gray-700", icon: <Truck className="h-3 w-3" /> },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700", icon: <X className="h-3 w-3" /> },
};

const statusFilters: PrescriptionStatus[] = ["pending", "reviewing", "partially-ready", "ready", "picked-up", "delivered"];

export default function PrescriptionsPage() {
  const { clinicId } = useTenant();
  const [allPrescriptions, setAllPrescriptions] = useState<PharmacyPrescriptionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchPrescriptionRequests(clinicId)
      .then((d) => { if (!controller.signal.aborted) setAllPrescriptions(d); })
      .catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading prescriptions..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }

  const filtered = allPrescriptions.filter((rx) => {
    if (filterStatus !== "all" && rx.status !== filterStatus) return false;
    if (searchQuery && !rx.patientName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Prescription Queue</h1>
          <p className="text-muted-foreground text-sm">Manage incoming prescription orders</p>
        </div>
        <Badge className="bg-yellow-100 text-yellow-700 border-0">
          {allPrescriptions.filter((rx) => rx.status === "pending").length} pending
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg text-sm ${filterStatus === "all" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}
          >
            All
          </button>
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filterStatus === s ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}
            >
              {s.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Prescription Cards */}
      <div className="space-y-4">
        {filtered.map((rx) => {
          const status = statusConfig[rx.status as PrescriptionStatus] ?? statusConfig.pending;
          const availableCount = rx.items.filter((i) => i.available).length;

          return (
            <Card key={rx.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-lg">{rx.patientName}</h3>
                      <Badge className={`${status.color} border-0 gap-1`}>
                        {status.icon} {status.label}
                      </Badge>
                      {rx.isChronic && (
                        <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                          <RefreshCw className="h-3 w-3 mr-1" /> Chronic
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {rx.patientPhone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(rx.uploadedAt).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        {rx.deliveryOption === "delivery" ? <Truck className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                        {rx.deliveryOption === "delivery" ? "Delivery" : "Pickup"}
                      </span>
                    </div>

                    {/* Items Table */}
                    <div className="bg-muted/50 rounded-lg p-3 mb-3">
                      <div className="space-y-2">
                        {rx.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {item.available ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                              )}
                              <span className="font-medium">{item.productName}</span>
                              <span className="text-muted-foreground">x{item.quantity}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span>{item.price} MAD</span>
                              {!item.available && item.notes && (
                                <span className="text-xs text-orange-500">{item.notes}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {rx.status === "partially-ready" && (
                        <div className="mt-2 pt-2 border-t text-sm text-orange-600">
                          {availableCount} of {rx.items.length} items available
                        </div>
                      )}
                    </div>

                    {rx.pharmacistNotes && (
                      <p className="text-sm text-muted-foreground italic mb-2">
                        Notes: {rx.pharmacistNotes}
                      </p>
                    )}

                    {rx.deliveryOption === "delivery" && rx.deliveryAddress && (
                      <p className="text-sm text-muted-foreground">
                        Delivery to: {rx.deliveryAddress}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    <div className="text-right mb-2">
                      <p className="text-2xl font-bold text-emerald-600">{rx.totalPrice} MAD</p>
                    </div>
                    {rx.status === "pending" && (
                      <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                        <Eye className="mr-2 h-4 w-4" /> Start Review
                      </Button>
                    )}
                    {rx.status === "reviewing" && (
                      <Button className="bg-emerald-600 hover:bg-emerald-700 w-full">
                        <Check className="mr-2 h-4 w-4" /> Mark Ready
                      </Button>
                    )}
                    {rx.status === "ready" && (
                      <Button className="bg-emerald-600 hover:bg-emerald-700 w-full">
                        <Package className="mr-2 h-4 w-4" /> Mark Picked Up
                      </Button>
                    )}
                    {!rx.whatsappNotified && rx.status !== "picked-up" && rx.status !== "delivered" && (
                      <Button variant="outline" className="w-full">
                        <MessageCircle className="mr-2 h-4 w-4" /> Notify via WhatsApp
                      </Button>
                    )}
                    {rx.whatsappNotified && (
                      <p className="text-xs text-emerald-600 text-center">WhatsApp sent</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No prescriptions found</h3>
          <p className="text-muted-foreground">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}
