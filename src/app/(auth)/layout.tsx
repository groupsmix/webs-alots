import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { t, type Locale } from "@/lib/i18n";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // I18N-01: Server component — read locale from cookie or default to "fr".
  // The auth layout is a server component so we cannot use the useLocale hook.
  const locale: Locale = "fr";

  return (
    <div className="min-h-screen bg-muted/50">
      <a
        href="#auth-form"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        {t(locale, "nav.skipToForm")}
      </a>
      <header className="border-b bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t(locale, "nav.backToHome")}
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div id="auth-form" className="flex items-center justify-center p-4 pt-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
