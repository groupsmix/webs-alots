/**
 * Pricing & Tier System Data
 * Tiers: Vitrine, Cabinet, Pro, Premium, SaaS Monthly
 * System Types: Doctor, Dentist, Pharmacy
 */

// ---------- Types ----------

export type SystemType = "doctor" | "dentist" | "pharmacy";
export type TierSlug = "vitrine" | "cabinet" | "pro" | "premium" | "saas-monthly";

export interface PricingTier {
  id: string;
  slug: TierSlug;
  name: string;
  description: string;
  popular?: boolean;
  pricing: Record<SystemType, { monthly: number; yearly: number }>;
  features: PricingFeature[];
  limits: TierLimits;
}

export interface PricingFeature {
  key: string;
  label: string;
  included: boolean;
  limit?: string;
}

export interface TierLimits {
  maxDoctors: number;
  maxPatients: number;
  maxAppointmentsPerMonth: number;
  storageGB: number;
  customDomain: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
}

export interface ClientSubscription {
  id: string;
  clinicId: string;
  clinicName: string;
  systemType: SystemType;
  tierSlug: TierSlug;
  tierName: string;
  status: "active" | "trial" | "past_due" | "cancelled" | "suspended";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  paymentMethod: string;
  autoRenew: boolean;
  trialEndsAt?: string;
  cancelledAt?: string;
  invoices: ClientInvoice[];
}

export interface ClientInvoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "refunded";
  paidDate?: string;
  downloadUrl?: string;
}

export interface FeatureToggle {
  id: string;
  key: string;
  label: string;
  description: string;
  category: "core" | "communication" | "integration" | "advanced" | "pharmacy";
  systemTypes: SystemType[];
  tiers: TierSlug[];
  enabled: boolean;
}

// ---------- Pricing Tiers ----------

