"use client";

import { Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  createClinicUser,
  deleteClinicUser,
  setClinicUserActive,
  updateClinicUser,
} from "@/lib/admin-actions";
import type { DoctorView } from "@/lib/data/doctors";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";

interface DoctorsClientProps {
  initialDoctors: DoctorView[];
}

export default function DoctorsClient({ initialDoctors }: DoctorsClientProps) {
  const { addToast } = useToast();
  const [doctorsList, setDoctorsList] = useState<DoctorView[]>(initialDoctors);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorView | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formSpecialty, setFormSpecialty] = useState("");
  const [formSpecialtyId, setFormSpecialtyId] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formFee, setFormFee] = useState(0);
  const [formLanguages, setFormLanguages] = useState("");

  const openAddDialog = () => {
    setEditingDoctor(null);
    setFormName("");
    setFormSpecialty("");
    setFormSpecialtyId("");
    setFormPhone("");
    setFormEmail("");
    setFormFee(0);
    setFormLanguages("");
    setDialogOpen(true);
  };

  const openEditDialog = (doctor: DoctorView) => {
    setEditingDoctor(doctor);
    setFormName(doctor.name);
    setFormSpecialty(doctor.specialty);
    setFormSpecialtyId(doctor.specialtyId);
    setFormPhone(doctor.phone);
    setFormEmail(doctor.email);
    setFormFee(doctor.consultationFee);
    setFormLanguages(doctor.languages.join(", "));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const langs = formLanguages
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    const metadata = {
      specialty: formSpecialty,
      specialty_id: formSpecialtyId,
      consultation_fee: formFee,
      languages: langs,
    };

    setSaving(true);
    try {
      if (editingDoctor) {
        await updateClinicUser(editingDoctor.id, {
          name: formName,
          email: formEmail,
          phone: formPhone,
          metadata,
        });
        setDoctorsList((prev) =>
          prev.map((d) =>
            d.id === editingDoctor.id
              ? {
                  ...d,
                  name: formName,
                  specialty: formSpecialty,
                  specialtyId: formSpecialtyId,
                  phone: formPhone,
                  email: formEmail,
                  consultationFee: formFee,
                  languages: langs,
                }
              : d,
          ),
        );
        addToast("Doctor updated", "success");
      } else {
        const row = await createClinicUser({
          role: "doctor",
          name: formName,
          email: formEmail,
          phone: formPhone,
          metadata,
        });
        setDoctorsList((prev) => [
          ...prev,
          {
            id: row.id,
            name: formName,
            specialty: formSpecialty,
            specialtyId: formSpecialtyId,
            phone: formPhone,
            email: formEmail,
            consultationFee: formFee,
            languages: langs,
            active: true,
          },
        ]);
        addToast("Doctor added", "success");
      }
      setDialogOpen(false);
    } catch (err) {
      logger.warn("Failed to save doctor", { context: "admin/doctors", error: err });
      addToast("Failed to save doctor. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = doctorsList;
    setDoctorsList((prev) => prev.filter((d) => d.id !== id));
    setDeleteConfirm(null);
    try {
      await deleteClinicUser(id);
      addToast("Doctor removed", "success");
    } catch (err) {
      logger.warn("Failed to delete doctor", { context: "admin/doctors", error: err });
      setDoctorsList(previous);
      addToast("Failed to remove doctor. Please try again.", "error");
    }
  };

  const toggleActive = async (id: string) => {
    const target = doctorsList.find((d) => d.id === id);
    if (!target) return;
    const next = !target.active;
    setDoctorsList((prev) => prev.map((d) => (d.id === id ? { ...d, active: next } : d)));
    try {
      await setClinicUserActive(id, next);
      addToast(next ? "Doctor reactivated" : "Doctor deactivated", "success");
    } catch (err) {
      logger.warn("Failed to toggle doctor", { context: "admin/doctors", error: err });
      setDoctorsList((prev) => prev.map((d) => (d.id === id ? { ...d, active: !next } : d)));
      addToast("Failed to update status. Please try again.", "error");
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Doctors" }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Doctors</h1>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 me-1" />
          Add Doctor
        </Button>
      </div>

      <div className="space-y-4">
        {doctorsList.map((doctor) => (
          <Card key={doctor.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {doctor.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{doctor.name}</p>
                  {!doctor.active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                <div className="flex gap-1 mt-1">
                  {doctor.languages.map((lang) => (
                    <Badge key={lang} variant="outline" className="text-[10px] px-1.5">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Consultation: {formatCurrency(doctor.consultationFee)}</p>
                <p>{doctor.phone}</p>
                <p className="text-xs">{doctor.email}</p>
              </div>
              <div className="flex items-center gap-1">
                <Switch
                  checked={doctor.active}
                  onCheckedChange={() => toggleActive(doctor.id)}
                  aria-label={doctor.active ? "Deactivate doctor" : "Reactivate doctor"}
                />
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(doctor)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500"
                  onClick={() => setDeleteConfirm(doctor.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {doctorsList.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              No doctors added yet. Click &quot;Add Doctor&quot; to get started.
            </p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDoctor ? "Edit Doctor" : "Add New Doctor"}</DialogTitle>
            <DialogDescription>
              {editingDoctor
                ? "Update the doctor's information below."
                : "Fill in the details to add a new doctor."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="Dr. Ahmed Benali"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Specialty</Label>
              <Input
                placeholder="General Medicine"
                value={formSpecialty}
                onChange={(e) => setFormSpecialty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Specialty Category</Label>
              <Input
                placeholder="Specialty category"
                value={formSpecialtyId}
                onChange={(e) => setFormSpecialtyId(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+212 6 12 34 56 78"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Consultation Fee (MAD)</Label>
                <Input
                  type="number"
                  value={formFee}
                  onChange={(e) => setFormFee(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="doctor@clinic.ma"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Languages (comma-separated)</Label>
              <Input
                placeholder="Arabic, French, English"
                value={formLanguages}
                onChange={(e) => setFormLanguages(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
              {editingDoctor ? "Save Changes" : "Add Doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Doctor</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this doctor? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
