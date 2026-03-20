"use client";

import { useState } from "react";
import { LabOrdersPanel } from "@/components/dental/lab-orders-panel";
import { labOrders as initialOrders, type LabOrder } from "@/lib/dental-demo-data";

export default function DoctorLabOrdersPage() {
  const [orders, setOrders] = useState<LabOrder[]>(initialOrders);

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
