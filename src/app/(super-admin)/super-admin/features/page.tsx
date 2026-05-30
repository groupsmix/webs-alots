/* eslint-disable i18next/no-literal-string */
"use client";

import {
  ToggleLeft,
  Search,
  Shield,
  Zap,
  Globe,
  Settings,
  CheckCircle,
  XCircle,
  Building2,
  RotateCcw,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { logger } from "@/lib/logger";
import {
  fetchFeatureDefinitions,
  fetchClinics,
  type FeatureDefinition,
} from "@/lib/super-admin-actions";
import { getLocalDateStr } from "@/lib/utils";

type CategoryFilter = "all" | "core" | "communication" | "integration" | "advanced";

interface ClinicOption {
  id: string;
  name: string;
  tier: string | null;
}

interface ClinicOverride {
  id: string;
  clinic_id: string;
  feature_key: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const tiers = ["basic", "standard", "premium"];

export default function FeatureTogglesPage() {
  const { addToast } = useToast();
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [totalClinicsCount, setTotalClinicsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Clinic overrides state
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [overrides, setOverrides] = useState<ClinicOverride[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);

  const loadFeatures = useCallback(async () => {
    try {
      const [feats, clinicList] = await Promise.all([fetchFeatureDefinitions(), fetchClinics()]);
      setFeatures(feats);
      setClinics(clinicList.map((c) => ({ id: c.id, name: c.name, tier: c.tier })));
      setTotalClinicsCount(clinicList.length);
    } catch (err) {
      logger.warn("Failed to load features page", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadFeatures();
    return () => {
      controller.abort();
    };
  }, [loadFeatures]);

  const loadOverrides = useCallback(async (clinicId: string) => {
    if (!clinicId) {
      setOverrides([]);
      return;
    }
    setOverridesLoading(true);
    try {
      const res = await fetch(
        `/api/admin/clinic-feature-overrides?clinic_id=${encodeURIComponent(clinicId)}`,
      );
      if (res.ok) {
        const json = await res.json();
        setOverrides(json.data?.overrides ?? []);
      } else {
        setOverrides([]);
      }
    } catch (err) {
      logger.warn("Failed to load clinic overrides", { context: "page", error: err });
      setOverrides([]);
    } finally {
      setOverridesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClinicId) {
      loadOverrides(selectedClinicId);
    } else {
      setOverrides([]);
    }
  }, [selectedClinicId, loadOverrides]);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTier, setBulkTier] = useState("basic");
  const [bulkAction, setBulkAction] = useState<"enable" | "disable">("enable");

  const filtered = features.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q);
    return matchSearch && (catFilter === "all" || f.category === catFilter);
  });

  const catIcon = (cat: string) => {
    switch (cat) {
      case "core":
        return <Shield className="h-4 w-4 text-blue-600" />;
      case "communication":
        return <Globe className="h-4 w-4 text-green-600" />;
      case "integration":
        return <Zap className="h-4 w-4 text-purple-600" />;
      case "advanced":
        return <Settings className="h-4 w-4 text-orange-600" />;
      default:
        return <ToggleLeft className="h-4 w-4" />;
    }
  };

  function toggleGlobal(featureId: string) {
    const feature = features.find((f) => f.id === featureId);
    setFeatures((prev) =>
      prev.map((f) => (f.id === featureId ? { ...f, globalEnabled: !f.globalEnabled } : f)),
    );
    addToast(
      `${feature?.name ?? "Feature"} ${feature?.globalEnabled ? "disabled" : "enabled"} globally`,
      "success",
    );
  }

  function toggleTier(featureId: string, tier: string) {
    setFeatures((prev) =>
      prev.map((f) => {
        if (f.id !== featureId) return f;
        const hasTier = f.availableTiers.includes(tier);
        return {
          ...f,
          availableTiers: hasTier
            ? f.availableTiers.filter((t) => t !== tier)
            : [...f.availableTiers, tier],
        };
      }),
    );
  }

  function handleBulkAction() {
    setFeatures((prev) =>
      prev.map((f) => {
        if (bulkAction === "enable") {
          return {
            ...f,
            availableTiers: f.availableTiers.includes(bulkTier)
              ? f.availableTiers
              : [...f.availableTiers, bulkTier],
          };
        } else {
          return { ...f, availableTiers: f.availableTiers.filter((t) => t !== bulkTier) };
        }
      }),
    );
    setBulkOpen(false);
    addToast(
      `All features ${bulkAction === "enable" ? "enabled" : "disabled"} for ${bulkTier} tier`,
      "success",
    );
  }

  async function toggleClinicOverride(featureKey: string, enabled: boolean) {
    if (!selectedClinicId) return;
    try {
      const res = await fetch("/api/admin/clinic-feature-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: selectedClinicId,
          feature_key: featureKey,
          enabled,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const newOverride = json.data?.override;
        setOverrides((prev) => {
          const exists = prev.find((o) => o.feature_key === featureKey);
          if (exists) {
            return prev.map((o) =>
              o.feature_key === featureKey
                ? { ...o, enabled, updated_at: newOverride?.updated_at ?? new Date().toISOString() }
                : o,
            );
          }
          return [...prev, newOverride];
        });
        addToast(`Override set: ${featureKey} ${enabled ? "enabled" : "disabled"}`, "success");
      } else {
        addToast("Failed to set override", "error");
      }
    } catch {
      addToast("Failed to set override", "error");
    }
  }

  async function clearClinicOverride(featureKey: string) {
    if (!selectedClinicId) return;
    try {
      const res = await fetch("/api/admin/clinic-feature-overrides", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: selectedClinicId,
          feature_key: featureKey,
        }),
      });
      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.feature_key !== featureKey));
        addToast(`Override cleared for ${featureKey}`, "success");
      } else {
        addToast("Failed to clear override", "error");
      }
    } catch {
      addToast("Failed to clear override", "error");
    }
  }

  function getOverrideState(featureKey: string): "inherited" | "enabled" | "disabled" {
    const override = overrides.find((o) => o.feature_key === featureKey);
    if (!override) return "inherited";
    return override.enabled ? "enabled" : "disabled";
  }

  const overrideCount = overrides.length;

  function handleExportFeaturesCSV() {
    const rows = filtered.map((f) => ({
      Feature: f.name,
      Key: f.key,
      Description: f.description,
      Category: f.category,
      "Global Enabled": f.globalEnabled ? "Yes" : "No",
      Basic: f.availableTiers.includes("basic") ? "Yes" : "No",
      Standard: f.availableTiers.includes("standard") ? "Yes" : "No",
      Premium: f.availableTiers.includes("premium") ? "Yes" : "No",
    }));
    exportToCSV(rows, `features-${getLocalDateStr()}.csv`);
    addToast("Feature matrix CSV exported", "success");
  }

  function handleExportFeaturesPDF() {
    const rows = filtered.map((f) => ({
      Feature: f.name,
      Category: f.category,
      Global: f.globalEnabled ? "Yes" : "No",
      Basic: f.availableTiers.includes("basic") ? "Yes" : "No",
      Standard: f.availableTiers.includes("standard") ? "Yes" : "No",
      Premium: f.availableTiers.includes("premium") ? "Yes" : "No",
    }));
    exportToPDF("Feature Matrix \u2014 Oltigo Health", rows, [
      "Feature",
      "Category",
      "Global",
      "Basic",
      "Standard",
      "Premium",
    ]);
    addToast("PDF generated \u2014 use Save as PDF in the print dialog", "success");
  }

  const enabledCount = features.filter((f) => f.globalEnabled).length;
  const totalClinics = totalClinicsCount;

  if (loading) {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: "Super Admin", href: "/super-admin/dashboard" },
            { label: "Feature Toggles" },
          ]}
        />
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Feature Toggles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control feature availability per tier and globally
          </p>
        </div>
        <CardSkeleton count={4} className="mb-6" />
        <TableSkeleton rows={8} columns={6} className="mt-4" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Feature Toggles" },
        ]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Feature Toggles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control feature availability per tier and globally
          </p>
        </div>
        <div className="flex gap-2">
          {/* eslint-disable i18next/no-literal-string */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                Export
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportFeaturesCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportFeaturesPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* eslint-enable i18next/no-literal-string */}
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <ToggleLeft className="h-4 w-4 mr-1" />
            Bulk Actions
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Features</p>
            <p className="text-2xl font-bold">{features.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Globally Enabled</p>
            <p className="text-2xl font-bold text-green-600">{enabledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Categories</p>
            <p className="text-2xl font-bold">4</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Clinics Affected</p>
            <p className="text-2xl font-bold">{totalClinics}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Feature Matrix vs Clinic Overrides */}
      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">Feature Matrix</TabsTrigger>
          <TabsTrigger value="overrides">
            Clinic Overrides
            {overrideCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {overrideCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search features..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              {(
                ["all", "core", "communication", "integration", "advanced"] as CategoryFilter[]
              ).map((c) => (
                <Button
                  key={c}
                  variant={catFilter === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCatFilter(c)}
                  className="capitalize text-xs"
                >
                  {c === "all" ? "All" : c}
                </Button>
              ))}
            </div>
          </div>

          {/* Feature Matrix */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Feature Matrix</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-mobile-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium py-3 px-4 min-w-[250px]">Feature</th>
                      <th className="text-center font-medium py-3 px-4">Global</th>
                      {tiers.map((tier) => (
                        <th key={tier} className="text-center font-medium py-3 px-4 capitalize">
                          {tier}
                        </th>
                      ))}
                      <th className="text-center font-medium py-3 px-4">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((feature) => (
                      <tr
                        key={feature.id}
                        className={`border-b last:border-0 hover:bg-muted/50 ${!feature.globalEnabled ? "opacity-50" : ""}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {catIcon(feature.category)}
                            <div>
                              <p className="font-medium">{feature.name}</p>
                              <p className="text-xs text-muted-foreground">{feature.description}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">
                                {feature.key}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Switch
                            checked={feature.globalEnabled}
                            onCheckedChange={() => toggleGlobal(feature.id)}
                          />
                        </td>
                        {tiers.map((tier) => (
                          <td key={tier} className="py-3 px-4 text-center">
                            <button
                              onClick={() => toggleTier(feature.id, tier)}
                              className="inline-flex items-center justify-center"
                              disabled={!feature.globalEnabled}
                            >
                              {feature.availableTiers.includes(tier) ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-gray-300" />
                              )}
                            </button>
                          </td>
                        ))}
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {feature.category}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No features found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overrides">
          {/* Clinic Overrides Section */}
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Clinic Feature Overrides
                </CardTitle>
                {selectedClinicId && overrideCount > 0 && (
                  <Badge variant="secondary">
                    {overrideCount} override{overrideCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- custom Select component */}
                <label className="text-sm font-medium mb-2 block">Select Clinic</label>
                <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue
                      placeholder="Choose a clinic..."
                      value={clinics.find((c) => c.id === selectedClinicId)?.name}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clinics.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id}>
                        {clinic.name} {clinic.tier ? `(${clinic.tier})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClinicId && (
                <>
                  {overridesLoading ? (
                    <TableSkeleton rows={5} columns={4} />
                  ) : (
                    <div className="table-mobile-scroll">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left font-medium py-3 px-4 min-w-[250px]">
                              Feature
                            </th>
                            <th className="text-center font-medium py-3 px-4">Status</th>
                            <th className="text-center font-medium py-3 px-4">Override</th>
                            <th className="text-center font-medium py-3 px-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {features.map((feature) => {
                            const state = getOverrideState(feature.key);
                            return (
                              <tr
                                key={feature.id}
                                className="border-b last:border-0 hover:bg-muted/50"
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    {catIcon(feature.category)}
                                    <div>
                                      <p className="font-medium">{feature.name}</p>
                                      <p className="text-[10px] font-mono text-muted-foreground">
                                        {feature.key}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {state === "inherited" && (
                                    <Badge variant="outline" className="text-[10px] text-gray-500">
                                      Inherited
                                    </Badge>
                                  )}
                                  {state === "enabled" && (
                                    <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">
                                      Enabled
                                    </Badge>
                                  )}
                                  {state === "disabled" && (
                                    <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">
                                      Disabled
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Switch
                                    checked={
                                      state === "enabled" ||
                                      (state === "inherited" &&
                                        feature.availableTiers.includes(
                                          clinics.find((c) => c.id === selectedClinicId)?.tier ??
                                            "",
                                        ))
                                    }
                                    onCheckedChange={(checked) =>
                                      toggleClinicOverride(feature.key, checked)
                                    }
                                  />
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {state !== "inherited" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => clearClinicOverride(feature.key)}
                                      title="Clear override (revert to tier default)"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {!selectedClinicId && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a clinic to manage feature overrides.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent onClose={() => setBulkOpen(false)}>
          <DialogHeader>
            <DialogTitle>Bulk Feature Toggle</DialogTitle>
            <DialogDescription>
              Enable or disable all features for a specific tier at once.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input/sibling element */}
              <label className="text-sm font-medium">Action</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as "enable" | "disable")}
              >
                <option value="enable">Enable all features</option>
                <option value="disable">Disable all features</option>
              </select>
            </div>
            <div className="space-y-2">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input/sibling element */}
              <label className="text-sm font-medium">Tier</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={bulkTier}
                onChange={(e) => setBulkTier(e.target.value)}
              >
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAction}>
              <ToggleLeft className="h-4 w-4 mr-1" />
              Apply to All Features
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
