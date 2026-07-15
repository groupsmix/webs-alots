"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { navGroups } from "@/components/layouts/super-admin-nav-data";
import { SuperAdminSupportBadge } from "@/components/layouts/super-admin-support-badge";

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

interface SuperAdminSidebarNavProps {
  pathname: string;
}

export function SuperAdminSidebarNav({ pathname }: SuperAdminSidebarNavProps) {
  // B1 (hydration): seed with the SSR-stable default (all groups expanded) so
  // the first client render matches the server. localStorage is unavailable
  // during SSR, so reading it in the useState initializer makes the initial
  // client render diverge from the server markup and triggers React hydration
  // error #418. The persisted state is applied after mount instead.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(navGroups.map((g) => g.key)),
  );

  useEffect(() => {
    // Mount-only: apply persisted expand/collapse state after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedGroups(getExpandedGroups());
  }, []);

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
                          prefetch={false}
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
                                  prefetch={false}
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
                      prefetch={false}
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
