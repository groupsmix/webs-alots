"use client";

import { useState } from "react";
import { DeliveryInvoicing } from "@/components/dental-lab/delivery-invoicing";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DoctorLabInvoicesPage() {
  const [deliveries] = useState<Parameters<typeof DeliveryInvoicing>[0]["deliveries"]>([]);
  const [invoices] = useState<Parameters<typeof DeliveryInvoicing>[0]["invoices"]>([]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Lab Invoices" }]} />
      <h1 className="text-2xl font-bold">Deliveries & Invoices</h1>
      <DeliveryInvoicing deliveries={deliveries} invoices={invoices} editable />
    </div>
  );
}
