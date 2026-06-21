/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import { Package, Search, Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";

interface Feature {
  id: string;
  name: string;
  description: string | null;
  key: string;
  category: string | null;
  available_tiers: string[];
  global_enabled: boolean;
  installs: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  core: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  clinical: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  communication: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  finance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  marketing: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  analytics: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  operations: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function MarketplacePage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const loadFeatures = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/marketplace");
      const json = await res.json();
      if (json.ok) {
        setFeatures(json.data.features);
      } else {
        logger.warn("Failed to load features", { context: "marketplace-page", error: json.error });
      }
    } catch (err) {
      logger.warn("Failed to load features", { context: "marketplace-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const categories = useMemo(() => {
    const cats = new Set(features.map((f) => f.category ?? "core"));
    return ["all", ...Array.from(cats).sort()];
  }, [features]);

  const filtered = useMemo(() => {
    return features.filter((f) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        f.name.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q);
      const matchCat = catFilter === "all" || (f.category ?? "core") === catFilter;
      return matchSearch && matchCat;
    });
  }, [features, search, catFilter]);

  const totalFeatures = features.length;
  const enabledFeatures = features.filter((f) => f.global_enabled).length;
  const totalInstalls = features.reduce((sum, f) => sum + f.installs, 0);

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Marketplace" }]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Feature Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform features and integrations available for clinics
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{loading ? "—" : totalFeatures}</p>
            <p className="text-xs text-muted-foreground">Total Features</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-700">{loading ? "—" : enabledFeatures}</p>
            <p className="text-xs text-muted-foreground">Globally Enabled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{loading ? "—" : totalInstalls}</p>
            <p className="text-xs text-muted-foreground">Clinic Overrides</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search features..."
            className="pl-10 pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                catFilter === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              }`}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>

      {/* Feature Grid */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
          Loading features...
        </div>
      ) : features.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No features in the catalogue yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              The feature catalogue is defined by the platform (the{" "}
              <span className="font-mono">feature_definitions</span> seed / migration). Once
              features exist, they appear here so you can globally enable/disable them and manage
              per-clinic overrides. If this is unexpectedly empty in a deployed environment, the
              seed likely hasn&apos;t been applied.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="space-y-3 py-12 text-center text-muted-foreground">
          <p className="text-sm">No features match your search or filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCatFilter("all");
            }}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
          >
            Clear search &amp; filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((feature) => {
            const cat = feature.category ?? "core";
            return (
              <Card key={feature.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{feature.name}</CardTitle>
                        <Badge
                          className={`text-[10px] mt-1 ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.core}`}
                        >
                          {cat}
                        </Badge>
                      </div>
                    </div>
                    {feature.global_enabled ? (
                      <Badge variant="success" className="text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        <XCircle className="h-3 w-3 mr-0.5" />
                        Disabled
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {feature.description ?? "No description"}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Key: {feature.key}</span>
                    <span>
                      {feature.available_tiers.length > 0
                        ? feature.available_tiers.join(", ")
                        : "All tiers"}
                    </span>
                  </div>
                  {feature.installs > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {feature.installs} clinic override{feature.installs !== 1 ? "s" : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
