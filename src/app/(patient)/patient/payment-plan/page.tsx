"use client";

import { useState, useEffect } from "react";
import { InstallmentTracker } from "@/components/installments/installment-tracker";
import { useLocale } from "@/components/locale-switcher";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import {
  getCurrentUser,
  fetchInstallmentPlans,
  type InstallmentPlanView,
} from "@/lib/data/client";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatCurrency, formatNumber } from "@/lib/utils";

export default function PatientPaymentPlanPage() {
  const [locale] = useLocale();

  const [myPlans, setMyPlans] = useState<InstallmentPlanView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const plans = await fetchInstallmentPlans(user.clinic_id);
      if (controller.signal.aborted) return;
    setMyPlans(plans.filter(p => p.patientId === user.id));
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
    return <PageLoader message="Loading payment plans..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
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
      <Breadcrumb items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Payment Plan" }]} />
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
