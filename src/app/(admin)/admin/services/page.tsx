"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Clock, CreditCard, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { getCurrentUser, fetchServices, type ServiceView } from "@/lib/data/client";

type Service = ServiceView;

export default function ManageServicesPage() {
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const svcs = await fetchServices(user.clinic_id);
    setServicesList(svcs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setFormName(service.name);
    setFormDescription(service.description);
    setFormDuration(service.duration);
    setFormPrice(service.price);
    setFormCurrency(service.currency);
    setFormActive(service.active);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) return;

    if (editingService) {
      setServicesList(
        servicesList.map((s) =>
          s.id === editingService.id
            ? { ...s, name: formName, description: formDescription, duration: formDuration, price: formPrice, currency: formCurrency, active: formActive }
            : s
        )
      );
    } else {
      setServicesList([
        ...servicesList,
        { id: `s${Date.now()}`, name: formName, description: formDescription, duration: formDuration, price: formPrice, currency: formCurrency, active: formActive },
      ]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setServicesList(servicesList.filter((s) => s.id !== id));
    setDeleteConfirm(null);
  };

  const toggleActive = (id: string) => {
    setServicesList(servicesList.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Services & Prices</h1>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" />
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
                  <Switch checked={service.active} onCheckedChange={() => toggleActive(service.id)} />
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
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(service)}>
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteConfirm(service.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {servicesList.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No services added yet. Click &quot;Add Service&quot; to get started.</p>
        </div>
      )}

      {/* Add/Edit Service Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
            <DialogDescription>
              {editingService ? "Update the service details below." : "Fill in the details to add a new service."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Service Name</Label>
              <Input placeholder="General Consultation" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe the service..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={formDuration} onChange={(e) => setFormDuration(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Price ({formCurrency})</Label>
                <Input type="number" value={formPrice} onChange={(e) => setFormPrice(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingService ? "Save Changes" : "Add Service"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Service</DialogTitle>
            <DialogDescription>Are you sure you want to remove this service? This action cannot be undone.</DialogDescription>
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
