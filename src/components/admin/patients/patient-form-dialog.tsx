"use client";

import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export interface PatientFormData {
  name: string;
  phone: string;
  email: string;
  insurance?: string;
  dateOfBirth?: string;
}

interface PatientFormDialogProps {
  mode: "add" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<PatientFormData>;
  onSave: (data: PatientFormData) => void;
  saving: boolean;
  error?: string;
  locale: Locale;
}

export function PatientFormDialog({
  mode,
  open,
  onOpenChange,
  initialData,
  onSave,
  saving,
  error,
  locale,
}: PatientFormDialogProps) {
  const [name, setName] = React.useState(initialData?.name ?? "");
  const [phone, setPhone] = React.useState(initialData?.phone ?? "");
  const [email, setEmail] = React.useState(initialData?.email ?? "");
  const [insurance, setInsurance] = React.useState(initialData?.insurance ?? "");
  const [dateOfBirth, setDateOfBirth] = React.useState(initialData?.dateOfBirth ?? "");

  const handleSubmit = () => {
    if (!name.trim() || !phone.trim()) return;
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      ...(mode === "edit"
        ? { insurance: insurance.trim() }
        : { dateOfBirth: dateOfBirth || undefined }),
    });
  };

  const isValid = name.trim().length > 0 && phone.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit"
              ? t(locale, "admin.patients.dialog.editTitle")
              : t(locale, "admin.patients.add")}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? t(locale, "admin.patients.dialog.editDescription")
              : t(locale, "admin.patients.addDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>{t(locale, "admin.patients.form.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          </div>
          <div className="space-y-2">
            <Label>{t(locale, "admin.patients.form.phone")}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saving}
              placeholder="+212 6XX XX XX XX"
            />
          </div>
          <div className="space-y-2">
            <Label>{t(locale, "admin.patients.form.email")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
            />
          </div>
          {mode === "edit" ? (
            <div className="space-y-2">
              <Label>{t(locale, "admin.patients.form.insurance")}</Label>
              <Input
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                disabled={saving}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t(locale, "admin.patients.form.dateOfBirth")}</Label>
              <Input
                type="date"
                value={dateOfBirth}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDateOfBirth(e.target.value)}
                disabled={saving}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t(locale, "admin.patients.dialog.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !isValid}>
            {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
            {mode === "edit"
              ? t(locale, "admin.patients.dialog.save")
              : t(locale, "admin.patients.dialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
