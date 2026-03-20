"use client";

import { useState } from "react";
import { DeliveryInvoicing } from "@/components/dental-lab/delivery-invoicing";

export default function AdminLabInvoicesPage() {
  const [deliveries] = useState<Parameters<typeof DeliveryInvoicing>[0]["deliveries"]>([]);
  const [invoices] = useState<Parameters<typeof DeliveryInvoicing>[0]["invoices"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Delivery & Invoicing</h1>
      <DeliveryInvoicing deliveries={deliveries} invoices={invoices} editable />
    </div>
  );
}
