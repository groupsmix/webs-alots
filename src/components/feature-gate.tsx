"use client";

import { useClinicFeatures } from "@/lib/hooks/use-clinic-features";
import type { ClinicFeatureKey } from "@/lib/features";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface FeatureGateProps {
  /** The feature key that must be enabled for this module to render. */
  featureKey: ClinicFeatureKey;
  /** Human-readable module name shown in the disabled message. */
  moduleName: string;
  /** The content to render when the feature is enabled. */
  children: React.ReactNode;
}

/**
 * Wraps a specialty module layout. If the required feature flag is
 * disabled for the current clinic, a "module not available" card is
 * shown instead of the children.
 *
 * While features are still loading (`loaded === false`), children
 * are rendered normally to avoid a flash of the disabled state.
 */
export function FeatureGate({ featureKey, moduleName, children }: FeatureGateProps) {
  const { hasFeature, loaded } = useClinicFeatures();

  // While loading, show children to avoid flash
  if (!loaded) return <>{children}</>;

  if (!hasFeature(featureKey)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-lg font-semibold">
              {moduleName} is not enabled
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              This module is not available for your clinic type. Please contact
              your administrator to enable it.
            </p>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
