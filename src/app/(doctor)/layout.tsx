"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Calendar, Pill, FileEdit, Clock,
  MessageCircle, CalendarClock, BarChart3, ClipboardList,
  FlaskConical, ShieldCheck, Camera, Package, CreditCard, Award,
  Heart, Ear, Bone, Brain, Activity, Wind, Droplets, Target,
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