export const pricingTiers: PricingTier[] = [
  {
    id: "tier-1",
    slug: "vitrine",
    name: "Vitrine",
    description: "Site vitrine simple pour votre visibilité en ligne",
    pricing: {
      doctor: { monthly: 99, yearly: 990 },
      dentist: { monthly: 99, yearly: 990 },
      pharmacy: { monthly: 79, yearly: 790 },
    },
    features: [
      { key: "website", label: "Site web public", included: true },
      { key: "contact_form", label: "Formulaire de contact", included: true },
      { key: "map", label: "Carte et localisation", included: true },
      { key: "seo", label: "SEO de base", included: true },
      { key: "booking", label: "Réservation en ligne", included: false },
      { key: "patient_portal", label: "Portail patient", included: false },
      { key: "whatsapp", label: "Notifications WhatsApp", included: false },
      { key: "analytics", label: "Analytics", included: false },
      { key: "multi_doctor", label: "Multi-praticien", included: false },
      { key: "api_access", label: "Accès API", included: false },
    ],
    limits: {
      maxDoctors: 1,
      maxPatients: 0,
      maxAppointmentsPerMonth: 0,
      storageGB: 1,
      customDomain: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  {
    id: "tier-2",
    slug: "cabinet",
    name: "Cabinet",
    description: "Gestion complète de votre cabinet médical",
    pricing: {
      doctor: { monthly: 199, yearly: 1990 },
      dentist: { monthly: 249, yearly: 2490 },
      pharmacy: { monthly: 149, yearly: 1490 },
    },
    features: [
      { key: "website", label: "Site web public", included: true },
      { key: "booking", label: "Réservation en ligne", included: true },
      { key: "patient_portal", label: "Portail patient", included: true },
      { key: "sms_reminders", label: "Rappels SMS", included: true },
      { key: "contact_form", label: "Formulaire de contact", included: true },
      { key: "map", label: "Carte et localisation", included: true },
      { key: "seo", label: "SEO de base", included: true },
      { key: "basic_analytics", label: "Analytics de base", included: true },
      { key: "whatsapp", label: "Notifications WhatsApp", included: false },
      { key: "multi_doctor", label: "Multi-praticien", included: false },
      { key: "api_access", label: "Accès API", included: false },
      { key: "custom_branding", label: "Branding personnalisé", included: false },
    ],
    limits: {
      maxDoctors: 1,
      maxPatients: 500,
      maxAppointmentsPerMonth: 200,
      storageGB: 5,
      customDomain: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  {
    id: "tier-3",
    slug: "pro",
    name: "Pro",
    description: "Pour les cabinets en croissance avec plusieurs praticiens",
    popular: true,
    pricing: {
      doctor: { monthly: 399, yearly: 3990 },
      dentist: { monthly: 449, yearly: 4490 },
      pharmacy: { monthly: 299, yearly: 2990 },
    },
    features: [
      { key: "website", label: "Site web public", included: true },
      { key: "booking", label: "Réservation en ligne", included: true },
      { key: "patient_portal", label: "Portail patient", included: true },
      { key: "whatsapp", label: "Notifications WhatsApp", included: true },
      { key: "sms_reminders", label: "Rappels SMS", included: true },
      { key: "analytics", label: "Analytics avancés", included: true },
      { key: "multi_doctor", label: "Multi-praticien", included: true, limit: "jusqu'à 5" },
      { key: "custom_branding", label: "Branding personnalisé", included: true },
      { key: "documents", label: "Gestion de documents", included: true },
      { key: "walk_in", label: "Gestion file d'attente", included: true },
      { key: "api_access", label: "Accès API", included: false },
      { key: "insurance", label: "Intégration assurance", included: false },
    ],
    limits: {
      maxDoctors: 5,
      maxPatients: 2000,
      maxAppointmentsPerMonth: 1000,
      storageGB: 20,
      customDomain: true,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  {
    id: "tier-4",
    slug: "premium",
    name: "Premium",
    description: "Toutes les fonctionnalités pour les grandes structures",
    pricing: {
      doctor: { monthly: 699, yearly: 6990 },
      dentist: { monthly: 799, yearly: 7990 },
      pharmacy: { monthly: 499, yearly: 4990 },
    },
    features: [
      { key: "website", label: "Site web public", included: true },
      { key: "booking", label: "Réservation en ligne", included: true },
      { key: "patient_portal", label: "Portail patient", included: true },
      { key: "whatsapp", label: "Notifications WhatsApp", included: true },
      { key: "sms_reminders", label: "Rappels SMS", included: true },
      { key: "analytics", label: "Analytics avancés", included: true },
      { key: "multi_doctor", label: "Multi-praticien", included: true, limit: "illimité" },
      { key: "custom_branding", label: "Branding personnalisé", included: true },
      { key: "documents", label: "Gestion de documents", included: true },
      { key: "walk_in", label: "Gestion file d'attente", included: true },
      { key: "api_access", label: "Accès API", included: true },
      { key: "insurance", label: "Intégration CNSS/CNOPS", included: true },
      { key: "online_payment", label: "Paiement en ligne CMI", included: true },
      { key: "white_label", label: "White label", included: true },
    ],
    limits: {
      maxDoctors: -1,
      maxPatients: -1,
      maxAppointmentsPerMonth: -1,
      storageGB: 100,
      customDomain: true,
      apiAccess: true,
      whiteLabel: true,
    },
  },
  {
    id: "tier-5",
    slug: "saas-monthly",
    name: "SaaS Monthly",
    description: "Paiement flexible au mois sans engagement",
    pricing: {
      doctor: { monthly: 499, yearly: 0 },
      dentist: { monthly: 549, yearly: 0 },
      pharmacy: { monthly: 349, yearly: 0 },
    },
    features: [
      { key: "website", label: "Site web public", included: true },
      { key: "booking", label: "Réservation en ligne", included: true },
      { key: "patient_portal", label: "Portail patient", included: true },
      { key: "whatsapp", label: "Notifications WhatsApp", included: true },
      { key: "sms_reminders", label: "Rappels SMS", included: true },
      { key: "analytics", label: "Analytics avancés", included: true },
      { key: "multi_doctor", label: "Multi-praticien", included: true, limit: "jusqu'à 3" },
      { key: "custom_branding", label: "Branding personnalisé", included: true },
      { key: "documents", label: "Gestion de documents", included: true },
      { key: "walk_in", label: "Gestion file d'attente", included: true },
      { key: "api_access", label: "Accès API", included: true },
      { key: "insurance", label: "Intégration assurance", included: false },
    ],
    limits: {
      maxDoctors: 3,
      maxPatients: 5000,
      maxAppointmentsPerMonth: 2000,
      storageGB: 50,
      customDomain: true,
      apiAccess: true,
      whiteLabel: false,
    },
  },
];

// ---------- Feature Toggles ----------

export const featureToggles: FeatureToggle[] = [
  { id: "ft-1", key: "online_booking", label: "Réservation en ligne", description: "Permettre aux patients de réserver en ligne", category: "core", systemTypes: ["doctor", "dentist"], tiers: ["cabinet", "pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-2", key: "patient_portal", label: "Portail patient", description: "Accès aux dossiers médicaux et historique", category: "core", systemTypes: ["doctor", "dentist", "pharmacy"], tiers: ["cabinet", "pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-3", key: "whatsapp_notif", label: "WhatsApp Notifications", description: "Envoi de confirmations et rappels via WhatsApp", category: "communication", systemTypes: ["doctor", "dentist", "pharmacy"], tiers: ["pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-4", key: "sms_reminders", label: "Rappels SMS", description: "Rappels de rendez-vous par SMS", category: "communication", systemTypes: ["doctor", "dentist"], tiers: ["cabinet", "pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-5", key: "multi_doctor", label: "Multi-praticien", description: "Support de plusieurs praticiens par cabinet", category: "advanced", systemTypes: ["doctor", "dentist"], tiers: ["pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-6", key: "analytics", label: "Analytics avancés", description: "Rapports de revenus, graphiques, et exports", category: "core", systemTypes: ["doctor", "dentist", "pharmacy"], tiers: ["pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-7", key: "custom_branding", label: "Branding personnalisé", description: "Personnalisation du thème, logo, et couleurs", category: "advanced", systemTypes: ["doctor", "dentist", "pharmacy"], tiers: ["pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-8", key: "api_access", label: "Accès API", description: "API REST pour intégrations tierces", category: "integration", systemTypes: ["doctor", "dentist", "pharmacy"], tiers: ["premium", "saas-monthly"], enabled: true },
  { id: "ft-9", key: "insurance", label: "Intégration CNSS/CNOPS", description: "Traitement automatique des réclamations d'assurance", category: "integration", systemTypes: ["doctor", "dentist"], tiers: ["premium"], enabled: false },
  { id: "ft-10", key: "online_payment", label: "Paiement en ligne CMI", description: "Accepter les paiements en ligne via CMI", category: "integration", systemTypes: ["doctor", "dentist", "pharmacy"], tiers: ["premium"], enabled: true },
  { id: "ft-11", key: "prescription_upload", label: "Upload ordonnances", description: "Les patients téléversent leurs ordonnances", category: "pharmacy", systemTypes: ["pharmacy"], tiers: ["cabinet", "pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-12", key: "stock_management", label: "Gestion de stock", description: "Inventaire, alertes de stock, et suivi d'expiration", category: "pharmacy", systemTypes: ["pharmacy"], tiers: ["pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-13", key: "loyalty_program", label: "Programme de fidélité", description: "Points, récompenses, et carte de fidélité digitale", category: "pharmacy", systemTypes: ["pharmacy"], tiers: ["pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-14", key: "supplier_mgmt", label: "Gestion fournisseurs", description: "Commandes fournisseurs et suivi de livraison", category: "pharmacy", systemTypes: ["pharmacy"], tiers: ["pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-15", key: "walk_in", label: "File d'attente", description: "Gestion des patients sans rendez-vous", category: "core", systemTypes: ["doctor", "dentist"], tiers: ["cabinet", "pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-16", key: "document_mgmt", label: "Gestion de documents", description: "Stockage et partage de documents numériques", category: "core", systemTypes: ["doctor", "dentist", "pharmacy"], tiers: ["pro", "premium", "saas-monthly"], enabled: true },
  { id: "ft-17", key: "white_label", label: "White label", description: "Supprimer la marque de la plateforme", category: "advanced", systemTypes: ["doctor", "dentist", "pharmacy"], tiers: ["premium"], enabled: true },
  { id: "ft-18", key: "on_duty", label: "Pharmacie de garde", description: "Indicateur et planning de garde", category: "pharmacy", systemTypes: ["pharmacy"], tiers: ["vitrine", "cabinet", "pro", "premium", "saas-monthly"], enabled: true },
];

// ---------- Client Subscriptions ----------

export const clientSubscriptions: ClientSubscription[] = [
  {
    id: "sub-1", clinicId: "c1", clinicName: "Cabinet Dr. Ahmed Benali", systemType: "doctor",
    tierSlug: "premium", tierName: "Premium", status: "active",
    currentPeriodStart: "2026-03-01", currentPeriodEnd: "2026-03-31",
    billingCycle: "monthly", amount: 699, currency: "MAD", paymentMethod: "Carte bancaire", autoRenew: true,
    invoices: [
      { id: "inv-1a", date: "2026-03-01", amount: 699, status: "paid", paidDate: "2026-03-01" },
      { id: "inv-1b", date: "2026-02-01", amount: 699, status: "paid", paidDate: "2026-02-01" },
      { id: "inv-1c", date: "2026-01-01", amount: 699, status: "paid", paidDate: "2026-01-02" },
    ],
  },
  {
    id: "sub-2", clinicId: "c2", clinicName: "Dental Studio Marrakech", systemType: "dentist",
    tierSlug: "premium", tierName: "Premium", status: "active",
    currentPeriodStart: "2026-01-01", currentPeriodEnd: "2026-12-31",
    billingCycle: "yearly", amount: 7990, currency: "MAD", paymentMethod: "Virement", autoRenew: true,
    invoices: [
      { id: "inv-2a", date: "2026-01-01", amount: 7990, status: "paid", paidDate: "2026-01-03" },
    ],
  },
  {
    id: "sub-3", clinicId: "c3", clinicName: "Pharmacie Centrale Rabat", systemType: "pharmacy",
    tierSlug: "pro", tierName: "Pro", status: "active",
    currentPeriodStart: "2026-03-01", currentPeriodEnd: "2026-03-31",
    billingCycle: "monthly", amount: 299, currency: "MAD", paymentMethod: "Carte bancaire", autoRenew: true,
    invoices: [
      { id: "inv-3a", date: "2026-03-01", amount: 299, status: "paid", paidDate: "2026-03-02" },
      { id: "inv-3b", date: "2026-02-01", amount: 299, status: "paid", paidDate: "2026-02-01" },
    ],
  },
  {
    id: "sub-4", clinicId: "c4", clinicName: "Cabinet Dr. Youssef", systemType: "doctor",
    tierSlug: "cabinet", tierName: "Cabinet", status: "trial",
    currentPeriodStart: "2026-03-01", currentPeriodEnd: "2026-03-31",
    billingCycle: "monthly", amount: 199, currency: "MAD", paymentMethod: "—", autoRenew: false,
    trialEndsAt: "2026-04-01",
    invoices: [],
  },
  {
    id: "sub-5", clinicId: "c5", clinicName: "Clinique Dentaire Tanger", systemType: "dentist",
    tierSlug: "pro", tierName: "Pro", status: "past_due",
    currentPeriodStart: "2026-02-01", currentPeriodEnd: "2026-02-28",
    billingCycle: "monthly", amount: 449, currency: "MAD", paymentMethod: "Carte bancaire", autoRenew: true,
    invoices: [
      { id: "inv-5a", date: "2026-03-01", amount: 449, status: "overdue" },
      { id: "inv-5b", date: "2026-02-01", amount: 449, status: "paid", paidDate: "2026-02-15" },
    ],
  },
  {
    id: "sub-6", clinicId: "c6", clinicName: "Pharmacie Ibn Sina", systemType: "pharmacy",
    tierSlug: "vitrine", tierName: "Vitrine", status: "suspended",
    currentPeriodStart: "2025-12-01", currentPeriodEnd: "2025-12-31",
    billingCycle: "monthly", amount: 79, currency: "MAD", paymentMethod: "—", autoRenew: false,
    cancelledAt: "2026-01-05",
    invoices: [
      { id: "inv-6a", date: "2026-01-01", amount: 79, status: "overdue" },
      { id: "inv-6b", date: "2025-12-01", amount: 79, status: "paid", paidDate: "2025-12-01" },
    ],
  },
  {
    id: "sub-7", clinicId: "c7", clinicName: "Centre Médical Oujda", systemType: "doctor",
    tierSlug: "pro", tierName: "Pro", status: "active",
    currentPeriodStart: "2026-03-01", currentPeriodEnd: "2026-03-31",
    billingCycle: "monthly", amount: 399, currency: "MAD", paymentMethod: "Carte bancaire", autoRenew: true,
    invoices: [
      { id: "inv-7a", date: "2026-03-01", amount: 399, status: "paid", paidDate: "2026-03-01" },
    ],
  },
  {
    id: "sub-8", clinicId: "c8", clinicName: "Cabinet Dentaire Meknès", systemType: "dentist",
    tierSlug: "premium", tierName: "Premium", status: "active",
    currentPeriodStart: "2026-01-01", currentPeriodEnd: "2026-12-31",
    billingCycle: "yearly", amount: 7990, currency: "MAD", paymentMethod: "Virement", autoRenew: true,
    invoices: [
      { id: "inv-8a", date: "2026-01-01", amount: 7990, status: "paid", paidDate: "2026-01-05" },
    ],
  },
];

// ---------- Helpers ----------

export function getTierBySlug(slug: TierSlug): PricingTier | undefined {
  return pricingTiers.find((t) => t.slug === slug);
}

export function getTierPrice(slug: TierSlug, systemType: SystemType, cycle: "monthly" | "yearly"): number {
  const tier = getTierBySlug(slug);
  if (!tier) return 0;
  return tier.pricing[systemType][cycle];
}

export function getFeatureTogglesForType(systemType: SystemType): FeatureToggle[] {
  return featureToggles.filter((ft) => ft.systemTypes.includes(systemType));
}

export function getFeatureTogglesForTier(tierSlug: TierSlug): FeatureToggle[] {
  return featureToggles.filter((ft) => ft.tiers.includes(tierSlug));
}

export function getActiveSubscriptions(): ClientSubscription[] {
  return clientSubscriptions.filter((s) => s.status === "active");
}

export function getSubscriptionsByType(systemType: SystemType): ClientSubscription[] {
  return clientSubscriptions.filter((s) => s.systemType === systemType);
}

export function getTotalMRR(): number {
  return clientSubscriptions
    .filter((s) => s.status === "active" || s.status === "past_due")
    .reduce((sum, s) => {
      if (s.billingCycle === "yearly") return sum + Math.round(s.amount / 12);
      return sum + s.amount;
    }, 0);
}

export function getSubscriptionStats() {
  const active = clientSubscriptions.filter((s) => s.status === "active").length;
  const trial = clientSubscriptions.filter((s) => s.status === "trial").length;
  const pastDue = clientSubscriptions.filter((s) => s.status === "past_due").length;
  const cancelled = clientSubscriptions.filter((s) => s.status === "cancelled" || s.status === "suspended").length;
  return { active, trial, pastDue, cancelled, total: clientSubscriptions.length };
}

export const systemTypeLabels: Record<SystemType, string> = {
  doctor: "Médecin",
  dentist: "Dentiste",
  pharmacy: "Pharmacie",
};

export const tierColors: Record<TierSlug, string> = {
  vitrine: "bg-gray-100 text-gray-700",
  cabinet: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  premium: "bg-amber-100 text-amber-700",
  "saas-monthly": "bg-emerald-100 text-emerald-700",
};

export const statusColors: Record<ClientSubscription["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  trial: "bg-blue-100 text-blue-700",
  past_due: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-100 text-gray-500",
  suspended: "bg-red-100 text-red-700",
};
