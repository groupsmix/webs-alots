"use client";

import { MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Z_INDEX } from "@/lib/z-index";

export interface MobileTabItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface MobileTabBarProps {
  /** Primary tabs to show (max 4 recommended, 5th slot used for "More") */
  tabs: MobileTabItem[];
  /** Additional items shown when "More" is tapped */
  moreTabs?: MobileTabItem[];
  /** Accent color class for active tab (e.g. "text-primary") */
  activeColor?: string;
  /** Callback when "More" is tapped — typically opens sidebar/drawer */
  onMoreClick?: () => void;
}

/** Trigger haptic feedback if supported by the device */
function triggerHaptic(): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  } catch {
    // Haptic feedback is optional — silently ignore errors
  }
}

/**
 * MobileTabBar
 *
 * Fixed bottom tab bar for mobile viewports (hidden on md+).
 * Replaces the side drawer navigation on small screens.
 */
export function MobileTabBar({
  tabs,
  activeColor = "text-primary",
  onMoreClick,
}: MobileTabBarProps) {
  const pathname = usePathname();

  /** Check if a tab is active (exact or prefix match) */
  const isActive = (href: string): boolean => {
    if (pathname === href) return true;
    // Match sub-routes (e.g. /doctor/patients/123 matches /doctor/patients)
    if (href !== "/" && pathname.startsWith(href + "/")) return true;
    return false;
  };

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 ${Z_INDEX.mobileTabBar} border-t bg-card md:hidden`}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const TabIcon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => triggerHaptic()}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors ${
                active
                  ? `${activeColor} font-medium`
                  : "text-muted-foreground"
              }`}
            >
              <TabIcon className="h-5 w-5" />
              <span className="leading-tight">{tab.label}</span>
            </Link>
          );
        })}

        {/* "More" tab — opens full navigation */}
        {onMoreClick && (
          <button
            onClick={() => {
              triggerHaptic();
              onMoreClick();
            }}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-muted-foreground transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="leading-tight">Plus</span>
          </button>
        )}
      </div>

      {/* Safe area padding for devices with home indicator (e.g. iPhone) */}
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
}
