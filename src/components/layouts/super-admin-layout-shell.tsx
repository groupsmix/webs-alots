"use client";
/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */

import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ToggleLeft,
  ToggleRight,
  FileText,
  LifeBuoy,
  Menu,
  Shield,
  Scale,
  Bell,
  ChevronDown,
  Settings,
  User,
  Megaphone,
  DollarSign,
  Receipt,
  UserPlus,
  Search,
  Plus,
  BarChart3,
  TrendingUp,
  Bot,
  CheckCheck,
  Info,
  AlertTriangle,
  CheckCircle,
  Users,
  Activity,
  Wand2,
  Store,
  Gift,
  Gauge,
  GitCompareArrows,
  MessageSquare,
  Sparkles,
  HeartPulse,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { OltigoMonogram } from "@/components/brand/oltigo-mark";
import { CommandPalette, type CommandPaletteItem } from "@/components/command-palette";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { MobileTabBar } from "@/components/layouts/mobile-tab-bar";
import type { MobileTabItem } from "@/components/layouts/mobile-tab-bar";
import { SuperAdminSupportBadge } from "@/components/layouts/super-admin-support-badge";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
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

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  children?: { href: string; label: string; icon: typeof LayoutDashboard }[];
}

interface NavGroup {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/super-admin/analytics",
        label: "Analytics",
        icon: BarChart3,
        children: [
          { href: "/super-admin/analytics", label: "Overview", icon: BarChart3 },
          {
            href: "/super-admin/analytics/compare",
            label: "Clinic Comparison",
            icon: GitCompareArrows,
          },
          { href: "/super-admin/analytics/churn", label: "Churn Detection", icon: AlertTriangle },
        ],
      },
    ],
  },
  {
    key: "clinics",
    label: "Clinics",
    icon: Building2,
    items: [
      { href: "/super-admin/clinics", label: "All Clinics", icon: Building2 },
      { href: "/super-admin/onboarding", label: "Client Onboarding", icon: UserPlus },
      { href: "/super-admin/team", label: "Team", icon: Users },
    ],
  },
  {
    key: "revenue",
    label: "Revenue",
    icon: CreditCard,
    items: [
      {
        href: "/super-admin/billing",
        label: "Billing",
        icon: CreditCard,
        children: [
          {
            href: "/super-admin/billing/revenue",
            label: "Revenue Overview",
            icon: TrendingUp,
          },
          {
            href: "/super-admin/billing/forecast",
            label: "Forecast",
            icon: BarChart3,
          },
        ],
      },
      { href: "/super-admin/pricing", label: "Pricing & Tiers", icon: DollarSign },
      { href: "/super-admin/subscriptions", label: "Subscriptions", icon: Receipt },
      { href: "/super-admin/referrals", label: "Medical Referrals", icon: Gift },
      { href: "/super-admin/referral-program", label: "Referral Program", icon: Gift },
      { href: "/super-admin/usage", label: "Usage Metrics", icon: Gauge },
      { href: "/super-admin/usage-dashboard", label: "Usage Dashboard", icon: BarChart3 },
    ],
  },
  {
    key: "content",
    label: "Content",
    icon: FileText,
    items: [
      { href: "/super-admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/super-admin/templates", label: "Template Manager", icon: FileText },
      { href: "/super-admin/features", label: "Feature Toggles", icon: ToggleRight },
      { href: "/super-admin/feature-flags", label: "Feature Flags", icon: ToggleLeft },
    ],
  },
  // Intelligence (AI features) — always rendered post-launch (was env-gated previously).
  {
    key: "intelligence",
    label: "Intelligence",
    icon: Bot,
    items: [
      { href: "/super-admin/builder", label: "AI Builder", icon: Sparkles },
      { href: "/super-admin/agents", label: "AI Agents", icon: Bot },
      { href: "/super-admin/ai-team", label: "AI Team", icon: MessageSquare },
      { href: "/super-admin/agent-builder", label: "Website Builder", icon: Wand2 },
      { href: "/super-admin/marketplace", label: "Marketplace", icon: Store },
      { href: "/super-admin/settings/ai", label: "AI Settings", icon: Settings },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    icon: Activity,
    items: [
      { href: "/super-admin/system", label: "System Status", icon: Activity },
      { href: "/super-admin/system/health", label: "Health Metrics", icon: HeartPulse },
      { href: "/super-admin/system/sla", label: "Uptime SLA", icon: Shield },
      { href: "/super-admin/compliance", label: "Compliance", icon: Scale },
      { href: "/super-admin/support", label: "Support", icon: LifeBuoy },
    ],
  },
];

const navItems = navGroups.flatMap((g) => g.items);

type NotificationType = "info" | "warning" | "success";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: NotificationType;
}

const NOTIF_READ_KEY = "oltigo-sa-notif-read";

function getReadNotifIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIF_READ_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadNotifIds(ids: Set<string>): void {
  try {
    localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage may be unavailable
  }
}

const NAV_GROUP_KEY = "oltigo-sa-nav-expanded";

function getExpandedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(NAV_GROUP_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // localStorage may be unavailable
  }
  return new Set(navGroups.map((g) => g.key));
}

function saveExpandedGroups(keys: Set<string>): void {
  try {
    localStorage.setItem(NAV_GROUP_KEY, JSON.stringify([...keys]));
  } catch {
    // localStorage may be unavailable
  }
}

