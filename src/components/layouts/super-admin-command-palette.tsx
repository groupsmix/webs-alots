"use client";

import { Building2, Megaphone, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CommandPalette, type CommandPaletteItem } from "@/components/command-palette";
import { navItems } from "@/components/layouts/super-admin-nav-data";
import { logger } from "@/lib/logger";
import { fetchClinics } from "@/lib/super-admin-actions";

export function SuperAdminCommandPalette() {
  const router = useRouter();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdItems, setCmdItems] = useState<CommandPaletteItem[]>([]);

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
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        buildCommandItems();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
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
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        items={cmdItems}
        placeholder="Search pages, clinics, or actions..."
      />
    </>
  );
}
