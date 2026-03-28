"use client";

import { useState } from "react";
import { CreditCard, DollarSign, Shield, CheckCircle2, Smartphone, Building2, Banknote, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clinicConfig } from "@/config/clinic.config";
import { logger } from "@/lib/logger";
import { type MoroccanPaymentMethod } from "@/lib/morocco";

interface PaymentStepProps {
  appointmentId: string;
  patientId: string;
  patientName: string;
  servicePrice: number;
  currency: string;
  onPaymentComplete: (paymentId: string) => void;
  onSkip: () => void;
}

/**
 * PaymentStep
 *
 * Optional payment/deposit step during booking flow.
 * Supports deposit or full payment before confirming the appointment.
 */
export function PaymentStep({
  appointmentId,
  patientId,
  patientName,
  servicePrice,
  currency,
  onPaymentComplete,
  onSkip,
}: PaymentStepProps) {
  const [paymentType, setPaymentType] = useState<"deposit" | "full">("deposit");
  const [method, setMethod] = useState<MoroccanPaymentMethod | "online" | "card">("cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const depositPercentage = clinicConfig.booking.depositPercentage ?? 20;
  const fixedDeposit = clinicConfig.booking.depositAmount;
  const depositAmount = fixedDeposit ?? Math.round(servicePrice * (depositPercentage / 100));
  const paymentAmount = paymentType === "deposit" ? depositAmount : servicePrice;

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Initiate payment
      const initRes = await fetch("/api/booking/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          patientId,
          patientName,
          amount: paymentAmount,
          paymentType,
          method,
        }),
      });

      const initData = await initRes.json();

      if (!initRes.ok) {
        setError(initData.error ?? "Failed to initiate payment");
        return;
      }

      // Simulate payment gateway confirmation
      const confirmRes = await fetch("/api/booking/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: initData.paymentId }),
      });

      const confirmData = await confirmRes.json();

      if (!confirmRes.ok) {
        setError(confirmData.error ?? "Payment confirmation failed");
        return;
      }

      setPaymentSuccess(true);
      onPaymentComplete(initData.paymentId);
    } catch (err) {
      logger.warn("Payment processing failed", { context: "payment-step", error: err });
      setError("An error occurred during payment");
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="text-center py-6">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-3" />
        <h3 className="font-semibold text-lg">Payment Successful!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {paymentAmount} {currency} has been charged.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <CreditCard className="h-8 w-8 mx-auto text-primary mb-2" />
        <h3 className="font-semibold">Secure Payment</h3>
        <p className="text-sm text-muted-foreground">
          Choose to pay a deposit or the full amount
        </p>
      </div>

      {/* Payment type selection */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setPaymentType("deposit")}
          className={`rounded-lg border p-4 text-center transition-colors ${
            paymentType === "deposit" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
          }`}
        >
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-sm font-medium">Deposit</p>
          <p className="text-lg font-bold text-primary">
            {depositAmount} {currency}
          </p>
          <p className="text-xs text-muted-foreground">{depositPercentage}% of total</p>
        </button>
        <button
          onClick={() => setPaymentType("full")}
          className={`rounded-lg border p-4 text-center transition-colors ${
            paymentType === "full" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
          }`}
        >
          <Shield className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-sm font-medium">Full Payment</p>
          <p className="text-lg font-bold text-primary">
            {servicePrice} {currency}
          </p>
          <p className="text-xs text-muted-foreground">Pay in full now</p>
        </button>
      </div>

      {/* Payment method — Morocco-specific options */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Mode de paiement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <button
            onClick={() => setMethod("cash")}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors flex items-center gap-3 ${
              method === "cash" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <Banknote className="h-4 w-4" />
            <span>Espèces</span>
            {method === "cash" && <Badge className="ml-auto" variant="default">Selected</Badge>}
          </button>
          <button
            onClick={() => setMethod("cmi")}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors flex items-center gap-3 ${
              method === "cmi" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Carte CMI</span>
            {method === "cmi" && <Badge className="ml-auto" variant="default">Selected</Badge>}
          </button>
          <button
            onClick={() => setMethod("cashplus")}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors flex items-center gap-3 ${
              method === "cashplus" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>CashPlus</span>
            {method === "cashplus" && <Badge className="ml-auto" variant="default">Selected</Badge>}
          </button>
          <button
            onClick={() => setMethod("wafacash")}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors flex items-center gap-3 ${
              method === "wafacash" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Wafacash</span>
            {method === "wafacash" && <Badge className="ml-auto" variant="default">Selected</Badge>}
          </button>
          <button
            onClick={() => setMethod("baridbank")}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors flex items-center gap-3 ${
              method === "baridbank" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Barid Bank</span>
            {method === "baridbank" && <Badge className="ml-auto" variant="default">Selected</Badge>}
          </button>
          <button
            onClick={() => setMethod("check")}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors flex items-center gap-3 ${
              method === "check" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Chèque</span>
            {method === "check" && <Badge className="ml-auto" variant="default">Selected</Badge>}
          </button>
          <button
            onClick={() => setMethod("insurance")}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors flex items-center gap-3 ${
              method === "insurance" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Tiers payant (Assurance)</span>
            {method === "insurance" && <Badge className="ml-auto" variant="default">Selected</Badge>}
          </button>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Service Total</span>
          <span>{servicePrice} {currency}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold mt-1">
          <span>Amount Due Now</span>
          <span className="text-primary">{paymentAmount} {currency}</span>
        </div>
        {paymentType === "deposit" && (
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Remaining (pay at visit)</span>
            <span>{servicePrice - depositAmount} {currency}</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-between">
        <Button variant="ghost" onClick={onSkip}>
          Skip Payment
        </Button>
        <Button onClick={handlePayment} disabled={isProcessing}>
          {isProcessing ? "Processing..." : `Pay ${paymentAmount} ${currency}`}
        </Button>
      </div>
    </div>
  );
}