const FALLBACK_NOTIFICATIONS: Notification[] = [
  {
    id: "mock-1",
    title: "New clinic registered: Devin Test Clinic",
    message: "A new clinic has been onboarded and is awaiting configuration.",
    time: "2m ago",
    unread: true,
    type: "info",
  },
  {
    id: "mock-2",
    title: "1 subscription suspended: VqfatzgAG",
    message: "Subscription suspended due to overdue payment.",
    time: "1h ago",
    unread: true,
    type: "warning",
  },
  {
    id: "mock-3",
    title: "System update deployed successfully",
    message: "Platform v2.4.1 has been deployed to all regions.",
    time: "3h ago",
    unread: true,
    type: "success",
  },
];

const notifTypeIcon: Record<NotificationType, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
};

const notifTypeColor: Record<NotificationType, string> = {
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-500 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
};

function SidebarNav({ pathname }: { pathname: string }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => getExpandedGroups());

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      saveExpandedGroups(next);
      return next;
    });
  }, []);

  return (
    <nav className="space-y-2 overflow-y-auto flex-1">
      {navGroups.map((group) => {
        const isExpanded = expandedGroups.has(group.key);
        return (
          <div key={group.key}>
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              aria-expanded={isExpanded}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <group.icon className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  isExpanded ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>
            {isExpanded && (
              <div className="mt-0.5 space-y-0.5">
                {group.items.map((item) => {
                  // Determine if this item has sibling nav entries that share
                  // the same path prefix (e.g. /super-admin/system has siblings
                  // /super-admin/system/health and /super-admin/system/sla). In
                  // that case, use exact match only to avoid the parent item
                  // stealing the active state from its children.
                  const hasSiblingSubItems = group.items.some(
                    (sibling) =>
                      sibling.href !== item.href && sibling.href.startsWith(item.href + "/"),
                  );
                  const isActive = hasSiblingSubItems
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");

                  if (item.children) {
                    return (
                      <div key={item.href} className="space-y-0.5">
                        <Link
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
                        {isActive && (
                          <div className="ml-4 border-l pl-3 space-y-0.5">
                            {item.children.map((child) => {
                              const childActive = pathname === child.href;
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  aria-current={childActive ? "page" : undefined}
                                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                                    childActive
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  }`}
                                >
                                  <child.icon className="h-3.5 w-3.5" />
                                  {child.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const isSupport = item.href === "/super-admin/support";
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
                      <span className="flex-1">{item.label}</span>
                      {isSupport && <SuperAdminSupportBadge />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default function SuperAdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdItems, setCmdItems] = useState<CommandPaletteItem[]>([]);

  const superAdminMobileTabs: MobileTabItem[] = [
    { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/super-admin/clinics", label: "Clinics", icon: Building2 },
    { href: "/super-admin/billing", label: "Billing", icon: CreditCard },
    { href: "/super-admin/subscriptions", label: "Subs", icon: Receipt },
  ];
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
          onSelect: () => router.push(`/super-admin/clinics/${c.id}`),
        });
      });
    } catch (err) {
      logger.warn("Failed to load clinics for command palette", {
        context: "super-admin-layout",
        error: err,
      });
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
    // Q-49: Mount-only effect — `buildCommandItems` reads route metadata
    // that never changes during the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const allIds = new Set(prev.map((n) => n.id));
      saveReadNotifIds(allIds);
      return prev.map((n) => ({ ...n, unread: false }));
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    async function loadNotifications() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
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

        if (!mountedRef.current) return;

        const readIds = getReadNotifIds();

        if (data && data.length > 0) {
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
                unread: readIds.has(n.id) ? false : !n.is_read,
                type: "info" as NotificationType,
              };
            }),
          );
        } else {
          setNotifications(
            FALLBACK_NOTIFICATIONS.map((n) => ({
              ...n,
              unread: !readIds.has(n.id),
            })),
          );
        }
      } catch (err) {
        logger.warn("Failed to load notifications", { context: "super-admin-layout", error: err });
        const readIds = getReadNotifIds();
        setNotifications(
          FALLBACK_NOTIFICATIONS.map((n) => ({
            ...n,
            unread: !readIds.has(n.id),
          })),
        );
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
            <OltigoMonogram size="sm" />
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
              aria-label="Open menu"
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
              <span>Rechercher...</span>
              <kbd className="ml-2 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                Ctrl+K
              </kbd>
            </button>

            <div className="flex-1" />

            {/* Language Switcher */}
            <LocaleSwitcher />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex items-center justify-center rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                  {}
                  <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <CheckCheck className="h-3 w-3" />
                      {"Mark all as read"}
                    </button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {"No notifications"}
                  </div>
                )}
                {notifications.map((notif) => {
                  const NotifIcon = notifTypeIcon[notif.type] ?? Info;
                  return (
                    <DropdownMenuItem key={notif.id} className="flex items-start gap-2 py-2">
                      <NotifIcon
                        className={`h-4 w-4 mt-0.5 shrink-0 ${notifTypeColor[notif.type] ?? "text-muted-foreground"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{notif.title}</p>
                          {notif.unread && (
                            <Badge variant="default" className="text-[9px] px-1 py-0 shrink-0">
                              {"New"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground">{notif.time}</p>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-center">
                  <Link
                    href="/super-admin/clinics"
                    className="text-xs text-primary hover:underline"
                  >
                    {"View all notifications"}
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
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
                <DropdownMenuItem onClick={() => router.push("/super-admin/profile")}>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/super-admin/settings")}>
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

          <main id="main-content" className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
            {children}
          </main>
        </div>

        {/* Mobile bottom tab bar */}
        <MobileTabBar tabs={superAdminMobileTabs} onMoreClick={() => setMobileOpen(true)} />

        {/* Mobile Sidebar Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" onClose={() => setMobileOpen(false)}>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <OltigoMonogram size="sm" />
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
