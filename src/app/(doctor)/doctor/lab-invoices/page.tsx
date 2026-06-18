"use client";

import { useState, useEffect } from "react";
import { DeliveryInvoicing } from "@/components/dental-lab/delivery-invoicing";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchLabDeliveriesAndInvoices, getCurrentUser } from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function DoctorLabInvoicesPage() {
  const [deliveries, setDeliveries] = useState<
    Parameters<typeof DeliveryInvoicing>[0]["deliveries"]
  >([]);
  const [invoices, setInvoices] = useState<Parameters<typeof DeliveryInvoicing>[0]["invoices"]>([]);
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
      const data = await fetchLabDeliveriesAndInvoices(user.clinic_id);
      if (controller.signal.aborted) return;
      setDeliveries(data.deliveries);
      setInvoices(data.invoices);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        logger.warn("Failed to load lab invoices", { context: "doctor/lab-invoices", error: err });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  if (loading) return <PageLoader message="Loading lab invoices..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load lab invoicing data.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Lab Invoices" }]}
      />
      <h1 className="text-2xl font-bold">Deliveries & Invoices</h1>
      {/* Read-only view for doctors — invoice management is handled by clinic admin */}
      <DeliveryInvoicing deliveries={deliveries} invoices={invoices} />
    </div>
  );
}
