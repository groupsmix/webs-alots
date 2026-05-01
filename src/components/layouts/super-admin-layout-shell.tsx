"use client";

import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ToggleRight,
  FileText,
  Menu,
  Bell,
  ChevronDown,
  Shield,
  Settings,
  User,
  Megaphone,
  DollarSign,
  Receipt,
  UserPlus,
  Search,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { CommandPalette, type CommandPaletteItem } from "@/components/command-palette";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";
import { fetchClinics } from "@/lib/super-admin-actions";

const navItems = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/onboarding", label: "Client Onboarding", icon: UserPlus },
  { href: "/super-admin/clinics", label: "All Clinics", icon: Building2 },
  { href: "/super-admin/billing", label: "Billing", icon: CreditCard },
  { href: "/super-admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/super-admin/pricing", label: "Pricing & Tiers", icon: DollarSign },
  { href: "/super-admin/subscriptions", label: "Subscriptions", icon: Receipt },
  { href: "/super-admin/features", label: "Feature Toggles", icon: ToggleRight },
  { href: "/super-admin/templates", label: "Template Manager", icon: FileText },
];

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
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

export default function SuperAdminLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdItems, setCmdItems] = useState<CommandPaletteItem[]>([]);
  const mountedRef = useRef(true);

  // Build command palette items
  const buildCommandItems = useCallback(async () => {
    const items: CommandPaletteItem[] = [];

    // Navigation items
    navItems.forEach((nav) => {
      items.push({
        id: `nav-${nav.href}`,
        label: nav.label,
        description: `Go to ${nav.label}`,
        icon: <nav.icon className="h-4 w-4" />,
        badge: "Navigate",
        onSelect: () => router.push(nav.href),
      });
    });

    // Quick actions
    items.push({
      id: "action-create-clinic",
      label: "Create New Clinic",
      description: "Start the clinic onboarding wizard",
      icon: <Plus className="h-4 w-4" />,
      badge: "Action",
      onSelect: () => router.push("/super-admin/onboarding"),
    });
    items.push({
      id: "action-create-announcement",
      label: "Create Announcement",
      description: "Publish a new announcement",
      icon: <Megaphone className="h-4 w-4" />,
      badge: "Action",
      onSelect: () => router.push("/super-admin/announcements"),
    });

    // Fetch clinics for search
    try {
      const clinics = await fetchClinics();
      clinics.forEach((c) => {
        items.push({
          id: `clinic-${c.id}`,
          label: c.name,
          description: `${c.type} clinic`,
          icon: <Building2 className="h-4 w-4" />,
          badge: "Clinic",
          onSelect: () => router.push(`/super-admin/clinics`),
        });
      });
    } catch (err) {
      logger.warn("Failed to load clinics for command palette", { context: "super-admin-layout", error: err });
    }

    setCmdItems(items);
  }, [router]);

  // Ctrl+K shortcut
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

  // Load command items on mount
  useEffect(() => {
    buildCommandItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    async function loadNotifications() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mountedRef.current) return;

        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", user.id)
          .single();
        if (!profile || !mountedRef.current) return;

        const { data } = await supabase
          .from("notifications")
          .select("id, title, body, sent_at, is_read")
          .eq("user_id", profile.id)
          .order("sent_at", { ascending: false })
          .limit(10);

        if (data && mountedRef.current) {
          setNotifications(
            data.map((n) => {
              const sentAt = new Date(n.sent_at ?? Date.now());
              const diffMs = Date.now() - sentAt.getTime();
              const diffMin = Math.floor(diffMs / 60000);
              const diffHr = Math.floor(diffMin / 60);
              const diffDay = Math.floor(diffHr / 24);
              let time = "just now";
              if (diffDay > 0) time = `${diffDay}d ago`;
              else if (diffHr > 0) time = `${diffHr}h ago`;
              else if (diffMin > 0) time = `${diffMin}m ago`;

              return {
                id: n.id,
                title: n.title ?? "Notification",
                message: n.body ?? "",
                time,
                unread: !n.is_read,
              };
            }),
          );
        }
      } catch (err) {
        logger.warn("Failed to load notifications", { context: "super-admin-layout", error: err });
      }
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, 60_000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      <div className="flex flex-1">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 border-r bg-card p-4 md:flex md:flex-col">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Master Control</h2>
            <p className="text-[10px] text-muted-foreground">Super Admin Panel</p>
          </div>
        </div>

        <SidebarNav pathname={pathname} />

        <div className="mt-auto pt-6 border-t">
          <SignOutButton />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Command Palette Trigger */}
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search...</span>
            <kbd className="ml-2 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">Ctrl+K</kbd>
          </button>

          <div className="flex-1" />

          {/* Language Switcher */}
          <LocaleSwitcher />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="relative inline-flex items-center justify-center rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((notif) => (
                <DropdownMenuItem key={notif.id} className="flex flex-col items-start gap-1 py-2">
                  <div className="flex items-center gap-2 w-full">
                    <p className="text-sm font-medium">{notif.title}</p>
                    {notif.unread && <Badge variant="default" className="text-[9px] px-1 py-0 ml-auto">New</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground">{notif.time}</p>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex items-center gap-2 rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">SA</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm">Super Admin</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive p-0">
                <SignOutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="main-content" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" onClose={() => setMobileOpen(false)}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Master Control
            </SheetTitle>
          </SheetHeader>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard interaction handled by parent or child interactive element */}
          <div className="mt-6" onClick={() => setMobileOpen(false)}>
            <SidebarNav pathname={pathname} />
          </div>
        </SheetContent>
      </Sheet>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        items={cmdItems}
        placeholder="Search pages, clinics, or actions..."
      />
    </div>
  );
}
