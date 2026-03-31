"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import {
  LayoutDashboard, Users, Calendar, Pill, FileEdit, Clock,
  MessageCircle, CalendarClock, BarChart3, ClipboardList,
  FlaskConical, ShieldCheck, Camera, Package, CreditCard, Award,
  Building2, FileCheck, Sparkles, HeartHandshake, Droplets, Monitor, Boxes, FileText,
  Heart, Ear, Bone, Brain, Activity, Wind, Target,
  Ruler, Syringe, Baby, Image, Eye,
  Menu, X, ChevronDown, Search, Stethoscope, Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/components/sign-out-button";
import { useClinicFeatures, SPECIALTY_FEATURES } from "@/lib/hooks/use-clinic-features";
import { clinicConfig } from "@/config/clinic.config";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";
import { PatientSearchPalette } from "@/components/patient-search-palette";
import { signOut } from "@/lib/auth";
import type { ClinicFeatureKey } from "@/lib/features";
import { AutoBreadcrumb } from "@/components/ui/auto-breadcrumb";
import { MobileTabBar } from "@/components/layouts/mobile-tab-bar";
import type { MobileTabItem } from "@/components/layouts/mobile-tab-bar";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  requiredFeature?: ClinicFeatureKey;
  section?: string;
}

const navItems: NavItem[] = [
  // General
  { href: "/doctor/dashboard", labelKey: "doctorNav.dashboard", icon: LayoutDashboard, section: "General" },
  { href: "/doctor/patients", labelKey: "doctorNav.myPatients", icon: Users, section: "General" },
  { href: "/doctor/chat", labelKey: "doctorNav.chat", icon: MessageCircle, section: "General" },
  { href: "/doctor/analytics", labelKey: "doctorNav.analytics", icon: BarChart3, section: "General" },
  // Appointments
  { href: "/doctor/schedule", labelKey: "doctorNav.schedule", icon: Calendar, requiredFeature: "appointments", section: "Appointments" },
  { href: "/doctor/waiting-room", labelKey: "doctorNav.waitingRoom", icon: Clock, requiredFeature: "appointments", section: "Appointments" },
  { href: "/doctor/slots", labelKey: "doctorNav.availableSlots", icon: CalendarClock, requiredFeature: "appointments", section: "Appointments" },
  // Clinical
  { href: "/doctor/prescriptions", labelKey: "doctorNav.prescriptions", icon: Pill, requiredFeature: "prescriptions", section: "Clinical" },
  { href: "/doctor/consultation", labelKey: "doctorNav.consultationNotes", icon: FileEdit, requiredFeature: "consultations", section: "Clinical" },
  { href: "/doctor/lab-orders", labelKey: "doctorNav.labOrders", icon: FlaskConical, requiredFeature: "lab_results", section: "Clinical" },
  { href: "/doctor/certificates", labelKey: "doctorNav.certificates", icon: Award, requiredFeature: "certificates", section: "Clinical" },
  { href: "/doctor/consent-forms", labelKey: "doctorNav.consentForms", icon: FileCheck, requiredFeature: "consent_forms", section: "Clinical" },
  // Dental
  { href: "/doctor/odontogram", labelKey: "doctorNav.odontogram", icon: ClipboardList, requiredFeature: "odontogram", section: "Dental" },
  { href: "/doctor/treatment-plans", labelKey: "doctorNav.treatmentPlans", icon: ClipboardList, requiredFeature: "odontogram", section: "Dental" },
  { href: "/doctor/prosthetic-orders", labelKey: "doctorNav.prostheticOrders", icon: Package, requiredFeature: "prosthetic_orders", section: "Dental" },
  { href: "/doctor/sterilization", labelKey: "doctorNav.sterilizationLog", icon: ShieldCheck, requiredFeature: "sterilization_log", section: "Dental" },
  // Media & Photos
  { href: "/doctor/before-after", labelKey: "doctorNav.beforeAfter", icon: Camera, requiredFeature: "before_after_photos", section: "Media" },
  { href: "/doctor/consultation-photos", labelKey: "doctorNav.consultationPhotos", icon: Camera, requiredFeature: "consultation_photos", section: "Media" },
  // Finance
  { href: "/doctor/stock", labelKey: "doctorNav.materialStock", icon: Package, requiredFeature: "stock", section: "Finance" },
  { href: "/doctor/installments", labelKey: "doctorNav.installments", icon: CreditCard, requiredFeature: "installments", section: "Finance" },
  { href: "/doctor/lab-materials", labelKey: "doctorNav.labMaterials", icon: Boxes, requiredFeature: "lab_materials", section: "Finance" },
  { href: "/doctor/lab-invoices", labelKey: "doctorNav.labInvoices", icon: FileText, requiredFeature: "lab_invoices", section: "Finance" },
  // Clinics & Centers
  { href: "/doctor/departments", labelKey: "doctorNav.departments", icon: Building2, requiredFeature: "departments", section: "Clinic" },
  { href: "/doctor/treatment-packages", labelKey: "doctorNav.treatmentPackages", icon: Sparkles, requiredFeature: "treatment_packages", section: "Clinic" },
  // Specialty: IVF
  { href: "/doctor/ivf-cycles", labelKey: "doctorNav.ivfCycles", icon: HeartHandshake, requiredFeature: "ivf_cycles", section: "Specialty" },
  { href: "/doctor/ivf-protocols", labelKey: "doctorNav.ivfProtocols", icon: ClipboardList, requiredFeature: "ivf_protocols", section: "Specialty" },
  // Specialty: Dialysis
  { href: "/doctor/dialysis-sessions", labelKey: "doctorNav.dialysisSessions", icon: Droplets, requiredFeature: "dialysis_sessions", section: "Specialty" },
  { href: "/doctor/dialysis-machines", labelKey: "doctorNav.dialysisMachines", icon: Monitor, requiredFeature: "dialysis_machines", section: "Specialty" },
  // Specialty: Medical Specialties
  { href: "/doctor/dermatology", labelKey: "doctorNav.dermatology", icon: Camera, requiredFeature: "dermatology", section: "Specialty" },
  { href: "/doctor/cardiology", labelKey: "doctorNav.cardiology", icon: Heart, requiredFeature: "cardiology", section: "Specialty" },
  { href: "/doctor/ent", labelKey: "doctorNav.ent", icon: Ear, requiredFeature: "ent", section: "Specialty" },
  { href: "/doctor/orthopedics", labelKey: "doctorNav.orthopedics", icon: Bone, requiredFeature: "orthopedics", section: "Specialty" },
  { href: "/doctor/psychiatry", labelKey: "doctorNav.psychiatry", icon: Brain, requiredFeature: "psychiatry", section: "Specialty" },
  { href: "/doctor/neurology", labelKey: "doctorNav.neurology", icon: Activity, requiredFeature: "neurology", section: "Specialty" },
  { href: "/doctor/urology", labelKey: "doctorNav.urology", icon: ClipboardList, requiredFeature: "urology", section: "Specialty" },
  { href: "/doctor/pulmonology", labelKey: "doctorNav.pulmonology", icon: Wind, requiredFeature: "pulmonology", section: "Specialty" },
  { href: "/doctor/endocrinology", labelKey: "doctorNav.endocrinology", icon: Droplets, requiredFeature: "endocrinology", section: "Specialty" },
  { href: "/doctor/rheumatology", labelKey: "doctorNav.rheumatology", icon: Target, requiredFeature: "rheumatology", section: "Specialty" },
  // Pediatrician
  { href: "/doctor/growth-charts", labelKey: "doctorNav.growthCharts", icon: Ruler, requiredFeature: "growth_charts", section: "Specialty" },
  { href: "/doctor/vaccinations", labelKey: "doctorNav.vaccinations", icon: Syringe, requiredFeature: "vaccination", section: "Specialty" },
  { href: "/doctor/child-info", labelKey: "doctorNav.childDevelopment", icon: Baby, requiredFeature: "growth_charts", section: "Specialty" },
  // Gynecologist
  { href: "/doctor/pregnancies", labelKey: "doctorNav.pregnancyTracking", icon: Heart, requiredFeature: "pregnancy_tracking", section: "Specialty" },
  { href: "/doctor/ultrasounds", labelKey: "doctorNav.ultrasoundRecords", icon: Image, requiredFeature: "ultrasound_records", section: "Specialty" },
  // Ophthalmologist
  { href: "/doctor/vision-tests", labelKey: "doctorNav.visionTests", icon: Eye, requiredFeature: "vision_tests", section: "Specialty" },
  { href: "/doctor/iop-tracking", labelKey: "doctorNav.iopTracking", icon: Activity, requiredFeature: "iop_tracking", section: "Specialty" },
];

