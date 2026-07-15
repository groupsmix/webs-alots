import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ToggleLeft,
  ToggleRight,
  FileText,
  LifeBuoy,
  Shield,
  Scale,
  Megaphone,
  DollarSign,
  Receipt,
  UserPlus,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Users,
  Activity,
  Gift,
  Gauge,
  GitCompareArrows,
  HeartPulse,
  Stethoscope,
  MessageSquarePlus,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  children?: { href: string; label: string; icon: typeof LayoutDashboard }[];
}

export interface NavGroup {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    key: "overview",
    label: "Aperçu",
    icon: LayoutDashboard,
    items: [
      { href: "/super-admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      {
        href: "/super-admin/analytics",
        label: "Analytics",
        icon: BarChart3,
        children: [
          { href: "/super-admin/analytics", label: "Vue d'ensemble", icon: BarChart3 },
          {
            href: "/super-admin/analytics/compare",
            label: "Comparaison cliniques",
            icon: GitCompareArrows,
          },
          { href: "/super-admin/analytics/churn", label: "Détection churn", icon: AlertTriangle },
        ],
      },
    ],
  },
  {
    key: "clinics",
    label: "Cliniques",
    icon: Building2,
    items: [
      { href: "/super-admin/clinics", label: "Toutes les cliniques", icon: Building2 },
      { href: "/super-admin/onboarding", label: "Onboarding clients", icon: UserPlus },
      { href: "/super-admin/team", label: "Équipe", icon: Users },
    ],
  },
  {
    key: "revenue",
    label: "Revenus",
    icon: CreditCard,
    items: [
      {
        href: "/super-admin/billing",
        label: "Facturation",
        icon: CreditCard,
        children: [
          {
            href: "/super-admin/billing/revenue",
            label: "Vue revenus",
            icon: TrendingUp,
          },
          {
            href: "/super-admin/billing/forecast",
            label: "Prévisions",
            icon: BarChart3,
          },
        ],
      },
      { href: "/super-admin/pricing", label: "Tarifs & Offres", icon: DollarSign },
      { href: "/super-admin/subscriptions", label: "Abonnements", icon: Receipt },
      { href: "/super-admin/referrals", label: "Références méd.", icon: Stethoscope },
      { href: "/super-admin/referral-program", label: "Prog. parrainage", icon: Gift },
      { href: "/super-admin/usage", label: "Activité cliniques", icon: Gauge },
      { href: "/super-admin/usage-dashboard", label: "Coûts & quotas", icon: BarChart3 },
    ],
  },
  {
    key: "content",
    label: "Contenu",
    icon: FileText,
    items: [
      { href: "/super-admin/announcements", label: "Annonces", icon: Megaphone },
      { href: "/super-admin/templates", label: "Modèles", icon: FileText },
      { href: "/super-admin/features", label: "Fonctionnalités", icon: ToggleRight },
      { href: "/super-admin/feature-flags", label: "Feature Flags", icon: ToggleLeft },
    ],
  },
  {
    key: "operations",
    label: "Opérations",
    icon: Activity,
    items: [
      { href: "/super-admin/system", label: "Statut système", icon: Activity },
      { href: "/super-admin/system/health", label: "Métriques santé", icon: HeartPulse },
      { href: "/super-admin/system/sla", label: "SLA disponibilité", icon: Shield },
      { href: "/super-admin/compliance", label: "Conformité", icon: Scale },
      { href: "/super-admin/support", label: "Support", icon: LifeBuoy },
      { href: "/super-admin/feedback", label: "Retours produit", icon: MessageSquarePlus },
    ],
  },
];

export const navItems = navGroups.flatMap((g) => g.items);
