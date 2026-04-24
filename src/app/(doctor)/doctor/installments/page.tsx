"use client";

import { useState, useEffect } from "react";
import { InstallmentForm } from "@/components/installments/installment-form";
import { InstallmentTracker } from "@/components/installments/installment-tracker";
import { useLocale } from "@/components/locale-switcher";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getCurrentUser,
  fetchInstallmentPlans,
  type InstallmentPlanView,
} from "@/lib/data/client";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default function DoctorInstallmentsPage() {
  const [locale] = useLocale();

  const [plans, setPlans] = useState<InstallmentPlanView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchInstallmentPlans(user.clinic_id);
      if (controller.signal.aborted) return;
    setPlans(data);
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
    return <PageLoader message="Loading installment plans..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const handleMarkPaid = (planId: string, installmentId: string) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        return {
          ...p,
          installments: p.installments.map((i) =>
            i.id === installmentId
              ? { ...i, status: "paid" as const, paidDate: new Date().toISOString().split("T")[0] }
              : i
          ),
        };
      })
    );
  };

  const handleSendReminder = (planId: string, installmentId: string) => {
    alert(`WhatsApp reminder sent for installment ${installmentId} in plan ${planId}`);
  };

  const handleGenerateReceipt = (planId: string, installmentId: string) => {
    const plan = plans.find((p) => p.id === planId);
    const inst = plan?.installments.find((i) => i.id === installmentId);
    if (!plan || !inst) return;

    const receiptContent = [
      "=================================",
      "       PAYMENT RECEIPT",
      "=================================",
      "",
      `Patient: ${plan.patientName}`,
      `Treatment: ${plan.treatmentTitle}`,
      `Amount: ${formatNumber(inst.amount, typeof locale !== "undefined" ? locale : "fr")} ${plan.currency}`,
      `Date Paid: ${inst.paidDate}`,
      `Receipt ID: ${inst.receiptId || inst.id}`,
      "",
      "=================================",
      "      Thank you for your payment",
      "=================================",
    ].join("\n");

    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${inst.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Installments" }]} />
      <h1 className="text-2xl font-bold">Installment Payments</h1>

      <Tabs defaultValue="tracker">
        <TabsList>
          <TabsTrigger value="tracker">Payment Tracker</TabsTrigger>
          <TabsTrigger value="create">Create Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker" className="mt-4">
          <InstallmentTracker
            plans={plans}
            role="doctor"
            onMarkPaid={handleMarkPaid}
            onSendReminder={handleSendReminder}
            onGenerateReceipt={handleGenerateReceipt}
          />
        </TabsContent>

        <TabsContent value="create" className="mt-4">
          <InstallmentForm
            patientName="Karim Mansouri"
            treatmentTitle="Full Mouth Rehabilitation"
            defaultTotal={15500}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
