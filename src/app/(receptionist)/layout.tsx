"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, Users, Clock, CalendarDays, CreditCard, FileText,
  Menu, X, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";
import { signOut } from "@/lib/auth";
import { CommandPalette, CommandIcons, type CommandPaletteItem } from "@/components/command-palette";
import { usePatientSearch } from "@/lib/hooks/use-patient-search";

const navItems = [
  { href: "/receptionist/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/receptionist/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/receptionist/patients", label: "Patients", icon: Users },
  { href: "/receptionist/waiting-room", label: "Waiting Room", icon: Clock },
  { href: "/receptionist/payments", label: "Payments", icon: CreditCard },
  { href: "/receptionist/daily-report", label: "Daily Report", icon: FileText },
];

function NavLinks({
  pathname,
  onNavClick,
}: {
  pathname: string;
  onNavClick?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavClick}
            aria-current={isActive ? "page" : undefined}
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
  );
}

export default function ReceptionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const patients = usePatientSearch();

  // Ctrl+K shortcut to open command palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const cmdItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [];
    patients.forEach((p) => {
      items.push({
        id: `patient-${p.id}`,
        label: p.name,
        description: p.phone,
        icon: CommandIcons.patient,
        badge: p.insurance ?? undefined,
        onSelect: () => router.push("/receptionist/patients"),
      });
    });
    return items;
  }, [patients, router]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 border-r bg-card p-4 md:block">
        <h2 className="text-lg font-semibold mb-6">Reception Panel</h2>
        <NavLinks pathname={pathname} />
        <div className="mt-auto pt-6 border-t mt-6">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b p-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <ClipboardList className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">Reception Panel</span>
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
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-card p-4 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold">Reception Panel</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <NavLinks pathname={pathname} onNavClick={() => setMobileMenuOpen(false)} />
              <div className="mt-6 pt-4 border-t">
                <SignOutButton />
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <SessionTimeoutWarning onLogout={() => signOut()} />
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        items={cmdItems}
      />
    </div>
  );
}
