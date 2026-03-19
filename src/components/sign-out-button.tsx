"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      Sign Out
    </button>
  );
}
