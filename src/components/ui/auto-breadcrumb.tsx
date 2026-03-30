"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb, type BreadcrumbItem } from "./breadcrumb";

/**
 * French labels for common route segments used across dashboards.
 * Falls back to a capitalised version of the segment if not found.
 */
const SEGMENT_LABELS: Record<string, string> = {
  // Roots
  doctor: "Médecin",
  admin: "Administration",
  patient: "Patient",
  receptionist: "Réception",
  // Common pages
  dashboard: "Tableau de bord",
  patients: "Patients",
  schedule: "Agenda",
  "waiting-room": "Salle d'attente",
  slots: "Créneaux",
  prescriptions: "Ordonnances",
  consultation: "Consultation",
  certificates: "Certificats",
  analytics: "Statistiques",
  chat: "Messagerie",
  settings: "Paramètres",
  notifications: "Notifications",
  appointments: "Rendez-vous",
  invoices: "Factures",
  documents: "Documents",
  family: "Famille",
  feedback: "Avis",
  "medical-history": "Historique médical",
  "medical-timeline": "Chronologie médicale",
  "payment-plan": "Plan de paiement",
  "treatment-plan": "Plan de traitement",
  "before-after": "Avant / Après",
  "tooth-map": "Carte dentaire",
  // Admin pages
  doctors: "Médecins",
  receptionists: "Réceptionnistes",
  services: "Services",
  "working-hours": "Horaires",
  holidays: "Jours fériés",
  branding: "Image de marque",
  billing: "Facturation",
  reviews: "Avis",
  departments: "Départements",
  machines: "Machines",
  templates: "Modèles",
  reports: "Rapports",
  beds: "Lits",
  "custom-fields": "Champs personnalisés",
  sections: "Sections",
  "website-editor": "Éditeur de site",
  "lab-invoices": "Factures labo",
  "lab-materials": "Matériel labo",
  // Doctor specialty pages
  odontogram: "Odontogramme",
  "treatment-plans": "Plans de traitement",
  "prosthetic-orders": "Commandes prothèses",
  sterilization: "Stérilisation",
  "consultation-photos": "Photos consultation",
  stock: "Stock",
  installments: "Échéances",
  "treatment-packages": "Forfaits",
  "lab-orders": "Bilans labo",
  "consent-forms": "Consentements",
  "ivf-cycles": "Cycles FIV",
  "ivf-protocols": "Protocoles FIV",
  "dialysis-sessions": "Séances dialyse",
  "dialysis-machines": "Machines dialyse",
  dermatology: "Dermatologie",
  cardiology: "Cardiologie",
  ent: "ORL",
  orthopedics: "Orthopédie",
  psychiatry: "Psychiatrie",
  neurology: "Neurologie",
  urology: "Urologie",
  pulmonology: "Pneumologie",
  endocrinology: "Endocrinologie",
  rheumatology: "Rhumatologie",
  "growth-charts": "Courbes de croissance",
  vaccinations: "Vaccinations",
  "child-info": "Développement enfant",
  pregnancies: "Grossesses",
  ultrasounds: "Échographies",
  "vision-tests": "Tests de vision",
  "iop-tracking": "Suivi PIO",
};

function labelFor(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Breadcrumb component that auto-generates items from the current pathname.
 *
 * Designed for dashboard pages under `/doctor/*`, `/admin/*`,
 * `/patient/*`, and `/receptionist/*` (Issue 44).
 */
export function AutoBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Skip rendering on the root dashboard itself (e.g. /doctor/dashboard)
  if (segments.length <= 2) return null;

  const items: BreadcrumbItem[] = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    return { label: labelFor(seg), href };
  });

  return <Breadcrumb items={items} className={className} />;
}
