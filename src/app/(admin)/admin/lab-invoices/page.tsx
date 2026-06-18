"use client";

import { useEffect, useState } from "react";
import { DeliveryInvoicing } from "@/components/dental-lab/delivery-invoicing";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import { createClinicLabInvoice, updateClinicLabInvoiceStatus } from "@/lib/admin-actions";
import { fetchLabDeliveriesAndInvoices, getCurrentUser } from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { LabInvoiceStatus } from "@/lib/types/database";

function parseInvoiceItems(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [description = "", quantityRaw = "0", unitPriceRaw = "0"] = line
        .split("|")
        .map((part) => part.trim());
      const quantity = Number(quantityRaw);
      const unitPrice = Number(unitPriceRaw);
      return {
        description,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      };
    })
    .filter((item) => item.description && item.quantity > 0);
}

export default function AdminLabInvoicesPage() {
  const { addToast } = useToast();
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
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function reloadData() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const data = await fetchLabDeliveriesAndInvoices(user.clinic_id);
    setDeliveries(data.deliveries);
    setInvoices(data.invoices);
  }

  async function handleAddInvoice(invoice: {
    invoiceNumber: string;
    dentistName: string;
    items: string;
    dueDate: string;
    notes: string;
  }) {
    const items = parseInvoiceItems(invoice.items);
    if (items.length === 0) {
      addToast("Enter at least one valid invoice line", "error");
      return;
    }
    try {
      await createClinicLabInvoice({
        invoiceNumber: invoice.invoiceNumber,
        dentistName: invoice.dentistName,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        items,
      });
      await reloadData();
      addToast("Invoice created", "success");
    } catch (err) {
      logger.warn("Failed to create lab invoice", { context: "admin/lab-invoices", error: err });
      addToast("Failed to create invoice", "error");
    }
  }

  async function handleUpdateInvoiceStatus(invoiceId: string, status: LabInvoiceStatus) {
    const previous = invoices;
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === invoiceId
          ? {
              ...invoice,
              status,
              paidDate:
                status === "paid" ? new Date().toISOString().split("T")[0] : invoice.paidDate,
            }
          : invoice,
      ),
    );
    try {
      await updateClinicLabInvoiceStatus(invoiceId, status);
      addToast("Invoice status updated", "success");
    } catch (err) {
      logger.warn("Failed to update lab invoice status", {
        context: "admin/lab-invoices",
        error: err,
      });
      setInvoices(previous);
      addToast("Failed to update invoice", "error");
    }
  }

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
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Lab Invoices" }]}
      />
      <h1 className="text-2xl font-bold">Delivery & Invoicing</h1>
      <DeliveryInvoicing
        deliveries={deliveries}
        invoices={invoices}
        editable
        onAddInvoice={handleAddInvoice}
        onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
      />
    </div>
  );
}
