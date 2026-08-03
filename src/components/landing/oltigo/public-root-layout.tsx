"use client";

import { usePathname } from "next/navigation";
import { OltigoPublicShell } from "./public-shell";

const DARK_PATHS = new Set(["/pricing", "/privacy", "/terms", "/api-docs", "/services"]);
const DARK_PREFIXES = ["/features/"];

function isDarkPath(pathname: string): boolean {
  if (DARK_PATHS.has(pathname)) return true;
  return DARK_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Client gate for root-domain public pages.
 *
 * - Home (`/`) keeps its self-contained landing shell.
 * - Marketing-dark pages render directly inside `OltigoPublicShell`.
 * - All other public pages get a light reset container so the default
 *   shadcn/ui palette remains readable on the dark landing canvas.
 */
export function PublicRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  if (pathname === "/") {
    return <>{children}</>;
  }

  if (isDarkPath(pathname)) {
    return <OltigoPublicShell mainClassName="pt-16">{children}</OltigoPublicShell>;
  }

  return (
    <OltigoPublicShell>
      <div className="min-h-screen bg-background pt-16" style={{ color: "var(--foreground)" }}>
        {children}
      </div>
    </OltigoPublicShell>
  );
}
