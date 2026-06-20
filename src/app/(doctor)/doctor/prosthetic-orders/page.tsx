"use client";

import { useState, useEffect } from "react";
import { ProstheticOrders } from "@/components/dental-lab/prosthetic-orders";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchProstheticOrders,
  createProstheticOrder,
  updateProstheticOrderStatus,
  type ProstheticOrderView,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type {
  ProstheticOrderType,
  ProstheticOrderStatus,
  ProstheticPriority,
} from "@/lib/types/database";
import { getLocalDateStr } from "@/lib/utils";

export default function DoctorProstheticOrdersPage() {
  const { addToast } = useToast();
  const [orders, setOrders] = useState<ProstheticOrderView[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      setClinicId(user.clinic_id);
      const data = await fetchProstheticOrders(user.clinic_id);
      if (controller.signal.aborted) return;
      setOrders(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function handleAdd(data: {
    dentistName: string;
    patientName: string;
    orderType: ProstheticOrderType;
    material: string;
    shade: string;
    toothNumbers: string;
    dueDate: string;
    price: string;
    priority: ProstheticPriority;
    specialInstructions: string;
  }) {
    if (!clinicId) return;
    try {
      const { id } = await createProstheticOrder(clinicId, data);
      const teeth = data.toothNumbers
        .split(/[,\s]+/)
        .map((t) => parseInt(t.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      setOrders((prev) => [
        {
          id,
          dentistName: data.dentistName || null,
          dentistClinic: null,
          patientName: data.patientName || null,
          orderType: data.orderType,
          material: data.material || null,
          shade: data.shade || null,
          toothNumbers: teeth,
          description: null,
          specialInstructions: data.specialInstructions || null,
          status: "received" as ProstheticOrderStatus,
          priority: data.priority,
          receivedDate: getLocalDateStr(),
          dueDate: data.dueDate || null,
          completedDate: null,
          deliveredDate: null,
          price: data.price ? Number(data.price) : null,
          isPaid: false,
        },
        ...prev,
      ]);
      addToast("Order created", "success");
    } catch (err) {
      logger.warn("Failed to create prosthetic order", {
        context: "doctor/prosthetic-orders",
        error: err,
      });
      addToast("Failed to create order. Please try again.", "error");
    }
  }

  async function handleAdvanceStatus(orderId: string, newStatus: ProstheticOrderStatus) {
    if (!clinicId) return;
    const previous = orders;
    const today = getLocalDateStr();
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status: newStatus,
          completedDate: newStatus === "ready" ? today : o.completedDate,
          deliveredDate: newStatus === "delivered" ? today : o.deliveredDate,
        };
      }),
    );
    try {
      await updateProstheticOrderStatus(clinicId, orderId, newStatus);
    } catch (err) {
      logger.warn("Failed to advance prosthetic order status", {
        context: "doctor/prosthetic-orders",
        error: err,
      });
      setOrders(previous);
      addToast("Failed to update order status.", "error");
    }
  }

  if (loading) return <PageLoader message="Loading prosthetic orders..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load prosthetic orders.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Prosthetic Orders" }]}
      />
      <h1 className="text-2xl font-bold">Prosthetic Orders</h1>
      <ProstheticOrders
        orders={orders}
        editable
        onAdd={handleAdd}
        onAdvanceStatus={handleAdvanceStatus}
      />
    </div>
  );
}
