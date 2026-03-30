"use client";

import { useState } from "react";
import {
  CreditCard, Banknote, Smartphone, Building2,
  Wallet, FileText, Shield, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  PAYMENT_METHODS,
  formatMAD,
  calculateTVA,
  type MoroccanPaymentMethod,
  type InstallmentPlan,
  calculateInstallments,
} from "@/lib/morocco";
import { formatDisplayDate } from "@/lib/utils";

// ---- Payment method icon mapping ----

const PAYMENT_ICONS: Record<MoroccanPaymentMethod, typeof CreditCard> = {
  cash: Banknote,
  cmi: CreditCard,
  cashplus: Smartphone,
  wafacash: Smartphone,
  baridbank: Building2,
  bank_transfer: Building2,
  check: FileText,
  insurance: Shield,
  online: CreditCard,
};

// ---- Types ----

interface PaymentMethodSelectorProps {
  amount: number;
  onSelect: (method: MoroccanPaymentMethod) => void;
  onInstallmentSelect?: (plan: InstallmentPlan) => void;
  selectedMethod?: MoroccanPaymentMethod;
  /** Show installment option */
  allowInstallments?: boolean;
  /** Show TVA breakdown */
  showTVA?: boolean;
}

/**
 * PaymentMethodSelector
 *
 * Morocco-specific payment method selector with support for:
 * - Cash (espèces) — most common
 * - CMI card payment — local card gateway
 * - CashPlus — mobile money / cash deposit
 * - Wafacash — mobile money / cash deposit
 * - Barid Bank — postal bank transfer
 * - Bank transfer (virement)
 * - Check (chèque)
 * - Insurance (tiers payant)
 * - Online payment
 * - Installments (tqsit) — very common for dental
 */
export function PaymentMethodSelector({
  amount,
  onSelect,
  onInstallmentSelect,
  selectedMethod,
  allowInstallments = true,
  showTVA = true,
}: PaymentMethodSelectorProps) {
  const [showInstallments, setShowInstallments] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(3);

  const tva = showTVA ? calculateTVA(amount) : null;
  const installmentPlan = allowInstallments
    ? calculateInstallments(amount, installmentCount)
    : null;

  return (
    <div className="space-y-4">
      {/* TVA breakdown */}
      {tva && showTVA && (
        <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Montant HT</span>
            <span>{formatMAD(tva.amountHT)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TVA ({tva.tvaRateLabel})</span>
            <span>{formatMAD(tva.tvaAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-1">
            <span>Total TTC</span>
            <span className="text-primary">{formatMAD(tva.amountTTC)}</span>
          </div>
        </div>
      )}

      {/* Payment methods grid */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Mode de paiement</Label>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((pm) => {
            const Icon = PAYMENT_ICONS[pm.id] ?? Wallet;
            const isSelected = selectedMethod === pm.id;

            return (
              <button
                key={pm.id}
                onClick={() => {
                  onSelect(pm.id);
                  setShowInstallments(false);
                }}
                className={`rounded-lg border p-3 text-center transition-all hover:shadow-sm ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                <Icon className={`h-5 w-5 mx-auto mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-xs font-medium">{pm.name}</p>
                <p className="text-[10px] text-muted-foreground">{pm.nameFr}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Installments option */}
      {allowInstallments && (
        <div className="border-t pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInstallments}
              onChange={(e) => setShowInstallments(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-4 w-4 text-orange-600" />
              Paiement en plusieurs fois (تقسيط)
            </span>
          </label>

          {showInstallments && installmentPlan && (
            <Card className="mt-3 border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Plan de paiement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Nombre de versements</Label>
                  <div className="flex gap-2">
                    {[2, 3, 4, 6].map((n) => (
                      <button
                        key={n}
                        onClick={() => setInstallmentCount(n)}
                        className={`flex-1 rounded-lg border p-2 text-center text-sm transition-colors ${
                          installmentCount === n
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 font-medium"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Installment breakdown */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant total</span>
                    <span className="font-medium">{formatMAD(installmentPlan.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nombre de versements</span>
                    <span>{installmentPlan.numberOfPayments}x</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Montant par versement</span>
                    <span className="text-orange-600">{formatMAD(installmentPlan.amountPerPayment)}</span>
                  </div>
                </div>

                {/* Schedule */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Échéancier</Label>
                  {installmentPlan.schedule.map((payment, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                        i === 0 ? "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800" : "border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {i + 1}
                        </span>
                        <span>
                          {formatDisplayDate(payment.dueDate, "fr", "short")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatMAD(payment.amount)}</span>
                        {i === 0 && (
                          <Badge variant="outline" className="text-xs">
                            Aujourd&apos;hui
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  variant="default"
                  size="sm"
                  onClick={() => onInstallmentSelect?.(installmentPlan)}
                >
                  Confirmer le plan de paiement
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
