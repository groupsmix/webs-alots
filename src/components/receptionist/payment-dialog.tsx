"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaymentDialogProps {
  trigger?: React.ReactNode;
  patientName?: string;
  appointmentId?: string;
  suggestedAmount?: number;
  onCollect?: (payment: {
    appointmentId: string;
    amount: number;
    method: string;
    notes: string;
  }) => void;
}

export function PaymentDialog({
  trigger,
  patientName,
  appointmentId = "",
  suggestedAmount,
  onCollect,
}: PaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggestedAmount?.toString() ?? "");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || !method) return;
    onCollect?.({
      appointmentId,
      amount: numAmount,
      method,
      notes,
    });
    setOpen(false);
    setAmount(suggestedAmount?.toString() ?? "");
    setMethod("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <CreditCard className="h-4 w-4 mr-1" />
            Collect Payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Collect Payment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {patientName && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">{patientName}</p>
              {appointmentId && (
                <p className="text-xs text-muted-foreground">Appointment: {appointmentId}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Amount (MAD) *</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="transfer">Bank Transfer</SelectItem>
                <SelectItem value="online">Online Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Receipt number, reference..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {amount && method && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/20">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Collecting {parseFloat(amount).toFixed(2)} MAD via {method}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0 || !method}
            className="bg-green-600 hover:bg-green-700"
          >
            Mark as Paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
