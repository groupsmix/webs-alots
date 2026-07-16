"use client";

import { Edit, Loader2, Mail, Phone, Plus, Trash2 } from "lucide-react";
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
import type { ReceptionistView } from "@/lib/data/receptionists";
import { logger } from "@/lib/logger";

interface ReceptionistsClientProps {
  initialReceptionists: ReceptionistView[];
}

export default function ReceptionistsClient({ initialReceptionists }: ReceptionistsClientProps) {
  const { addToast } = useToast();
  const [receptionists, setReceptionists] = useState<ReceptionistView[]>(initialReceptionists);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReceptionistView | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formActive, setFormActive] = useState(true);

  const openAddDialog = () => {
    setEditing(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEditDialog = (r: ReceptionistView) => {
    setEditing(r);
    setFormName(r.name);
    setFormEmail(r.email);
    setFormPhone(r.phone);
    setFormActive(r.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateClinicUser(editing.id, {
          name: formName,
          email: formEmail,
          phone: formPhone,
        });
        if (formActive !== editing.active) {
          await setClinicUserActive(editing.id, formActive);
        }
        setReceptionists((prev) =>
          prev.map((r) =>
            r.id === editing.id
              ? { ...r, name: formName, email: formEmail, phone: formPhone, active: formActive }
              : r,
          ),
        );
        addToast("Receptionist updated", "success");
      } else {
        const row = await createClinicUser({
          role: "receptionist",
          name: formName,
          email: formEmail,
          phone: formPhone,
        });
        if (!formActive) {
          await setClinicUserActive(row.id, false);
        }
        setReceptionists((prev) => [
          ...prev,
          {
            id: row.id,
            name: row.name,
            email: row.email ?? formEmail,
            phone: row.phone ?? formPhone,
            active: formActive,
            createdAt: row.created_at?.split("T")[0] ?? "",
          },
        ]);
        addToast("Receptionist added", "success");
      }
      setDialogOpen(false);
    } catch (err) {
      logger.warn("Failed to save receptionist", { context: "admin/receptionists", error: err });
      addToast("Failed to save receptionist. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = receptionists;
    setReceptionists((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirm(null);
    try {
      await deleteClinicUser(id);
      addToast("Receptionist removed", "success");
    } catch (err) {
      logger.warn("Failed to delete receptionist", { context: "admin/receptionists", error: err });
      setReceptionists(previous);
      addToast("Failed to remove receptionist. Please try again.", "error");
    }
  };

  const toggleActive = async (id: string) => {
    const target = receptionists.find((r) => r.id === id);
    if (!target) return;
    const next = !target.active;
    setReceptionists((prev) => prev.map((r) => (r.id === id ? { ...r, active: next } : r)));
    try {
      await setClinicUserActive(id, next);
    } catch (err) {
      logger.warn("Failed to toggle receptionist", { context: "admin/receptionists", error: err });
      setReceptionists((prev) => prev.map((r) => (r.id === id ? { ...r, active: !next } : r)));
      addToast("Failed to update status. Please try again.", "error");
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Receptionists" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Receptionist Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff who handle bookings and patients daily
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 me-1" />
          Add Receptionist
        </Button>
      </div>

      <div className="space-y-4">
        {receptionists.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {r.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{r.name}</p>
                  <Badge variant={r.active ? "default" : "secondary"}>
                    {r.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {r.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {r.phone}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Added: {r.createdAt}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={r.active} onCheckedChange={() => toggleActive(r.id)} />
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(r)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500"
                  onClick={() => setDeleteConfirm(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {receptionists.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No receptionists added yet.</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Receptionist" : "Add New Receptionist"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the receptionist account details."
                : "Create a new receptionist account."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="Layla Amrani"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="receptionist@clinic.ma"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                placeholder="+212 6 55 11 22 33"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
              {editing ? "Save Changes" : "Add Receptionist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Receptionist</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this receptionist account? This action cannot be
              undone.
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
