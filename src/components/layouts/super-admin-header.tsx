"use client";

import { ChevronDown, Menu, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { SuperAdminCommandPalette } from "@/components/layouts/super-admin-command-palette";
import { SuperAdminNotificationBell } from "@/components/layouts/super-admin-notification-bell";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SuperAdminHeaderProps {
  onMenuOpen: () => void;
}

export function SuperAdminHeader({ onMenuOpen }: SuperAdminHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden"
        onClick={onMenuOpen}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <SuperAdminCommandPalette />

      <div className="flex-1" />

      <LocaleSwitcher />

      <ThemeToggle />

      <SuperAdminNotificationBell />

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
  );
}
