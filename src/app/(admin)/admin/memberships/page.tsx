"use client";

import { Dumbbell, Plus, Search, Users, CreditCard, Calendar } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { logger } from "@/lib/logger";

interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  price: number;
  currency: string;
  max_classes: number | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export default function MembershipsPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    duration_days: 30,
    price: 0,
    max_classes: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/membership-plans");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { plans: MembershipPlan[] };
      setPlans(data.plans ?? []);
    } catch (err) {
      logger.warn("Failed to load membership plans", { context: "memberships-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/membership-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPlan.name,
          description: newPlan.description || undefined,
          duration_days: newPlan.duration_days,
          price: newPlan.price,
          max_classes: newPlan.max_classes ? Number(newPlan.max_classes) : null,
          is_active: newPlan.is_active,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setCreateOpen(false);
      setNewPlan({ name: "", description: "", duration_days: 30, price: 0, max_classes: "", is_active: true });
      void loadPlans();
    } catch (err) {
      logger.warn("Failed to create membership plan", { context: "memberships-page", error: err });
    } finally {
      setSaving(false);
    }
  };

  const filtered = plans.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Memberships" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Dumbbell className="h-6 w-6" />
            Membership Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage membership plans, pricing, and features
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{plans.length}</p>
                <p className="text-xs text-muted-foreground">Total Plans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{plans.filter((p) => p.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active Plans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {plans.length > 0 ? Math.round(plans.reduce((sum, p) => sum + p.duration_days, 0) / plans.length) : 0}
                </p>
                <p className="text-xs text-muted-foreground">Avg Duration (days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plans..."
          className="pl-9"
        />
      </div>

      {/* Plans List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No membership plans found. Create your first plan to get started.
            </CardContent>
          </Card>
        ) : (
          filtered.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Price:</span>{" "}
                    <span className="font-medium">{plan.price.toLocaleString()} {plan.currency}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>{" "}
                    <span className="font-medium">{plan.duration_days} days</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Classes:</span>{" "}
                    <span className="font-medium">{plan.max_classes ?? "Unlimited"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Description:</span>{" "}
                    <span className="font-medium">{plan.description || "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>New Membership Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} placeholder="e.g., Monthly Basic" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newPlan.description} onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })} placeholder="Plan description..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (days)</Label>
                <Input type="number" value={newPlan.duration_days} onChange={(e) => setNewPlan({ ...newPlan, duration_days: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Price (MAD)</Label>
                <Input type="number" value={newPlan.price} onChange={(e) => setNewPlan({ ...newPlan, price: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Max Classes (leave empty for unlimited)</Label>
              <Input value={newPlan.max_classes} onChange={(e) => setNewPlan({ ...newPlan, max_classes: e.target.value })} placeholder="Unlimited" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={newPlan.is_active} onCheckedChange={(checked) => setNewPlan({ ...newPlan, is_active: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !newPlan.name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
