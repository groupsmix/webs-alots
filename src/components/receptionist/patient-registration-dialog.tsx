"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PatientFormData {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: "M" | "F" | "";
  address: string;
  cin: string;
  insurance: string;
  insuranceNumber: string;
  mutuelleName: string;
  mutuelleNumber: string;
  mutuelleCoverageRate: string;
  allergies: string;
  medicalHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

interface PatientRegistrationDialogProps {
  trigger?: React.ReactNode;
  onRegister?: (patient: PatientFormData) => void;
}

const initialForm: PatientFormData = {
  name: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  cin: "",
  insurance: "",
  insuranceNumber: "",
  mutuelleName: "",
  mutuelleNumber: "",
  mutuelleCoverageRate: "",
  allergies: "",
  medicalHistory: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
};

export function PatientRegistrationDialog({ trigger, onRegister }: PatientRegistrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PatientFormData>(initialForm);

  const updateField = (field: keyof PatientFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.name || !form.phone || !form.dateOfBirth || !form.gender) return;
    onRegister?.(form);
    setOpen(false);
    setForm(initialForm);
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button>
            <UserPlus className="h-4 w-4 mr-1" />
            Register New Patient
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Patient Registration Form
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Personal Information */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="Full name"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    placeholder="+212 6XX XX XX XX"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="patient@email.com"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth *</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <Select value={form.gender} onValueChange={(v) => updateField("gender", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CIN (National ID)</Label>
                  <Input
                    placeholder="XX000000"
                    value={form.cin}
                    onChange={(e) => updateField("cin", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    placeholder="Full address"
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Insurance */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Assurance / Insurance
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type d&apos;assurance</Label>
                  <Select value={form.insurance} onValueChange={(v) => updateField("insurance", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner l'assurance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune assurance</SelectItem>
                      <SelectItem value="CNSS">CNSS (70%)</SelectItem>
                      <SelectItem value="CNOPS">CNOPS (80%)</SelectItem>
                      <SelectItem value="AMO">AMO (70%)</SelectItem>
                      <SelectItem value="RAMED">RAMED (100%)</SelectItem>
                      <SelectItem value="private">Assurance privée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>N° d&apos;affiliation</Label>
                  <Input
                    placeholder="Numéro d'affiliation"
                    value={form.insuranceNumber}
                    onChange={(e) => updateField("insuranceNumber", e.target.value)}
                  />
                </div>
              </div>

              {/* Mutuelle (complementary insurance) */}
              {form.insurance && form.insurance !== "none" && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Mutuelle complémentaire (optionnel)</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Nom de la mutuelle</Label>
                      <Input
                        placeholder="Ex: MGPAP, OMFAM..."
                        value={form.mutuelleName}
                        onChange={(e) => updateField("mutuelleName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>N° d&apos;adhérent</Label>
                      <Input
                        placeholder="Numéro mutuelle"
                        value={form.mutuelleNumber}
                        onChange={(e) => updateField("mutuelleNumber", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Taux de couverture (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Ex: 20"
                        value={form.mutuelleCoverageRate}
                        onChange={(e) => updateField("mutuelleCoverageRate", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Medical */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Medical Information
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Allergies</Label>
                  <Textarea
                    placeholder="List any known allergies (one per line)..."
                    value={form.allergies}
                    onChange={(e) => updateField("allergies", e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Medical History</Label>
                  <Textarea
                    placeholder="Any relevant medical history, chronic conditions..."
                    value={form.medicalHistory}
                    onChange={(e) => updateField("medicalHistory", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Emergency Contact
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    placeholder="Emergency contact name"
                    value={form.emergencyContactName}
                    onChange={(e) => updateField("emergencyContactName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    placeholder="+212 6XX XX XX XX"
                    value={form.emergencyContactPhone}
                    onChange={(e) => updateField("emergencyContactPhone", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.name || !form.phone || !form.dateOfBirth || !form.gender}
            >
              Register Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
