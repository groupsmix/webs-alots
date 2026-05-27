"use client";

import { useEffect, useState } from "react";
import { LandingLocaleProvider } from "../landing-locale-provider";
import { EditorialFooter } from "./editorial-footer";
import { EditorialNav } from "./editorial-nav";

/**
 * Shell for editorial subpages (pricing, about, contact, etc.)
 * that live on the root domain. Provides nav + footer + theme.
 */
export function EditorialPageShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("oltigo-theme") as "light" | "dark" | null;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("oltigo-theme")) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <LandingLocaleProvider>
      <div
        data-theme={theme}
        className="flex min-h-screen flex-col"
        style={{
          backgroundColor: "var(--bone)",
          color: "var(--ink)",
          fontFamily: "var(--font-sans-landing)",
        }}
      >
        <EditorialNav />
        <main className="flex-1">{children}</main>
        <EditorialFooter />
      </div>
    </LandingLocaleProvider>
  );
}
