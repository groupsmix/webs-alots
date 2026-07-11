"use client";

import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
  Globe,
  LogIn,
  Ban,
  CheckCircle,
  Pencil,
  Activity,
  Clock,
  CreditCard,
  Loader2,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";
import {
  fetchClinicById,
  fetchClinicFeatureOverrides,
  fetchClinicStaffCount,
  fetchClinicPatientCount,
  fetchClinicActivityLogs,
  fetchFeatureDefinitions,
  fetchClinicAdminUserId,
  upsertClinicFeatureOverride,
  deleteClinicFeatureOverride,
  updateClinicStatus,
  type ClinicFeatureOverride,
  type ActivityLog,
  type FeatureDefinition,
} from "@/lib/super-admin-actions";

const TIER_OPTIONS = ["trial", "starter", "pro", "enterprise"] as const;

interface ClinicConfigJson {
  city?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  domain?: string;
  address?: string;
  subscription_plan?: string;
  subscription_amount?: number;
  subscription_cycle?: string;
}

interface ClinicData {
  id: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  subdomain: string | null;
  created_at: string | null;
  config: ClinicConfigJson;
}

export default function ClinicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const clinicId = params.id as string;

  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffCount, setStaffCount] = useState(0);
  const [patientCount, setPatientCount] = useState(0);
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [overrides, setOverrides] = useState<ClinicFeatureOverride[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTier, setEditTier] = useState("pro");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadClinic = useCallback(async () => {
    try {
      const [clinicData, staff, patients, featureDefs, clinicOverrides, logs] = await Promise.all([
        fetchClinicById(clinicId),
        fetchClinicStaffCount(clinicId),
        fetchClinicPatientCount(clinicId),
        fetchFeatureDefinitions(),
        fetchClinicFeatureOverrides(clinicId),
        fetchClinicActivityLogs(clinicId),
      ]);

      if (!clinicData) {
        router.push("/super-admin/clinics");
        return;
      }

      setClinic({
        id: clinicData.id,
        name: clinicData.name,
        type: clinicData.type,
        tier: clinicData.tier ?? "pro",
        status: clinicData.status === "inactive" ? "suspended" : (clinicData.status ?? "active"),
        subdomain: clinicData.subdomain,
        created_at: clinicData.created_at,
        config: (clinicData.config ?? {}) as ClinicConfigJson,
      });
      setStaffCount(staff);
      setPatientCount(patients);
      setFeatures(featureDefs);
      setOverrides(clinicOverrides);
      setActivityLogs(logs);
    } catch (err) {
      logger.warn("Failed to load clinic detail", {
        context: "page",
        error: err,
      });
    } finally {
      setLoading(false);
    }
  }, [clinicId, router]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        loadClinic();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [loadClinic]);

  async function handleToggleStatus() {
    if (!clinic) return;
    setActionLoading(true);
    try {
      const newStatus = clinic.status === "suspended" ? "active" : "suspended";
      await updateClinicStatus(clinic.id, newStatus === "suspended" ? "suspended" : "active");
      setClinic((prev) => (prev ? { ...prev, status: newStatus } : prev));
      addToast(
        newStatus === "active"
          ? `${clinic.name} has been activated`
          : `${clinic.name} has been suspended`,
        "success",
      );
    } catch (err) {
      logger.warn("Failed to update clinic status", {
        context: "page",
        error: err,
      });
      addToast("Failed to update clinic status", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleImpersonate() {
    if (!clinic) return;
    setImpersonating(true);
    try {
      const userId = await fetchClinicAdminUserId(clinic.id);
      if (!userId) {
        addToast("No clinic admin account found to impersonate", "error");
        return;
      }
      const res = await fetch(`/api/super-admin/users/${userId}/impersonate`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { redirectUrl?: string };
        error?: string;
      } | null;
      if (!res.ok || !json?.data?.redirectUrl) {
        addToast(
          res.status === 403
            ? "Impersonation is disabled on this environment"
            : (json?.error ?? "Failed to start impersonation"),
          "error",
        );
        return;
      }
      addToast(`Impersonating ${clinic.name}…`, "success");
      router.push(json.data.redirectUrl);
    } catch (err) {
      logger.warn("Failed to impersonate clinic admin", { context: "page", error: err });
      addToast("Failed to start impersonation", "error");
    } finally {
      setImpersonating(false);
    }
  }

  function openEditDialog() {
    if (!clinic) return;
    setEditTier(clinic.tier ?? "pro");
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!clinic) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/super-admin/clinics/${clinic.id}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: editTier }),
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      setClinic((prev) => (prev ? { ...prev, tier: editTier } : prev));
      addToast(`Subscription tier updated to ${editTier}`, "success");
      setEditOpen(false);
    } catch (err) {
      logger.warn("Failed to update clinic tier", { context: "page", error: err });
      addToast("Failed to update subscription tier", "error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleOverride(
    feature: FeatureDefinition,
    currentlyOverridden: boolean,
    currentEnabled: boolean,
  ) {
    if (!clinic) return;
    setOverrideLoading(feature.id);
    try {
      if (currentlyOverridden) {
        await deleteClinicFeatureOverride(clinic.id, feature.id);
        setOverrides((prev) => prev.filter((o) => o.feature_key !== feature.id));
        addToast(`Override removed for ${feature.name}`, "success");
      } else {
        const newEnabled = !currentEnabled;
        await upsertClinicFeatureOverride(clinic.id, feature.id, newEnabled);
        setOverrides((prev) => [
          ...prev.filter((o) => o.feature_key !== feature.id),
          {
            id: crypto.randomUUID(),
            clinic_id: clinic.id,
            feature_key: feature.id,
            enabled: newEnabled,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        addToast(`Override ${newEnabled ? "enabled" : "disabled"} for ${feature.name}`, "success");
      }
    } catch (err) {
      logger.warn("Failed to toggle feature override", {
        context: "page",
        error: err,
      });
      addToast("Failed to update feature override", "error");
    } finally {
      setOverrideLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Clinic not found.</p>
        <Link href="/super-admin/clinics">
          <Button variant="outline" className="mt-4">
            Back to Clinics
          </Button>
        </Link>
      </div>
    );
  }

  const tierIncludesFeature = (feature: FeatureDefinition) =>
    feature.availableTiers.includes(clinic.tier);

  const getOverride = (featureId: string) => overrides.find((o) => o.feature_key === featureId);

  const isFeatureEnabled = (feature: FeatureDefinition) => {
    const override = getOverride(feature.id);
    if (override) return override.enabled;
    return tierIncludesFeature(feature) && feature.globalEnabled;
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Clinics", href: "/super-admin/clinics" },
          { label: clinic.name },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/super-admin/clinics">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{clinic.name}</h1>
              <Badge variant="outline" className="capitalize">
                {clinic.type}
              </Badge>
              <Badge
                variant={
                  clinic.status === "active"
                    ? "success"
                    : clinic.status === "suspended"
                      ? "destructive"
                      : "warning"
                }
              >
                {clinic.status}
              </Badge>
            </div>
            {clinic.subdomain && (
              <p className="text-sm text-muted-foreground mt-0.5">
                <Globe className="inline h-3.5 w-3.5 mr-1" />
                {clinic.subdomain}.oltigo.com
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={impersonating} onClick={handleImpersonate}>
            {impersonating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4 mr-1" />
            )}
            Impersonate
          </Button>
          <Button
            variant={clinic.status === "suspended" ? "default" : "destructive"}
            size="sm"
            disabled={actionLoading}
            onClick={handleToggleStatus}
          >
            {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {clinic.status === "suspended" ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Activate
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-1" />
                Suspend
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-4 mb-6 mt-4">
            <Card>
              <CardContent className="p-4 text-center">
                <UserCog className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                <p className="text-2xl font-bold">{staffCount}</p>
                <p className="text-xs text-muted-foreground">Staff</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                <p className="text-2xl font-bold">{patientCount}</p>
                <p className="text-xs text-muted-foreground">Patients</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CreditCard className="h-5 w-5 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold capitalize">{clinic.tier}</p>
                <p className="text-xs text-muted-foreground">Plan</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="h-5 w-5 mx-auto mb-1 text-orange-600" />
                <p className="text-2xl font-bold">
                  {clinic.created_at ? new Date(clinic.created_at).toLocaleDateString() : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">Created</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Owner:</span>
                  <span>{clinic.config.ownerName || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span>{clinic.config.phone || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span>{clinic.config.email || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">City:</span>
                  <span>{clinic.config.city || "N/A"}</span>
                </div>
                {clinic.config.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Address:</span>
                    <span>{clinic.config.address}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subscription */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Tier:</span>
                  <Badge variant="outline" className="capitalize">
                    {clinic.tier}
                  </Badge>
                </div>
                {clinic.config.subscription_amount !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Amount:</span>
                    <span>{clinic.config.subscription_amount} MAD</span>
                  </div>
                )}
                {clinic.config.subscription_cycle && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Cycle:</span>
                    <span className="capitalize">{clinic.config.subscription_cycle}</span>
                  </div>
                )}
                <Separator />
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                  <span>
                    {clinic.created_at ? new Date(clinic.created_at).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Feature Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">
                Features enabled by the <strong>{clinic.tier}</strong> tier are shown below. Toggle
                overrides to enable/disable features for this specific clinic.
              </p>
            </CardHeader>
            <CardContent>
              {features.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No feature definitions found.
                </p>
              ) : (
                <div className="space-y-3">
                  {features.map((feature) => {
                    const override = getOverride(feature.id);
                    const enabled = isFeatureEnabled(feature);
                    const isOverridden = !!override;

                    return (
                      <div
                        key={feature.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex-1 mr-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{feature.name}</p>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {feature.category}
                            </Badge>
                            {isOverridden && (
                              <Badge variant="secondary" className="text-[10px]">
                                Override
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {feature.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Available in: {feature.availableTiers.join(", ") || "none"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={enabled}
                            disabled={overrideLoading === feature.id}
                            onCheckedChange={() =>
                              handleToggleOverride(feature, isOverridden, enabled)
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <p className="text-sm text-muted-foreground">
                Activity logs and admin actions for this clinic.
              </p>
            </CardHeader>
            <CardContent>
              {activityLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No activity logs found for this clinic.
                </p>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{log.action}</p>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {log.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{log.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>By: {log.actor}</span>
                          <span>&middot;</span>
                          <span>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Clinic — subscription tier */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClose={() => setEditOpen(false)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>Change the subscription tier for {clinic?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            <Label htmlFor="tier-select">Tier</Label>
            <select
              id="tier-select"
              value={editTier}
              onChange={(e) => setEditTier(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
            >
              {TIER_OPTIONS.map((tier) => (
                <option key={tier} value={tier} className="capitalize">
                  {tier}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
