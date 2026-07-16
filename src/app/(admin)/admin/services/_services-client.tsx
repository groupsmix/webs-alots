"use client";

import { Clock, CreditCard, Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  createClinicService,
  deleteClinicService,
  setClinicServiceActive,
  updateClinicService,
} from "@/lib/admin-actions";
import type { ServiceView } from "@/lib/data/services";
import { logger } from "@/lib/logger";

interface ServicesClientProps {
  initialServices: ServiceView[];
}

export default function ServicesClient({ initialServices }: ServicesClientProps) {
  const { addToast } = useToast();
  const [servicesList, setServicesList] = useState<ServiceView[]>(initialServices);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceView | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDuration, setFormDuration] = useState(30);
  const [formPrice, setFormPrice] = useState(0);
  const [formCurrency, setFormCurrency] = useState("MAD");
  const [formActive, setFormActive] = useState(true);

  const openAddDialog = () => {
    setEditingService(null);
    setFormName("");
    setFormDescription("");
    setFormDuration(30);
    setFormPrice(0);
    setFormCurrency("MAD");
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEditDialog = (service: ServiceView) => {
    setEditingService(service);
    setFormName(service.name);
    setFormDescription(service.description);
    setFormDuration(service.duration);
    setFormPrice(service.price);
    setFormCurrency(service.currency);
    setFormActive(service.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingService) {
        await updateClinicService(editingService.id, {
          name: formName,
          description: formDescription,
          duration_minutes: formDuration,
          price: formPrice,
          currency: formCurrency,
          is_active: formActive,
        });
        setServicesList((prev) =>
          prev.map((s) =>
            s.id === editingService.id
              ? {
                  ...s,
                  name: formName,
                  description: formDescription,
                  duration: formDuration,
                  price: formPrice,
                  currency: formCurrency,
                  active: formActive,
                }
              : s,
          ),
        );
        addToast("Service updated", "success");
      } else {
        const row = await createClinicService({
          name: formName,
          description: formDescription,
          duration_minutes: formDuration,
          price: formPrice,
          currency: formCurrency,
          is_active: formActive,
        });
        setServicesList((prev) => [
          ...prev,
          {
            id: row.id,
            name: formName,
            description: formDescription,
            duration: formDuration,
            price: formPrice,
            currency: formCurrency,
            active: formActive,
          },
        ]);
        addToast("Service added", "success");
      }
      setDialogOpen(false);
    } catch (err) {
      logger.warn("Failed to save service", { context: "admin/services", error: err });
      addToast("Failed to save service. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = servicesList;
    setServicesList((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirm(null);
    try {
      await deleteClinicService(id);
      addToast("Service removed", "success");
    } catch (err) {
      logger.warn("Failed to delete service", { context: "admin/services", error: err });
      setServicesList(previous);
      addToast("Failed to remove service. Please try again.", "error");
    }
  };

  const toggleActive = async (id: string) => {
    const target = servicesList.find((s) => s.id === id);
    if (!target) return;
    const next = !target.active;
    setServicesList((prev) => prev.map((s) => (s.id === id ? { ...s, active: next } : s)));
    try {
      await setClinicServiceActive(id, next);
    } catch (err) {
      logger.warn("Failed to toggle service", { context: "admin/services", error: err });
      setServicesList((prev) => prev.map((s) => (s.id === id ? { ...s, active: !next } : s)));
      addToast("Failed to update status. Please try again.", "error");
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Services" }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Services &amp; Prices</h1>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 me-1" />
          Add Service
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {servicesList.map((service) => (
          <Card key={service.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium">{service.name}</h3>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={service.active}
                    onCheckedChange={() => toggleActive(service.id)}
                  />
                  <Badge variant={service.active ? "default" : "secondary"}>
                    {service.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {service.duration} min
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  {service.price} {service.currency}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditDialog(service)}
                >
                  <Edit className="h-3.5 w-3.5 me-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500"
                  onClick={() => setDeleteConfirm(service.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {servicesList.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">
            No services added yet. Click &quot;Add Service&quot; to get started.
          </p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
            <DialogDescription>
              {editingService
                ? "Update the service details below."
                : "Fill in the details to add a new service."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Service Name</Label>
              <Input
                placeholder="General Consultation"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the service..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={formDuration}
                  onChange={(e) => setFormDuration(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Price ({formCurrency})</Label>
                <Input
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(Number(e.target.value))}
                />
              </div>
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
              {editingService ? "Save Changes" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Service</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this service? This action cannot be undone.
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
