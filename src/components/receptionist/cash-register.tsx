"use client";

import { CreditCard, Check, Receipt } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CashRegisterProps {
  onPaymentRecorded?: (payment: {
    amount: number;
    method: string;
    notes: string;
    patientName: string;
  }) => void;
}

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "online", label: "Online Payment" },
  { value: "check", label: "Check" },
  { value: "insurance", label: "Insurance" },
];

export function CashRegister({ onPaymentRecorded }: CashRegisterProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [patientName, setPatientName] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || !method) return;

    onPaymentRecorded?.({
      amount: numAmount,
      method,
      notes,
      patientName,
    });

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setAmount("");
      setMethod("");
      setPatientName("");
      setNotes("");
    }, 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Cash Register
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-2">
          <Input
            placeholder="Patient name (optional)"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Amount (MAD)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Method..." />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.value} value={pm.value}>
                      {pm.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            placeholder="Receipt/reference..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
          />

          {amount && method && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-2 dark:border-green-900 dark:bg-green-950/20">
              <p className="text-xs font-medium text-green-800 dark:text-green-200">
                {parseFloat(amount).toFixed(2)} MAD via {paymentMethods.find((p) => p.value === method)?.label ?? method}
              </p>
            </div>
          )}

          <Button
            type="submit"
            size="sm"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={!amount || parseFloat(amount) <= 0 || !method}
          >
            {success ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Payment Recorded!
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-1" />
                Record Payment
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
