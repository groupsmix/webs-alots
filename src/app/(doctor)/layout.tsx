"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Calendar, Pill, FileEdit, Clock, MessageCircle, CalendarClock } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

const navItems = [
  { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctor/patients", label: "My Patients", icon: Users },
  { href: "/doctor/schedule", label: "Schedule", icon: Calendar },
  { href: "/doctor/prescriptions", label: "Prescriptions", icon: Pill },
  { href: "/doctor/consultation", label: "Consultation Notes", icon: FileEdit },
  { href: "/doctor/waiting-room", label: "Waiting Room", icon: Clock },
  { href: "/doctor/slots", label: "Available Slots", icon: CalendarClock },
  { href: "/doctor/chat", label: "Chat", icon: MessageCircle },
];

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-card p-4 md:block">
        <h2 className="text-lg font-semibold mb-6">Doctor Dashboard</h2>
        <nav className="space-y-1">
          {navItems.map((item) => {
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