/** Section label i18n key mapping */
const SECTION_LABEL_KEYS: Record<string, TranslationKey> = {
  General: "doctorNav.general",
  Appointments: "doctorNav.appointments",
  Clinical: "doctorNav.clinical",
  Dental: "doctorNav.dental",
  Media: "doctorNav.media",
  Finance: "doctorNav.finance",
  Clinic: "doctorNav.clinic",
  Specialty: "doctorNav.specialty",
};

const NAV_SECTIONS: { key: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "General", icon: LayoutDashboard },
  { key: "Appointments", icon: Calendar },
  { key: "Clinical", icon: FileEdit },
  { key: "Dental", icon: ClipboardList },
  { key: "Media", icon: Camera },
  { key: "Finance", icon: CreditCard },
  { key: "Clinic", icon: Building2 },
  { key: "Specialty", icon: Stethoscope },
];

/** Read pinned nav hrefs from localStorage */
function getPinnedItems(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("doctor-pinned-nav");
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Persist pinned nav hrefs to localStorage */
function setPinnedItems(hrefs: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("doctor-pinned-nav", JSON.stringify(hrefs));
}

function SidebarContent({
  pathname,
  visibleItems,
  onNavClick,
  selectedSpecialty,
  onSpecialtyChange,
}: {
  pathname: string;
  visibleItems: NavItem[];
  onNavClick?: () => void;
  selectedSpecialty: string | null;
  onSpecialtyChange: (v: string | null) => void;
}) {
  const [locale] = useLocale();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Default: only expand the section containing the active route (collapse all others)
    const activeItem = visibleItems.find((item) => pathname === item.href);
    const activeSection = activeItem?.section ?? "General";
    return new Set([activeSection]);
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>(() => getPinnedItems());
  // Progressive disclosure: track which sections show all items (Issue 15)
  const [fullyExpandedSections, setFullyExpandedSections] = useState<Set<string>>(new Set());
  const MAX_VISIBLE_ITEMS = 5;

  const togglePin = useCallback((href: string) => {
    setPinnedHrefs((prev) => {
      const next = prev.includes(href)
        ? prev.filter((h) => h !== href)
        : [...prev, href];
      setPinnedItems(next);
      return next;
    });
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // Group visible items by section
  const grouped = new Map<string, NavItem[]>();
  for (const item of visibleItems) {
    const section = item.section ?? "General";
    const arr = grouped.get(section);
    if (arr) arr.push(item);
    else grouped.set(section, [item]);
  }

  // Pinned items (only visible ones)
  const pinnedItems = visibleItems.filter((item) => pinnedHrefs.includes(item.href));

  // Filter by search — match translated label
  const filteredItems = searchQuery.trim()
    ? visibleItems.filter((item) =>
        t(locale, item.labelKey).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  /** Render a single nav link with optional pin button */
  const renderNavLink = (item: NavItem, compact = false) => {
    const isActive = pathname === item.href;
    const isPinned = pinnedHrefs.includes(item.href);
    return (
      <div key={item.href} className="group flex items-center">
        <Link
          href={item.href}
          onClick={onNavClick}
          aria-current={isActive ? "page" : undefined}
          className={`flex flex-1 items-center gap-3 rounded-lg px-3 ${compact ? "py-1.5" : "py-2"} text-sm transition-colors ${
            isActive
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <item.icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          {t(locale, item.labelKey)}
        </Link>
        <button
          onClick={() => togglePin(item.href)}
          title={isPinned ? t(locale, "doctorNav.unpin") : t(locale, "doctorNav.pin")}
          className={`p-1 rounded transition-opacity ${
            isPinned
              ? "text-primary opacity-100"
              : "text-muted-foreground opacity-0 group-hover:opacity-100"
          }`}
        >
          <Pin className="h-3 w-3" />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t(locale, "doctorNav.searchNav")}
          className="pl-9 h-8 text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Specialty Filter */}
      <div className="mb-3">
        <select
          className="w-full text-xs border rounded-md p-1.5 bg-background"
          value={selectedSpecialty ?? ""}
          onChange={(e) => onSpecialtyChange(e.target.value || null)}
        >
          <option value="">{t(locale, "doctorNav.allFeatures")}</option>
          <option value="gp">{t(locale, "specialty.gp")}</option>
          <option value="dentist">{t(locale, "specialty.dentist")}</option>
          <option value="pediatrician">{t(locale, "specialty.pediatrician")}</option>
          <option value="gynecologist">{t(locale, "specialty.gynecologist")}</option>
          <option value="ophthalmologist">{t(locale, "specialty.ophthalmologist")}</option>
          <option value="cardiologist">{t(locale, "specialty.cardiologist")}</option>
          <option value="dermatologist">{t(locale, "specialty.dermatologist")}</option>
          <option value="orthopedist">{t(locale, "specialty.orthopedist")}</option>
          <option value="neurologist">{t(locale, "specialty.neurologist")}</option>
          <option value="psychiatrist">{t(locale, "specialty.psychiatrist")}</option>
          <option value="physiotherapist">{t(locale, "specialty.physiotherapist")}</option>
          <option value="radiologist">{t(locale, "specialty.radiologist")}</option>
          <option value="nutritionist">{t(locale, "specialty.nutritionist")}</option>
          <option value="ivf_specialist">{t(locale, "specialty.ivf_specialist")}</option>
          <option value="dialysis_specialist">{t(locale, "specialty.dialysis_specialist")}</option>
        </select>
      </div>

      {/* Flat search results */}
      {filteredItems ? (
        <nav className="space-y-1 overflow-y-auto flex-1">
          {filteredItems.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">{t(locale, "doctorNav.noResults")}</p>
          ) : (
            filteredItems.map((item) => renderNavLink(item))
          )}
        </nav>
      ) : (
        /* Pinned + Collapsible sections */
        <nav className="space-y-1 overflow-y-auto flex-1">
          {/* Pinned Items Section */}
          {pinnedItems.length > 0 && (
            <div className="mb-2 pb-2 border-b">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t(locale, "doctorNav.pinned")}
              </p>
              {pinnedItems.map((item) => renderNavLink(item))}
            </div>
          )}

          {NAV_SECTIONS.map((section) => {
            const items = grouped.get(section.key);
            if (!items || items.length === 0) return null;
            const isExpanded = expandedSections.has(section.key);
            const hasActiveChild = items.some((item) => pathname === item.href);
            return (
              <div key={section.key}>
                <button
                  onClick={() => toggleSection(section.key)}
                  className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted ${
                    hasActiveChild ? "text-primary font-medium" : "text-muted-foreground"
                  }`}
                >
                  <section.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{t(locale, SECTION_LABEL_KEYS[section.key] ?? section.key)}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                  />
                </button>
                {isExpanded && (
                  <div className="ml-4 space-y-0.5">
                    {(fullyExpandedSections.has(section.key) || items.length <= MAX_VISIBLE_ITEMS
                      ? items
                      : items.slice(0, MAX_VISIBLE_ITEMS)
                    ).map((item) => renderNavLink(item, true))}
                    {items.length > MAX_VISIBLE_ITEMS && !fullyExpandedSections.has(section.key) && (
                      <button
                        onClick={() => setFullyExpandedSections((prev) => new Set([...prev, section.key]))}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-primary hover:text-primary/80 hover:bg-muted rounded-lg transition-colors"
                      >
                        {t(locale, "doctorNav.showAll")} ({items.length - MAX_VISIBLE_ITEMS})
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}
    </>
  );
}

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [locale] = useLocale();
  const { hasFeature } = useClinicFeatures();
  // Auto-detect specialty from clinic config type (Issue 15).
  // Maps clinic types to the specialty filter keys used by SPECIALTY_FEATURES.
  const CLINIC_TYPE_TO_SPECIALTY: Record<string, string> = {
    doctor: "gp",
    dentist: "dentist",
    pediatrician: "pediatrician",
    gynecologist: "gynecologist",
    ophthalmologist: "ophthalmologist",
    cardiologist: "cardiologist",
    dermatologist: "dermatologist",
    orthopedist: "orthopedist",
    neurologist: "neurologist",
    psychiatrist: "psychiatrist",
    physiotherapist: "physiotherapist",
    nutritionist: "nutritionist",
  };
  const detectedSpecialty = CLINIC_TYPE_TO_SPECIALTY[clinicConfig.type] ?? null;
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(detectedSpecialty);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Doctor mobile tabs: Dashboard, Patients, Schedule, Prescriptions, More
  const doctorMobileTabs: MobileTabItem[] = [
    { href: "/doctor/dashboard", label: t(locale, "doctorNav.dashboard"), icon: LayoutDashboard },
    { href: "/doctor/patients", label: t(locale, "doctorNav.myPatients"), icon: Users },
    { href: "/doctor/schedule", label: t(locale, "doctorNav.schedule"), icon: Calendar },
    { href: "/doctor/prescriptions", label: t(locale, "doctorNav.prescriptions"), icon: Pill },
  ];

  const visibleItems = navItems.filter((item) => {
    if (selectedSpecialty) {
      const specialtyFeatures = SPECIALTY_FEATURES[selectedSpecialty.toLowerCase()];
      if (specialtyFeatures && specialtyFeatures.length > 0) {
        if (item.requiredFeature && !specialtyFeatures.includes(item.requiredFeature)) {
          return false;
        }
      }
    }
    return !item.requiredFeature || hasFeature(item.requiredFeature);
  });

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 border-r bg-card p-4 md:flex flex-col">
        <h2 className="text-lg font-semibold mb-4">{t(locale, "doctorNav.title")}</h2>
        <SidebarContent
          pathname={pathname}
          visibleItems={visibleItems}
          selectedSpecialty={selectedSpecialty}
          onSpecialtyChange={setSelectedSpecialty}
        />
        <div className="pt-4 border-t mt-4">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b p-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">{t(locale, "doctorNav.title")}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-card p-4 shadow-lg flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <Stethoscope className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold">{t(locale, "doctorNav.title")}</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <SidebarContent
                pathname={pathname}
                visibleItems={visibleItems}
                onNavClick={() => setMobileMenuOpen(false)}
                selectedSpecialty={selectedSpecialty}
                onSpecialtyChange={setSelectedSpecialty}
              />
              <div className="pt-4 border-t mt-4">
                <SignOutButton />
              </div>
            </div>
          </div>
        )}

        <main id="main-content" className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <AutoBreadcrumb />
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar
        tabs={doctorMobileTabs}
        onMoreClick={() => setMobileMenuOpen(true)}
      />

      <SessionTimeoutWarning onLogout={() => signOut()} />
      <PatientSearchPalette basePath="/doctor/patients" />
    </div>
  );
}
