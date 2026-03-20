"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InstallmentTracker } from "@/components/installments/installment-tracker";
import { InstallmentForm } from "@/components/installments/installment-form";
import {
  getCurrentUser,
  fetchInstallmentPlans,
  type InstallmentPlanView,
} from "@/lib/data/client";

export default function DoctorInstallmentsPage() {
  const [plans, setPlans] = useState<InstallmentPlanView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchInstallmentPlans(user.clinic_id);
    setPlans(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading installment plans...</p>
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
      `Amount: ${inst.amount.toLocaleString()} ${plan.currency}`,
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
