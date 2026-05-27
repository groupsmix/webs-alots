import { headers } from "next/headers";
import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

export default async function NotFound() {
  // AUDIT FINDING #2 / #11: Read locale from the x-tenant-locale header
  // set by middleware instead of hardcoding "fr". Falls back to "fr" when
  // the header is absent (e.g. root-domain 404, no clinic resolved).
  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";

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
