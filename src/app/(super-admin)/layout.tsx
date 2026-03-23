"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase-client";

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

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", user.id)
          .single();
        if (!profile) return;

        const { data } = await supabase
          .from("notifications")
          .select("id, title, body, sent_at, is_read")
          .eq("user_id", profile.id)
          .order("sent_at", { ascending: false })
          .limit(10);

        if (data) {
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
      } catch {
        // Notifications are non-critical; fail silently
      }
    }
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="flex min-h-screen">
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

          <div className="flex-1" />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>
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
            <DropdownMenuTrigger>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">SA</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm">Super Admin</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
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

        <main className="flex-1 p-4 md:p-6">
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
          <div className="mt-6" onClick={() => setMobileOpen(false)}>
            <SidebarNav pathname={pathname} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
