"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { getCurrentUser, fetchDoctors, type DoctorView } from "@/lib/data/client";

type Doctor = DoctorView;

export default function ManageDoctorsPage() {
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const docs = await fetchDoctors(user.clinic_id);
      if (controller.signal.aborted) return;
    setDoctorsList(docs);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formSpecialty, setFormSpecialty] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formFee, setFormFee] = useState(0);
  const [formLanguages, setFormLanguages] = useState("");
  const [formSpecialtyId, setFormSpecialtyId] = useState("");

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

  const openEditDialog = (doctor: Doctor) => {
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

  const handleSave = () => {
    if (!formName.trim()) return;
    const langs = formLanguages.split(",").map((l) => l.trim()).filter(Boolean);

    if (editingDoctor) {
      setDoctorsList(
        doctorsList.map((d) =>
          d.id === editingDoctor.id
            ? { ...d, name: formName, specialty: formSpecialty, specialtyId: formSpecialtyId, phone: formPhone, email: formEmail, consultationFee: formFee, languages: langs }
            : d
        )
      );
    } else {
      setDoctorsList([
        ...doctorsList,
        { id: `d${Date.now()}`, name: formName, specialty: formSpecialty, specialtyId: formSpecialtyId, phone: formPhone, email: formEmail, consultationFee: formFee, languages: langs },
      ]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setDoctorsList(doctorsList.filter((d) => d.id !== id));
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load data. Please try refreshing the page.</p>
      </div>
    );
  }


  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Doctors</h1>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" />
          Add Doctor
        </Button>
      </div>

      <div className="space-y-4">
        {doctorsList.map((doctor) => (
          <Card key={doctor.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {doctor.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{doctor.name}</p>
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
                <p>Consultation: {doctor.consultationFee} MAD</p>
                <p>{doctor.phone}</p>
                <p className="text-xs">{doctor.email}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(doctor)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteConfirm(doctor.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {doctorsList.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No doctors added yet. Click &quot;Add Doctor&quot; to get started.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Doctor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDoctor ? "Edit Doctor" : "Add New Doctor"}</DialogTitle>
            <DialogDescription>
              {editingDoctor ? "Update the doctor's information below." : "Fill in the details to add a new doctor."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="Dr. Ahmed Benali" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Specialty</Label>
              <Input placeholder="General Medicine" value={formSpecialty} onChange={(e) => setFormSpecialty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Specialty Category</Label>
              <Input placeholder="Specialty category" value={formSpecialtyId} onChange={(e) => setFormSpecialtyId(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+212 6 12 34 56 78" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Consultation Fee (MAD)</Label>
                <Input type="number" value={formFee} onChange={(e) => setFormFee(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="doctor@clinic.ma" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Languages (comma-separated)</Label>
              <Input placeholder="Arabic, French, English" value={formLanguages} onChange={(e) => setFormLanguages(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingDoctor ? "Save Changes" : "Add Doctor"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Doctor</DialogTitle>
            <DialogDescription>Are you sure you want to remove this doctor? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
