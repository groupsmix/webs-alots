"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PatientView } from "@/lib/data/client";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface PatientDeleteDialogProps {
  patient: PatientView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  locale: Locale;
}

export function PatientDeleteDialog({
  patient,
  open,
  onOpenChange,
  onConfirm,
  locale,
}: PatientDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t(locale, "admin.patients.dialog.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {patient
              ? t(locale, "admin.patients.dialog.deleteDescription", { name: patient.name })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t(locale, "admin.patients.dialog.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t(locale, "admin.patients.dialog.remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
