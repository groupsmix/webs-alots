"use client";

import { useState, useEffect, useCallback } from "react";
import { InstallmentTracker } from "@/components/installments/installment-tracker";
import {
  getCurrentUser,
  fetchInstallmentPlans,
  type InstallmentPlanView,
} from "@/lib/data/client";

export default function PatientPaymentPlanPage() {
  const [myPlans, setMyPlans] = useState<InstallmentPlanView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const plans = await fetchInstallmentPlans(user.clinic_id);
    setMyPlans(plans.filter(p => p.patientId === user.id));
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading payment plans...</p>
      </div>
    );
  }

  const handleGenerateReceipt = (planId: string, installmentId: string) => {
    const plan = myPlans.find((p) => p.id === planId);
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
      <h1 className="text-2xl font-bold">Payment Plan</h1>
      <p className="text-sm text-muted-foreground">
        Track your installment payments and download receipts.
      </p>
      {myPlans.length === 0 ? (
        <p className="text-muted-foreground">No payment plans found.</p>
      ) : (
        <InstallmentTracker
          plans={myPlans}
          role="patient"
          onGenerateReceipt={handleGenerateReceipt}
        />
      )}
    </div>
  );
}
