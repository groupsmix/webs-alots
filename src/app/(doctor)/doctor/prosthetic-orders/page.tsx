"use client";

import { useState } from "react";
import { ProstheticOrders } from "@/components/dental-lab/prosthetic-orders";

export default function DoctorProstheticOrdersPage() {
  const [orders] = useState<Parameters<typeof ProstheticOrders>[0]["orders"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prosthetic Orders</h1>
      <ProstheticOrders orders={orders} editable />
    </div>
  );
}
