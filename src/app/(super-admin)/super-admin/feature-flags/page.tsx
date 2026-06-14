/* eslint-disable i18next/no-literal-string -- Super-admin internal surface */
"use client";

import { Info, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

type FeatureFlagCategory = "core" | "experimental" | "integration";

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  category: FeatureFlagCategory;
  locked: boolean;
  lockedReason: string | null;
  source: "kv" | "db";
  displayName: string;
  minTier: number | null;
}

interface FeatureFlagResponse {
  flags: FeatureFlag[];
  kvAvailable: boolean;
}

export default function FeatureFlagsPage() {
  const TIER_LABELS: Record<number, string> = {
    0: "Free",
    1: "Budget",
    2: "Standard",
    3: "Premium",
  };
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [kvAvailable, setKvAvailable] = useState(true);

  const loadFlags = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/super-admin/feature-flags", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: FeatureFlagResponse;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to load feature flags");
      }

      setFlags(payload.data.flags);
      setKvAvailable(payload.data.kvAvailable);
    } catch {
      addToast("Failed to load feature flags", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadFlags();
  }, [loadFlags]);

  async function handleToggle(key: string, currentValue: boolean) {
    setUpdating(key);
    try {
      const response = await fetch("/api/super-admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled: !currentValue }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to update feature flag");
      }

      setFlags((currentFlags) =>
        currentFlags.map((flag) =>
          flag.key === key ? { ...flag, enabled: !currentValue } : flag,
        ),
      );
      addToast(`Feature ${!currentValue ? "enabled" : "disabled"}`, "success");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to update feature flag",
        "error",
      );
      await loadFlags(true);
    } finally {
      setUpdating(null);
    }
  }

  const groupedFlags = useMemo(() => {
    return flags.reduce<Record<FeatureFlagCategory, FeatureFlag[]>>(
      (acc, flag) => {
        acc[flag.category].push(flag);
        return acc;
      },
      { core: [], experimental: [], integration: [] },
    );
  }, [flags]);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Feature Flags" },
        ]}
      />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Feature Flags</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage runtime platform toggles without using the wrangler CLI.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadFlags(true)}
          disabled={loading || refreshing}
        >
          {refreshing ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {!kvAvailable && !loading && (
        <Card className="mb-6 border-[var(--signal-amber)]/30 bg-[var(--signal-amber)]/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 h-4 w-4 text-[var(--signal-amber)]" />
            <div>
              <p className="text-sm font-medium">Feature flag storage unavailable</p>
              <p className="text-xs text-muted-foreground">
                `FEATURE_FLAGS_KV` is not configured in this environment. Flags are shown for
                visibility, but updates are disabled.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && <CardSkeleton count={3} />}

      {!loading &&
        (Object.entries(groupedFlags) as Array<[FeatureFlagCategory, FeatureFlag[]]>)
          .filter(([, categoryFlags]) => categoryFlags.length > 0)
          .map(([category, categoryFlags]) => (
            <Card key={category} className="mb-6">
              <CardHeader>
                <CardTitle className="text-base capitalize">{category} Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {categoryFlags.map((flag) => (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between gap-4 border-b py-3 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-medium">{flag.displayName}</p>
                        <Badge
                          variant={flag.enabled ? "success" : "secondary"}
                          className="text-[10px]"
                        >
                          {flag.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {flag.source}
                        </Badge>
                        {flag.locked && (
                          <Badge variant="warning" className="text-[10px]">
                            Locked
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{flag.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{flag.key}</p>
                      {flag.minTier !== null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Requires {TIER_LABELS[flag.minTier] ?? `Tier ${flag.minTier}`} provider
                        </p>
                      )}
                      {flag.lockedReason && (
                        <p className="mt-1 text-xs text-muted-foreground">{flag.lockedReason}</p>
                      )}
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => void handleToggle(flag.key, flag.enabled)}
                      disabled={updating === flag.key || flag.locked || !kvAvailable}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

      {!loading && flags.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No runtime feature flags are registered yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
