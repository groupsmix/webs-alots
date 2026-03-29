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
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { useClinicFeatures, SPECIALTY_FEATURES } from "@/lib/hooks/use-clinic-features";
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
  { href: "/doctor/dermatology", label: "Dermatology", icon: Camera, requiredFeature: "dermatology" },
  { href: "/doctor/cardiology", label: "Cardiology", icon: Heart, requiredFeature: "cardiology" },
  { href: "/doctor/ent", label: "ENT", icon: Ear, requiredFeature: "ent" },
  { href: "/doctor/orthopedics", label: "Orthopedics", icon: Bone, requiredFeature: "orthopedics" },
  { href: "/doctor/psychiatry", label: "Psychiatry", icon: Brain, requiredFeature: "psychiatry" },
  { href: "/doctor/neurology", label: "Neurology", icon: Activity, requiredFeature: "neurology" },
  { href: "/doctor/urology", label: "Urology", icon: ClipboardList, requiredFeature: "urology" },
  { href: "/doctor/pulmonology", label: "Pulmonology", icon: Wind, requiredFeature: "pulmonology" },
  { href: "/doctor/endocrinology", label: "Endocrinology", icon: Droplets, requiredFeature: "endocrinology" },
  { href: "/doctor/rheumatology", label: "Rheumatology", icon: Target, requiredFeature: "rheumatology" },
  // Pediatrician
  { href: "/doctor/growth-charts", label: "Growth Charts", icon: Ruler, requiredFeature: "growth_charts" },
  { href: "/doctor/vaccinations", label: "Vaccinations", icon: Syringe, requiredFeature: "vaccination" },
  { href: "/doctor/child-info", label: "Child Development", icon: Baby, requiredFeature: "growth_charts" },
  // Gynecologist
  { href: "/doctor/pregnancies", label: "Pregnancy Tracking", icon: Heart, requiredFeature: "pregnancy_tracking" },
  { href: "/doctor/ultrasounds", label: "Ultrasound Records", icon: Image, requiredFeature: "ultrasound_records" },
  // Ophthalmologist
  { href: "/doctor/vision-tests", label: "Vision Tests", icon: Eye, requiredFeature: "vision_tests" },
  { href: "/doctor/iop-tracking", label: "IOP Tracking", icon: Activity, requiredFeature: "iop_tracking" },
];

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { hasFeature } = useClinicFeatures();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  const visibleItems = navItems.filter((item) => {
    // If a specialty is selected, filter by specialty
    if (selectedSpecialty) {
      const specialtyFeatures = SPECIALTY_FEATURES[selectedSpecialty.toLowerCase()];
      if (specialtyFeatures && specialtyFeatures.length > 0) {
        // If the feature is not in the specialty list, don't show it
        if (item.requiredFeature && !specialtyFeatures.includes(item.requiredFeature)) {
          return false;
        }
      }
    }
    // Also check clinic features config
    return !item.requiredFeature || hasFeature(item.requiredFeature);
  });

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-card p-4 md:block">
        <h2 className="text-lg font-semibold mb-4">Doctor Dashboard</h2>
        
        {/* Specialty Filter */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">
            Filter by Specialty
          </label>
          <select
            className="w-full text-sm border rounded-md p-2 bg-background"
            value={selectedSpecialty ?? ""}
            onChange={(e) => setSelectedSpecialty(e.target.value || null)}
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
