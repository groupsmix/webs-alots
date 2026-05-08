/**
 * Competitor Comparison Data
 *
 * Feature comparison between Oltigo and competing platforms
 * in the Moroccan healthcare SaaS market.
 */

export type CompetitorId = "oltigo" | "iyada" | "smartdoc" | "cabidoc" | "pratisoft";

export interface CompetitorInfo {
  id: CompetitorId;
  name: string;
  highlight?: boolean;
}

export type FeatureSupport = "full" | "partial" | "none";

export interface ComparisonFeature {
  label: string;
  category: ComparisonCategory;
  values: Record<CompetitorId, FeatureSupport>;
}

export type ComparisonCategory =
  | "pricing"
  | "ai"
  | "mobile"
  | "whatsapp"
  | "insurance"
  | "prescriptions"
  | "multi-tenant"
  | "offline";

export const CATEGORY_LABELS: Record<ComparisonCategory, string> = {
  pricing: "Tarification",
  ai: "Fonctionnalités IA",
  mobile: "Mobile / PWA",
  whatsapp: "WhatsApp",
  insurance: "Facturation Assurance",
  prescriptions: "Ordonnances QR",
  "multi-tenant": "Multi-tenant",
  offline: "Mode Hors-ligne",
};

export const COMPETITORS: CompetitorInfo[] = [
  { id: "oltigo", name: "Oltigo", highlight: true },
  { id: "iyada", name: "IYADA" },
  { id: "smartdoc", name: "SmartDoc" },
  { id: "cabidoc", name: "CABIDOC" },
  { id: "pratisoft", name: "Pratisoft" },
];

export const COMPARISON_FEATURES: ComparisonFeature[] = [
  // Pricing
  {
    label: "Plan gratuit disponible",
    category: "pricing",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Tarifs transparents en ligne",
    category: "pricing",
    values: { oltigo: "full", iyada: "partial", smartdoc: "none", cabidoc: "none", pratisoft: "partial" },
  },
  {
    label: "Pas d'engagement annuel obligatoire",
    category: "pricing",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },

  // AI Features
  {
    label: "Rédaction d'ordonnances par IA",
    category: "ai",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Suggestions diagnostiques IA",
    category: "ai",
    values: { oltigo: "full", iyada: "none", smartdoc: "partial", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Résumé automatique des consultations",
    category: "ai",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },

  // Mobile / PWA
  {
    label: "Application mobile (PWA)",
    category: "mobile",
    values: { oltigo: "full", iyada: "partial", smartdoc: "none", cabidoc: "none", pratisoft: "partial" },
  },
  {
    label: "Interface responsive complète",
    category: "mobile",
    values: { oltigo: "full", iyada: "partial", smartdoc: "partial", cabidoc: "partial", pratisoft: "partial" },
  },
  {
    label: "Portail patient mobile",
    category: "mobile",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },

  // WhatsApp
  {
    label: "Rappels WhatsApp automatiques",
    category: "whatsapp",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Envoi d'ordonnances par WhatsApp",
    category: "whatsapp",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Notifications en Darija",
    category: "whatsapp",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },

  // Insurance Billing
  {
    label: "Facturation CNSS / CNOPS",
    category: "insurance",
    values: { oltigo: "full", iyada: "partial", smartdoc: "partial", cabidoc: "full", pratisoft: "full" },
  },
  {
    label: "Calcul automatique du reste à charge",
    category: "insurance",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "partial", pratisoft: "partial" },
  },
  {
    label: "Export comptable DGI",
    category: "insurance",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "partial", pratisoft: "full" },
  },

  // QR Prescriptions
  {
    label: "Ordonnances électroniques avec QR",
    category: "prescriptions",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Vérification en pharmacie par QR",
    category: "prescriptions",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Base DCI marocaine intégrée",
    category: "prescriptions",
    values: { oltigo: "full", iyada: "partial", smartdoc: "partial", cabidoc: "partial", pratisoft: "full" },
  },

  // Multi-tenant
  {
    label: "Multi-cabinet (SaaS)",
    category: "multi-tenant",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "partial" },
  },
  {
    label: "Sous-domaine personnalisé",
    category: "multi-tenant",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Isolation des données par cabinet",
    category: "multi-tenant",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },

  // Offline
  {
    label: "Mode hors-ligne (PWA)",
    category: "offline",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Synchronisation automatique",
    category: "offline",
    values: { oltigo: "full", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
  {
    label: "Consultation sans internet",
    category: "offline",
    values: { oltigo: "partial", iyada: "none", smartdoc: "none", cabidoc: "none", pratisoft: "none" },
  },
];

/**
 * Get features grouped by category.
 */
export function getFeaturesByCategory(): Record<ComparisonCategory, ComparisonFeature[]> {
  const grouped = {} as Record<ComparisonCategory, ComparisonFeature[]>;
  for (const feature of COMPARISON_FEATURES) {
    if (!grouped[feature.category]) {
      grouped[feature.category] = [];
    }
    grouped[feature.category].push(feature);
  }
  return grouped;
}

/**
 * Count how many "full" or "partial" features each competitor supports.
 */
export function getCompetitorScores(): Record<CompetitorId, { full: number; partial: number; total: number }> {
  const scores = {} as Record<CompetitorId, { full: number; partial: number; total: number }>;
  for (const competitor of COMPETITORS) {
    scores[competitor.id] = { full: 0, partial: 0, total: COMPARISON_FEATURES.length };
  }
  for (const feature of COMPARISON_FEATURES) {
    for (const competitor of COMPETITORS) {
      const val = feature.values[competitor.id];
      if (val === "full") scores[competitor.id].full++;
      if (val === "partial") scores[competitor.id].partial++;
    }
  }
  return scores;
}
