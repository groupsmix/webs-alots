"use client";

import { cn } from "@/lib/utils";
import { Grain } from "./components/primitives/grain";
import { Footer } from "./components/sections/footer";
import { PublicNav } from "./components/sections/public-nav";
import { LanguageProvider } from "./i18n/context";

export function OltigoPublicShell({
  children,
  mainClassName,
}: {
  children: React.ReactNode;
  mainClassName?: string;
}) {
  return (
    <LanguageProvider>
      <div className="oltigo-landing">
        <Grain />
        <PublicNav />
        <main className={cn("min-h-screen", mainClassName)}>{children}</main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}
