import { CircleAlert, HeartPulse } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { OwnerAttentionItem } from "@/lib/admin-owner-dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface OwnerAttentionProps {
  items: OwnerAttentionItem[];
  locale: Locale;
  noShowRate: number;
  averageRating: number;
}

function getAttentionCopy(
  locale: Locale,
  item: OwnerAttentionItem,
  noShowRate: number,
  averageRating: number,
) {
  switch (item.kind) {
    case "missingDoctor":
      return {
        title: t(locale, "admin.owner.addFirstDoctor"),
        description: t(locale, "admin.owner.addFirstDoctorDesc"),
        action: t(locale, "admin.owner.takeAction"),
      };
    case "missingPatient":
      return {
        title: t(locale, "admin.owner.addFirstPatient"),
        description: t(locale, "admin.owner.addFirstPatientDesc"),
        action: t(locale, "admin.owner.takeAction"),
      };
    case "noShowRate":
      return {
        title: t(locale, "admin.owner.noShowAttention", { rate: noShowRate }),
        description: t(locale, "admin.owner.noShowAttentionDesc"),
        action: t(locale, "admin.owner.viewPerformance"),
      };
    case "lowRating":
      return {
        title: t(locale, "admin.owner.ratingAttention", {
          rating: averageRating.toFixed(1),
        }),
        description: t(locale, "admin.owner.ratingAttentionDesc"),
        action: t(locale, "admin.owner.viewReviews"),
      };
  }
}

export function OwnerAttention({ items, locale, noShowRate, averageRating }: OwnerAttentionProps) {
  return (
    <section aria-labelledby="attention-title">
      <div className="mb-3">
        <h2 id="attention-title" className="text-lg font-semibold">
          {t(locale, "admin.owner.attention")}
        </h2>
        <p className="text-sm text-muted-foreground">{t(locale, "admin.owner.attentionDesc")}</p>
      </div>

      {items.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const copy = getAttentionCopy(locale, item, noShowRate, averageRating);
            return (
              <Card key={item.kind} className="overflow-hidden">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        item.tone === "danger"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-[var(--signal-amber)]/10 text-[var(--signal-amber)]"
                      }`}
                    >
                      <CircleAlert className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{copy.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
                    </div>
                  </div>
                  <Link
                    href={item.href}
                    className="self-start rounded-lg border px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    {copy.action}
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-[var(--signal-green)]/20 bg-[var(--signal-green)]/5">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--signal-green)]/10 text-[var(--signal-green)]">
              <HeartPulse className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">{t(locale, "admin.owner.allGood")}</p>
              <p className="text-sm text-muted-foreground">
                {t(locale, "admin.owner.allGoodDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
