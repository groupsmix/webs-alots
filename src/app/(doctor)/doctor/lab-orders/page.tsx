"use client";

import { useState, useEffect, useCallback } from "react";
import { LabOrdersPanel } from "@/components/dental/lab-orders-panel";
import { getCurrentUser, fetchLabOrders, type LabOrderView } from "@/lib/data/client";
import type { LabOrder } from "@/lib/types/dental";

export default function DoctorLabOrdersPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchLabOrders(user.clinic_id);
    setOrders(data as unknown as LabOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading lab orders...</p>
      </div>
    );
  }

  const handleUpdateStatus = (orderId: string, status: LabOrder["status"]) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status, updatedAt: new Date().toISOString().split("T")[0] }
          : o
      )
    );
  };

  const handleAddOrder = (order: Omit<LabOrder, "id" | "createdAt" | "updatedAt">) => {
    const today = new Date().toISOString().split("T")[0];
    setOrders((prev) => [
      {
        ...order,
        id: `lo${prev.length + 1}`,
        createdAt: today,
        updatedAt: today,
      },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lab Orders</h1>
      <LabOrdersPanel
        orders={orders}
        editable
        onUpdateStatus={handleUpdateStatus}
        onAddOrder={handleAddOrder}
      />
    </div>
  );
}
