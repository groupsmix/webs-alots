import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

// 403 page is never something we want indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * 403 — Access denied.
 *
 * Several server components (e.g. the super-admin AI Builder) call
 * `redirect("/unauthorized")` when a role check fails. Before this page
 * existed, that redirect resolved to a non-existent route and rendered a
 * confusing 404. This gives those redirects a proper destination.
 *
 * Mirrors the locale handling of the root `not-found.tsx`: the active locale
 * is read from the `x-tenant-locale` header set by middleware, falling back
 * to French.
 */
export default async function UnauthorizedPage() {
  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-6xl font-bold text-muted-foreground">403</p>
        <h1 className="mt-4 text-xl font-semibold">{t(locale, "unauthorized.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(locale, "unauthorized.description")}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t(locale, "notFound.backHome")}
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t(locale, "auth.signIn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
