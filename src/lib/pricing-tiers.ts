type PricingTier = "starter" | "professional" | "enterprise";

export interface FeatureMatrix {
  maxDoctors: number;
  customDomain: boolean;
  aiFeatures: boolean;
  advancedAnalytics: boolean;
  smsFallback: boolean;
  whiteLabelOptions: boolean;
}

export const PRICING_TIERS: Record<PricingTier, FeatureMatrix> = {
  starter: {
    maxDoctors: 1,
    customDomain: false,
    aiFeatures: false,
    advancedAnalytics: false,
    smsFallback: false,
    whiteLabelOptions: false,
  },
  professional: {
    maxDoctors: 5,
    customDomain: true,
    aiFeatures: true,
    advancedAnalytics: false,
    smsFallback: true,
    whiteLabelOptions: false,
  },
  enterprise: {
    maxDoctors: 999,
    customDomain: true,
    aiFeatures: true,
    advancedAnalytics: true,
    smsFallback: true,
    whiteLabelOptions: true,
  },
};

export function canAccessFeature(tier: string, feature: keyof FeatureMatrix): boolean {
  const normalizedTier = (tier || "starter").toLowerCase() as PricingTier;
  const matrix = PRICING_TIERS[normalizedTier];
  if (!matrix) return false;

  const value = matrix[feature];
  return typeof value === "boolean" ? value : true;
}

export function getMaxDoctors(tier: string): number {
  const normalizedTier = (tier || "starter").toLowerCase() as PricingTier;
  const matrix = PRICING_TIERS[normalizedTier];
  return matrix ? matrix.maxDoctors : 1;
}
