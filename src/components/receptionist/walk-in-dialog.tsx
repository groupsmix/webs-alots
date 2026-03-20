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
import { doctors, services, patients } from "@/lib/demo-data";

interface WalkInDialogProps {
  trigger?: React.ReactNode;
  onRegister?: (walkIn: {
    patientId: string;
    isNewPatient: boolean;
    newPatientName?: string;
    newPatientPhone?: string;
    doctorId: string;
    serviceId: string;
    notes: string;
  }) => void;
}

export function WalkInDialog({ trigger, onRegister }: WalkInDialogProps) {
  const [open, setOpen] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (isNewPatient && (!newPatientName || !newPatientPhone)) return;
    if (!isNewPatient && !patientId) return;
    if (!doctorId || !serviceId) return;

    onRegister?.({
      patientId: isNewPatient ? "" : patientId,
      isNewPatient,
      newPatientName: isNewPatient ? newPatientName : undefined,
      newPatientPhone: isNewPatient ? newPatientPhone : undefined,
      doctorId,
      serviceId,
      notes,
    });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setIsNewPatient(false);
    setPatientId("");
    setNewPatientName("");
    setNewPatientPhone("");
    setDoctorId("");
    setServiceId("");
    setNotes("");
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button size="sm">
            <UserPlus className="h-4 w-4 mr-1" />
            Walk-in Registration
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]" onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Walk-in Registration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4">
              <Button
                variant={!isNewPatient ? "default" : "outline"}
                size="sm"
                onClick={() => setIsNewPatient(false)}
              >
                Existing Patient
              </Button>
              <Button
                variant={isNewPatient ? "default" : "outline"}
                size="sm"
                onClick={() => setIsNewPatient(true)}
              >
                New Patient
              </Button>
            </div>

            {isNewPatient ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    placeholder="Patient full name..."
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="+212 6XX XX XX XX"
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Patient</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Search or select patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} - {p.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor..." />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} - {d.specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service..." />
                </SelectTrigger>
                <SelectContent>
                  {services.filter((s) => s.active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.duration}min - {s.price} {s.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Reason for visit, symptoms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={
                (!isNewPatient && !patientId) ||
                (isNewPatient && (!newPatientName || !newPatientPhone)) ||
                !doctorId ||
                !serviceId
              }
            >
              Register Walk-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
