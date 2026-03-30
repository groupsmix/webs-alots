"use client";

import { useState } from "react";
import { CreditCard, Calculator, Calendar, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDisplayDate } from "@/lib/utils";

interface InstallmentFormProps {
  patientName?: string;
  treatmentTitle?: string;
  defaultTotal?: number;
  onSubmit?: (data: InstallmentFormData) => void;
}

interface InstallmentFormData {
  totalAmount: number;
  downPayment: number;
  numberOfInstallments: number;
  startDate: string;
  whatsappReminder: boolean;
}

export function InstallmentForm({
  patientName = "",
  treatmentTitle = "",
  defaultTotal = 0,
  onSubmit,
}: InstallmentFormProps) {
  const [data, setData] = useState<InstallmentFormData>({
    totalAmount: defaultTotal,
    downPayment: 0,
    numberOfInstallments: 6,
    startDate: new Date().toISOString().split("T")[0],
    whatsappReminder: true,
  });
  const [submitted, setSubmitted] = useState(false);

  const remainingAfterDown = data.totalAmount - data.downPayment;
  const monthlyAmount = data.numberOfInstallments > 0
    ? Math.ceil(remainingAfterDown / data.numberOfInstallments)
    : 0;

  const generateSchedule = () => {
    const schedule = [];
    const start = new Date(data.startDate);
    for (let i = 0; i < data.numberOfInstallments; i++) {
      const date = new Date(start);
      date.setMonth(date.getMonth() + i + 1);
      schedule.push({
        month: i + 1,
        date: date.toISOString().split("T")[0],
        amount: i < data.numberOfInstallments - 1
          ? monthlyAmount
          : remainingAfterDown - monthlyAmount * (data.numberOfInstallments - 1),
      });
    }
    return schedule;
  };

  const schedule = generateSchedule();

  const handleSubmit = () => {
    onSubmit?.(data);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CreditCard className="h-8 w-8 mx-auto text-green-600 mb-3" />
          <p className="text-sm font-medium">Installment plan created!</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.numberOfInstallments} monthly payments of ~{monthlyAmount.toLocaleString()} MAD
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Create Installment Plan
        </CardTitle>
        {patientName && (
          <p className="text-xs text-muted-foreground">
            {patientName} {treatmentTitle && `- ${treatmentTitle}`}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Total Treatment Cost (MAD)</Label>
            <Input
              type="number"
              value={data.totalAmount}
              onChange={(e) => setData({ ...data, totalAmount: parseFloat(e.target.value) || 0 })}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Down Payment (MAD)</Label>
            <Input
              type="number"
              value={data.downPayment}
              onChange={(e) => setData({ ...data, downPayment: parseFloat(e.target.value) || 0 })}
              className="text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Number of Installments</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={data.numberOfInstallments}
              onChange={(e) => setData({ ...data, numberOfInstallments: parseInt(e.target.value) || 1 })}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Start Date</Label>
            <Input
              type="date"
              value={data.startDate}
              onChange={(e) => setData({ ...data, startDate: e.target.value })}
              className="text-sm"
            />
          </div>
        </div>

        {/* WhatsApp Reminder */}
        <div className="flex items-center justify-between rounded-lg border p-3 bg-green-50/50 dark:bg-green-950/20">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-4 w-4 text-green-500" />
            <div>
              <Label className="text-sm">WhatsApp Reminders</Label>
              <p className="text-xs text-muted-foreground">Auto-send 3 days before due date</p>
            </div>
          </div>
          <Switch
            checked={data.whatsappReminder}
            onCheckedChange={(checked) => setData({ ...data, whatsappReminder: checked })}
          />
        </div>

        {/* Calculation Summary */}
        <div className="rounded-lg border p-4 bg-muted/50">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Payment Summary</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div>
              <p className="text-lg font-bold">{data.totalAmount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total (MAD)</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{data.downPayment.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Down Payment</p>
            </div>
            <div>
              <p className="text-lg font-bold text-primary">{monthlyAmount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">~Monthly (MAD)</p>
            </div>
          </div>
        </div>

        {/* Payment Schedule Preview */}
        {schedule.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Payment Schedule
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {schedule.map((s) => (
                <div key={s.month} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span className="text-muted-foreground">Month {s.month}</span>
                  <span className="text-xs text-muted-foreground">{formatDisplayDate(s.date, "fr", "short")}</span>
                  <span className="font-medium">{s.amount.toLocaleString()} MAD</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSubmit} className="w-full">
          Create Installment Plan
        </Button>
      </CardContent>
    </Card>
  );
}
