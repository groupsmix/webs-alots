import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { clinicConfig } from "@/config/clinic.config";

export default function NotFound() {
  const locale: Locale = (clinicConfig.locale as Locale) ?? "fr";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-6xl font-bold text-muted-foreground">404</p>
        <h1 className="mt-4 text-xl font-semibold">
          {t(locale, "notFound.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(locale, "notFound.description")}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t(locale, "notFound.backHome")}
        </Link>
      </div>
    </div>
  );
}
