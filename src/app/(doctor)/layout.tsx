"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, Calendar, Pill, FileEdit, Clock,
  MessageCircle, CalendarClock, BarChart3, ClipboardList,
  FlaskConical, ShieldCheck, Camera, Package, CreditCard, Award,
  Building2, FileCheck, Sparkles, HeartHandshake, Droplets, Monitor, Boxes, FileText,
  Heart, Ear, Bone, Brain, Activity, Wind, Target,
  Ruler, Syringe, Baby, Image, Eye,
  Menu, X, ChevronDown, Search, Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/components/sign-out-button";
import { useClinicFeatures, SPECIALTY_FEATURES } from "@/lib/hooks/use-clinic-features";
import type { ClinicFeatureKey } from "@/lib/features";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredFeature?: ClinicFeatureKey;
  section?: string;
}

const navItems: NavItem[] = [
  // General
  { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "General" },
  { href: "/doctor/patients", label: "My Patients", icon: Users, section: "General" },
  { href: "/doctor/chat", label: "Chat", icon: MessageCircle, section: "General" },
  { href: "/doctor/analytics", label: "Analytics", icon: BarChart3, section: "General" },
  // Appointments
  { href: "/doctor/schedule", label: "Schedule", icon: Calendar, requiredFeature: "appointments", section: "Appointments" },
  { href: "/doctor/waiting-room", label: "Waiting Room", icon: Clock, requiredFeature: "appointments", section: "Appointments" },
  { href: "/doctor/slots", label: "Available Slots", icon: CalendarClock, requiredFeature: "appointments", section: "Appointments" },
  // Clinical
  { href: "/doctor/prescriptions", label: "Prescriptions", icon: Pill, requiredFeature: "prescriptions", section: "Clinical" },
  { href: "/doctor/consultation", label: "Consultation Notes", icon: FileEdit, requiredFeature: "consultations", section: "Clinical" },
  { href: "/doctor/lab-orders", label: "Lab Orders", icon: FlaskConical, requiredFeature: "lab_results", section: "Clinical" },
  { href: "/doctor/certificates", label: "Certificates", icon: Award, requiredFeature: "certificates", section: "Clinical" },
  { href: "/doctor/consent-forms", label: "Consent Forms", icon: FileCheck, requiredFeature: "consent_forms", section: "Clinical" },
  // Dental
  { href: "/doctor/odontogram", label: "Odontogram", icon: ClipboardList, requiredFeature: "odontogram", section: "Dental" },
  { href: "/doctor/treatment-plans", label: "Treatment Plans", icon: ClipboardList, requiredFeature: "odontogram", section: "Dental" },
  { href: "/doctor/prosthetic-orders", label: "Prosthetic Orders", icon: Package, requiredFeature: "prosthetic_orders", section: "Dental" },
  { href: "/doctor/sterilization", label: "Sterilization Log", icon: ShieldCheck, requiredFeature: "sterilization_log", section: "Dental" },
  // Media & Photos
  { href: "/doctor/before-after", label: "Before/After", icon: Camera, requiredFeature: "before_after_photos", section: "Media" },
  { href: "/doctor/consultation-photos", label: "Consultation Photos", icon: Camera, requiredFeature: "consultation_photos", section: "Media" },
  // Finance
  { href: "/doctor/stock", label: "Material Stock", icon: Package, requiredFeature: "stock", section: "Finance" },
  { href: "/doctor/installments", label: "Installments", icon: CreditCard, requiredFeature: "installments", section: "Finance" },
  { href: "/doctor/lab-materials", label: "Lab Materials", icon: Boxes, requiredFeature: "lab_materials", section: "Finance" },
  { href: "/doctor/lab-invoices", label: "Lab Invoices", icon: FileText, requiredFeature: "lab_invoices", section: "Finance" },
  // Clinics & Centers
  { href: "/doctor/departments", label: "Departments", icon: Building2, requiredFeature: "departments", section: "Clinic" },
  { href: "/doctor/treatment-packages", label: "Treatment Packages", icon: Sparkles, requiredFeature: "treatment_packages", section: "Clinic" },
  // Specialty: IVF
  { href: "/doctor/ivf-cycles", label: "IVF Cycles", icon: HeartHandshake, requiredFeature: "ivf_cycles", section: "Specialty" },
  { href: "/doctor/ivf-protocols", label: "IVF Protocols", icon: ClipboardList, requiredFeature: "ivf_protocols", section: "Specialty" },
  // Specialty: Dialysis
  { href: "/doctor/dialysis-sessions", label: "Dialysis Sessions", icon: Droplets, requiredFeature: "dialysis_sessions", section: "Specialty" },
  { href: "/doctor/dialysis-machines", label: "Dialysis Machines", icon: Monitor, requiredFeature: "dialysis_machines", section: "Specialty" },
  // Specialty: Medical Specialties
  { href: "/doctor/dermatology", label: "Dermatology", icon: Camera, requiredFeature: "dermatology", section: "Specialty" },
  { href: "/doctor/cardiology", label: "Cardiology", icon: Heart, requiredFeature: "cardiology", section: "Specialty" },
  { href: "/doctor/ent", label: "ENT", icon: Ear, requiredFeature: "ent", section: "Specialty" },
  { href: "/doctor/orthopedics", label: "Orthopedics", icon: Bone, requiredFeature: "orthopedics", section: "Specialty" },
  { href: "/doctor/psychiatry", label: "Psychiatry", icon: Brain, requiredFeature: "psychiatry", section: "Specialty" },
  { href: "/doctor/neurology", label: "Neurology", icon: Activity, requiredFeature: "neurology", section: "Specialty" },
  { href: "/doctor/urology", label: "Urology", icon: ClipboardList, requiredFeature: "urology", section: "Specialty" },
  { href: "/doctor/pulmonology", label: "Pulmonology", icon: Wind, requiredFeature: "pulmonology", section: "Specialty" },
  { href: "/doctor/endocrinology", label: "Endocrinology", icon: Droplets, requiredFeature: "endocrinology", section: "Specialty" },
  { href: "/doctor/rheumatology", label: "Rheumatology", icon: Target, requiredFeature: "rheumatology", section: "Specialty" },
  // Pediatrician
  { href: "/doctor/growth-charts", label: "Growth Charts", icon: Ruler, requiredFeature: "growth_charts", section: "Specialty" },
  { href: "/doctor/vaccinations", label: "Vaccinations", icon: Syringe, requiredFeature: "vaccination", section: "Specialty" },
  { href: "/doctor/child-info", label: "Child Development", icon: Baby, requiredFeature: "growth_charts", section: "Specialty" },
  // Gynecologist
  { href: "/doctor/pregnancies", label: "Pregnancy Tracking", icon: Heart, requiredFeature: "pregnancy_tracking", section: "Specialty" },
  { href: "/doctor/ultrasounds", label: "Ultrasound Records", icon: Image, requiredFeature: "ultrasound_records", section: "Specialty" },
  // Ophthalmologist
  { href: "/doctor/vision-tests", label: "Vision Tests", icon: Eye, requiredFeature: "vision_tests", section: "Specialty" },
  { href: "/doctor/iop-tracking", label: "IOP Tracking", icon: Activity, requiredFeature: "iop_tracking", section: "Specialty" },
];

