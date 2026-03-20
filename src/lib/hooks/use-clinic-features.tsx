"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { FeaturesConfig, ClinicFeatureKey } from "@/lib/features";
import { isFeatureEnabled } from "@/lib/features";

interface ClinicFeaturesContextValue {
  /** The raw features_config object (may be null while loading). */
  config: FeaturesConfig | null;
  /** Whether the config has been loaded. */
  loaded: boolean;
  /** Convenience: check a single feature flag. */
  hasFeature: (key: ClinicFeatureKey) => boolean;
}

const ClinicFeaturesContext = createContext<ClinicFeaturesContextValue>({
  config: null,
  loaded: false,
  hasFeature: () => true, // default: show everything until loaded
});

/**
 * Provider that loads the clinic's features_config once and
 * exposes it to the component tree.
 *
 * Accepts either:
 *  - a pre-fetched `initialConfig` (SSR / server component), or
 *  - a `clinicTypeKey` to fetch from the API at mount time.
 *
 * When neither is supplied, all features are enabled by default.
 */
export function ClinicFeaturesProvider({
  children,
  initialConfig,
  clinicTypeKey,
}: {
  children: ReactNode;
  initialConfig?: FeaturesConfig | null;
  clinicTypeKey?: string | null;
}) {
  const [config, setConfig] = useState<FeaturesConfig | null>(
    initialConfig ?? null,
  );
  const [loaded, setLoaded] = useState(!!initialConfig);

  useEffect(() => {
    if (initialConfig || !clinicTypeKey) {
      setLoaded(true);
      return;
    }

    let cancelled = false;

    async function fetchConfig() {
      try {
        const res = await fetch(
          `/api/clinic-features?type_key=${encodeURIComponent(clinicTypeKey!)}`,
        );
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { features_config: FeaturesConfig };
        if (!cancelled) {
          setConfig(data.features_config);
          setLoaded(true);
        }
      } catch {
        // On error, enable all features so nothing is hidden
        if (!cancelled) {
          setConfig(null);
          setLoaded(true);
        }
      }
    }

    void fetchConfig();
    return () => {
      cancelled = true;
    };
  }, [initialConfig, clinicTypeKey]);

  const hasFeature = (key: ClinicFeatureKey) =>
    !loaded || isFeatureEnabled(config, key);

  return (
    <ClinicFeaturesContext.Provider value={{ config, loaded, hasFeature }}>
      {children}
    </ClinicFeaturesContext.Provider>
  );
}

/** Access clinic feature flags from any client component. */
export function useClinicFeatures() {
  return useContext(ClinicFeaturesContext);
}
