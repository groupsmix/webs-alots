"use client";

import { useState } from "react";
import { CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface MarkUnavailableDialogProps {
  doctorId: string;
  clinicId: string;
  onComplete?: (result: {
    affectedCount: number;
    alternatives: Array<{ date: string; time: string; label: string }>;
  }) => void;
}

export function MarkUnavailableDialog({
  doctorId,
  clinicId,
  onComplete,
}: MarkUnavailableDialogProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    affectedCount: number;
    rebookingResults: Array<{
      appointmentId: string;
      patientName: string;
      whatsappSent: boolean;
    }>;
  } | null>(null);

  const handleSubmit = async () => {
    if (!startDate || !endDate) return;
    setSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/doctor-unavailability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId,
          clinicId,
          startDate,
          endDate,
          reason,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setResult({
          affectedCount: data.data.affectedCount,
          rebookingResults: data.data.rebookingResults ?? [],
        });
        onComplete?.({
          affectedCount: data.data.affectedCount,
          alternatives: data.data.alternatives ?? [],
        });
      }
    } catch {
      // Error handled silently - result stays null
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setStartDate("");
    setEndDate("");
    setReason("");
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <CalendarOff className="h-4 w-4 mr-1" />
        Mark Unavailable
      </Button>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent className="sm:max-w-[480px]" onClose={handleClose}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-red-600" />
              Mark Unavailable
            </DialogTitle>
          </DialogHeader>

          {!result ? (
            <>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Select a date range when you will be unavailable. Affected patients will
                  be notified via WhatsApp with alternative time slots.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date *</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    placeholder="e.g., Personal leave, Conference, etc."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSubmit}
                  disabled={!startDate || !endDate || submitting}
                >
                  {submitting ? "Processing..." : "Confirm & Notify Patients"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/20">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Unavailability recorded successfully
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    {result.affectedCount === 0
                      ? "No appointments were affected."
                      : `${result.affectedCount} appointment(s) affected.`}
                  </p>
                </div>

                {result.rebookingResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Patient Notifications:</p>
                    {result.rebookingResults.map((r) => (
                      <div
                        key={r.appointmentId}
                        className="flex items-center justify-between text-sm rounded-lg border p-2"
                      >
                        <span>{r.patientName}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            r.whatsappSent
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }`}
                        >
                          {r.whatsappSent ? "WhatsApp Sent" : "No phone"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={handleClose}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
