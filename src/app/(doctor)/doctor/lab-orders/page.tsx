"use client";

import { useState, useEffect } from "react";
import { LabOrdersPanel } from "@/components/dental/lab-orders-panel";
import { getCurrentUser, fetchLabOrders, createLabOrder } from "@/lib/data/client";
import type { LabOrder } from "@/lib/types/dental";
import { PageLoader } from "@/components/ui/page-loader";

export default function DoctorLabOrdersPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchLabOrders(user.clinic_id);
      if (controller.signal.aborted) return;
    setOrders(data as LabOrder[]);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading lab orders..." />;
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

  const handleAddOrder = async (order: Omit<LabOrder, "id" | "createdAt" | "updatedAt">) => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;

    const newId = await createLabOrder({
      clinic_id: user.clinic_id,
      patient_id: order.patientId,
      doctor_id: order.doctorId,
      details: order.description,
      lab_name: order.labName || undefined,
      status: order.status,
      due_date: order.dueDate || undefined,
    });

    const today = new Date().toISOString().split("T")[0];
    setOrders((prev) => [
      {
        ...order,
        id: newId ?? `lo${prev.length + 1}`,
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
