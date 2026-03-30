"use client";

import { useState } from "react";
import {
  CheckCircle, Clock, AlertCircle,
  FileText, MessageCircle, DollarSign, Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InstallmentPlanView as InstallmentPlan, InstallmentPaymentView as InstallmentPayment } from "@/lib/data/client";
import { formatDisplayDate } from "@/lib/utils";

const STATUS_CONFIG: Record<InstallmentPayment["status"], { icon: typeof Clock; color: string; variant: "default" | "success" | "destructive" | "outline" }> = {
  pending: { icon: Clock, color: "text-gray-500", variant: "outline" },
  paid: { icon: CheckCircle, color: "text-green-600", variant: "success" },
  overdue: { icon: AlertCircle, color: "text-red-500", variant: "destructive" },
};

interface InstallmentTrackerProps {
  plans: InstallmentPlan[];
  role: "patient" | "doctor" | "admin";
  onMarkPaid?: (planId: string, installmentId: string) => void;
  onSendReminder?: (planId: string, installmentId: string) => void;
  onGenerateReceipt?: (planId: string, installmentId: string) => void;
}

export function InstallmentTracker({
  plans,
  role,
  onMarkPaid,
  onSendReminder,
  onGenerateReceipt,
}: InstallmentTrackerProps) {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(plans[0]?.id ?? null);

  return (
    <div className="space-y-4">
      {plans.map((plan) => {
        const isExpanded = expandedPlan === plan.id;
        const paidInstallments = plan.installments.filter((i) => i.status === "paid");
        const totalPaid = plan.downPayment + paidInstallments.reduce((sum, i) => sum + i.amount, 0);
        const remainingBalance = plan.totalAmount - totalPaid;
        const progress = Math.round((totalPaid / plan.totalAmount) * 100);
        const nextDue = plan.installments.find((i) => i.status === "pending" || i.status === "overdue");

        return (
          <Card key={plan.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">{plan.treatmentTitle}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {plan.patientName} &middot; {plan.numberOfInstallments} installments
                  </p>
                </div>
                <Badge variant={plan.status === "active" ? "default" : plan.status === "completed" ? "success" : "destructive"} className="text-xs">
                  {plan.status}
                </Badge>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center p-2 border rounded-lg">
                  <p className="text-sm font-bold">{plan.totalAmount.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Total ({plan.currency})</p>
                </div>
                <div className="text-center p-2 border rounded-lg">
                  <p className="text-sm font-bold text-green-600">{totalPaid.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Paid</p>
                </div>
                <div className="text-center p-2 border rounded-lg">
                  <p className="text-sm font-bold text-orange-600">{remainingBalance.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Remaining</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{paidInstallments.length + 1}/{plan.numberOfInstallments + 1} payments</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {nextDue && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Next payment: {nextDue.amount.toLocaleString()} {plan.currency} due {formatDisplayDate(nextDue.dueDate, "fr", "short")}
                  </span>
                </div>
              )}
            </CardHeader>

            {isExpanded && (
              <CardContent>
                {/* Down Payment */}
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Down Payment</p>
                    <p className="text-xs text-muted-foreground">{plan.createdAt}</p>
                  </div>
                  <span className="text-sm font-medium text-green-600">{plan.downPayment.toLocaleString()} {plan.currency}</span>
                </div>

                {/* Installments */}
                <div className="space-y-2">
                  {plan.installments.map((inst) => {
                    const config = STATUS_CONFIG[inst.status];
                    const StatusIcon = config.icon;

                    return (
                      <div
                        key={inst.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          inst.status === "paid" ? "bg-green-50/50 dark:bg-green-950/20" :
                          inst.status === "overdue" ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800" :
                          ""
                        }`}
                      >
                        <StatusIcon className={`h-4 w-4 shrink-0 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              {inst.amount.toLocaleString()} {plan.currency}
                            </p>
                            <Badge variant={config.variant} className="text-xs">
                              {inst.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Due: {formatDisplayDate(inst.dueDate, "fr", "short")}
                            {inst.paidDate && ` | Paid: ${formatDisplayDate(inst.paidDate, "fr", "short")}`}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0">
                          {(role === "doctor" || role === "admin") && inst.status !== "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Mark as paid"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkPaid?.(plan.id, inst.id);
                              }}
                            >
                              <DollarSign className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                          {(role === "doctor" || role === "admin") && inst.status !== "paid" && plan.whatsappReminderEnabled && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Send WhatsApp reminder"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSendReminder?.(plan.id, inst.id);
                              }}
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                            </Button>
                          )}
                          {inst.status === "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Download receipt"
                              onClick={(e) => {
                                e.stopPropagation();
                                onGenerateReceipt?.(plan.id, inst.id);
                              }}
                            >
                              <FileText className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {plan.whatsappReminderEnabled && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground p-2 border rounded-lg">
                    <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                    WhatsApp reminders enabled - sent 3 days before due date
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