const NAV_SECTIONS: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "General", label: "General", icon: LayoutDashboard },
  { key: "Appointments", label: "Appointments", icon: Calendar },
  { key: "Clinical", label: "Clinical", icon: FileEdit },
  { key: "Dental", label: "Dental", icon: ClipboardList },
  { key: "Media", label: "Media & Photos", icon: Camera },
  { key: "Finance", label: "Finance & Stock", icon: CreditCard },
  { key: "Clinic", label: "Clinics & Centers", icon: Building2 },
  { key: "Specialty", label: "Specialty Tools", icon: Stethoscope },
];

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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Default: expand the section containing the active route
    const activeItem = visibleItems.find((item) => pathname === item.href);
    return new Set(activeItem?.section ? [activeItem.section, "General"] : ["General"]);
  });
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter by search
  const filteredItems = searchQuery.trim()
    ? visibleItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  return (
    <>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search navigation..."
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
          <option value="">All Features</option>
          <option value="gp">General Practitioner</option>
          <option value="dentist">Dentist</option>
          <option value="pediatrician">Pediatrician</option>
          <option value="gynecologist">Gynecologist</option>
          <option value="ophthalmologist">Ophthalmologist</option>
          <option value="cardiologist">Cardiologist</option>
          <option value="dermatologist">Dermatologist</option>
          <option value="orthopedist">Orthopedist</option>
          <option value="neurologist">Neurologist</option>
          <option value="psychiatrist">Psychiatrist</option>
          <option value="physiotherapist">Physiotherapist</option>
          <option value="radiologist">Radiologist</option>
          <option value="nutritionist">Nutritionist</option>
          <option value="ivf_specialist">IVF Specialist</option>
          <option value="dialysis_specialist">Dialysis Specialist</option>
        </select>
      </div>

      {/* Flat search results */}
      {filteredItems ? (
        <nav className="space-y-1 overflow-y-auto flex-1">
          {filteredItems.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">No results found</p>
          ) : (
            filteredItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })
          )}
        </nav>
      ) : (
        /* Collapsible sections */
        <nav className="space-y-1 overflow-y-auto flex-1">
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
                  <span className="flex-1 text-left">{section.label}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                  />
                </button>
                {isExpanded && (
                  <div className="ml-4 space-y-0.5">
                    {items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onNavClick}
                          className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <item.icon className="h-3.5 w-3.5" />
                          {item.label}
                        </Link>
                      );
                    })}
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
  const { hasFeature } = useClinicFeatures();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <h2 className="text-lg font-semibold mb-4">Doctor Dashboard</h2>
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
            <span className="font-semibold text-sm">Doctor Portal</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
                  <h2 className="text-lg font-semibold">Doctor Portal</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)}>
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

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
