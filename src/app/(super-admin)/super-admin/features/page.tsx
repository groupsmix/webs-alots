"use client";

import { useState } from "react";
import {
  ToggleLeft, Search, Shield, Zap, Globe, Settings,
  CheckCircle, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  featureDefinitions as initialFeatures, clinicDetails,
  type FeatureDefinition,
} from "@/lib/super-admin-data";

type CategoryFilter = "all" | "core" | "communication" | "integration" | "advanced";

const tiers = ["basic", "standard", "premium"];

export default function FeatureTogglesPage() {
  const [features, setFeatures] = useState<FeatureDefinition[]>(initialFeatures);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTier, setBulkTier] = useState("basic");
  const [bulkAction, setBulkAction] = useState<"enable" | "disable">("enable");

  const filtered = features.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch = !q || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
    return matchSearch && (catFilter === "all" || f.category === catFilter);
  });

  const catIcon = (cat: string) => {
    switch (cat) {
      case "core": return <Shield className="h-4 w-4 text-blue-600" />;
      case "communication": return <Globe className="h-4 w-4 text-green-600" />;
      case "integration": return <Zap className="h-4 w-4 text-purple-600" />;
      case "advanced": return <Settings className="h-4 w-4 text-orange-600" />;
      default: return <ToggleLeft className="h-4 w-4" />;
    }
  };

  function toggleGlobal(featureId: string) {
    setFeatures((prev) =>
      prev.map((f) => f.id === featureId ? { ...f, globalEnabled: !f.globalEnabled } : f)
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
      })
    );
  }

  function handleBulkAction() {
    setFeatures((prev) =>
      prev.map((f) => {
        if (bulkAction === "enable") {
          return { ...f, availableTiers: f.availableTiers.includes(bulkTier) ? f.availableTiers : [...f.availableTiers, bulkTier] };
        } else {
          return { ...f, availableTiers: f.availableTiers.filter((t) => t !== bulkTier) };
        }
      })
    );
    setBulkOpen(false);
  }

  const enabledCount = features.filter((f) => f.globalEnabled).length;
  const totalClinics = clinicDetails.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Feature Toggles</h1>
          <p className="text-sm text-muted-foreground mt-1">Control feature availability per tier and globally</p>
        </div>
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <ToggleLeft className="h-4 w-4 mr-1" />
          Bulk Actions
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total Features</p><p className="text-2xl font-bold">{features.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Globally Enabled</p><p className="text-2xl font-bold text-green-600">{enabledCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Categories</p><p className="text-2xl font-bold">4</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Clinics Affected</p><p className="text-2xl font-bold">{totalClinics}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search features..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "core", "communication", "integration", "advanced"] as CategoryFilter[]).map((c) => (
            <Button key={c} variant={catFilter === c ? "default" : "outline"} size="sm" onClick={() => setCatFilter(c)} className="capitalize text-xs">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-3 px-4 min-w-[250px]">Feature</th>
                  <th className="text-center font-medium py-3 px-4">Global</th>
                  {tiers.map((tier) => (
                    <th key={tier} className="text-center font-medium py-3 px-4 capitalize">{tier}</th>
                  ))}
                  <th className="text-center font-medium py-3 px-4">Category</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((feature) => (
                  <tr key={feature.id} className={`border-b last:border-0 hover:bg-muted/50 ${!feature.globalEnabled ? "opacity-50" : ""}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {catIcon(feature.category)}
                        <div>
                          <p className="font-medium">{feature.name}</p>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{feature.key}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Switch checked={feature.globalEnabled} onCheckedChange={() => toggleGlobal(feature.id)} />
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
                      <Badge variant="outline" className="capitalize text-[10px]">{feature.category}</Badge>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No features found.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent onClose={() => setBulkOpen(false)}>
          <DialogHeader>
            <DialogTitle>Bulk Feature Toggle</DialogTitle>
            <DialogDescription>Enable or disable all features for a specific tier at once.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={bulkAction} onChange={(e) => setBulkAction(e.target.value as "enable" | "disable")}>
                <option value="enable">Enable all features</option>
                <option value="disable">Disable all features</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tier</label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={bulkTier} onChange={(e) => setBulkTier(e.target.value)}>
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
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
