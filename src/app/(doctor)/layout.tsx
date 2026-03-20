"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Calendar, Pill, FileEdit, Clock,
  MessageCircle, CalendarClock, BarChart3, ClipboardList,
  FlaskConical, ShieldCheck, Camera, Package, CreditCard, Award,
  Building2, FileCheck, Sparkles, HeartHandshake, Droplets, Monitor, Boxes, FileText,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { useClinicFeatures } from "@/lib/hooks/use-clinic-features";
import type { ClinicFeatureKey } from "@/lib/features";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredFeature?: ClinicFeatureKey;
}

const navItems: NavItem[] = [
  { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctor/patients", label: "My Patients", icon: Users },
  { href: "/doctor/schedule", label: "Schedule", icon: Calendar, requiredFeature: "appointments" },
  { href: "/doctor/prescriptions", label: "Prescriptions", icon: Pill, requiredFeature: "prescriptions" },
  { href: "/doctor/consultation", label: "Consultation Notes", icon: FileEdit, requiredFeature: "consultations" },
  { href: "/doctor/waiting-room", label: "Waiting Room", icon: Clock, requiredFeature: "appointments" },
  { href: "/doctor/slots", label: "Available Slots", icon: CalendarClock, requiredFeature: "appointments" },
  { href: "/doctor/chat", label: "Chat", icon: MessageCircle },
  { href: "/doctor/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/doctor/odontogram", label: "Odontogram", icon: ClipboardList, requiredFeature: "odontogram" },
  { href: "/doctor/treatment-plans", label: "Treatment Plans", icon: ClipboardList, requiredFeature: "odontogram" },
  { href: "/doctor/lab-orders", label: "Lab Orders", icon: FlaskConical, requiredFeature: "lab_results" },
  { href: "/doctor/certificates", label: "Certificates", icon: Award, requiredFeature: "certificates" },
  { href: "/doctor/sterilization", label: "Sterilization Log", icon: ShieldCheck, requiredFeature: "sterilization_log" },
  { href: "/doctor/before-after", label: "Before/After", icon: Camera, requiredFeature: "before_after_photos" },
  { href: "/doctor/stock", label: "Material Stock", icon: Package, requiredFeature: "stock" },
  { href: "/doctor/installments", label: "Installments", icon: CreditCard, requiredFeature: "installments" },
  // Phase 6: Clinics & Centers
  { href: "/doctor/departments", label: "Departments", icon: Building2, requiredFeature: "departments" },
  { href: "/doctor/consent-forms", label: "Consent Forms", icon: FileCheck, requiredFeature: "consent_forms" },
  { href: "/doctor/treatment-packages", label: "Treatment Packages", icon: Sparkles, requiredFeature: "treatment_packages" },
  { href: "/doctor/consultation-photos", label: "Consultation Photos", icon: Camera, requiredFeature: "consultation_photos" },
  { href: "/doctor/ivf-cycles", label: "IVF Cycles", icon: HeartHandshake, requiredFeature: "ivf_cycles" },
  { href: "/doctor/ivf-protocols", label: "IVF Protocols", icon: ClipboardList, requiredFeature: "ivf_protocols" },
  { href: "/doctor/dialysis-sessions", label: "Dialysis Sessions", icon: Droplets, requiredFeature: "dialysis_sessions" },
  { href: "/doctor/dialysis-machines", label: "Dialysis Machines", icon: Monitor, requiredFeature: "dialysis_machines" },
  { href: "/doctor/prosthetic-orders", label: "Prosthetic Orders", icon: Package, requiredFeature: "prosthetic_orders" },
  { href: "/doctor/lab-materials", label: "Lab Materials", icon: Boxes, requiredFeature: "lab_materials" },
  { href: "/doctor/lab-invoices", label: "Lab Invoices", icon: FileText, requiredFeature: "lab_invoices" },
];

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { hasFeature } = useClinicFeatures();

  const visibleItems = navItems.filter(
    (item) => !item.requiredFeature || hasFeature(item.requiredFeature),
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-card p-4 md:block">
        <h2 className="text-lg font-semibold mb-6">Doctor Dashboard</h2>
        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
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
          })}
        </nav>
        <div className="mt-auto pt-6 border-t mt-6">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
