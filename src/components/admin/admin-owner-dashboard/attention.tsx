import { ArrowRight, CircleAlert, HeartPulse } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { OwnerAttentionItem } from "@/lib/admin-owner-dashboard";
import type { OwnerTodaySummary } from "@/lib/data/admin-owner-dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface OwnerAttentionProps {
  items: OwnerAttentionItem[];
  locale: Locale;
  noShowRate: number;
  averageRating: number;
  today: OwnerTodaySummary;
}

function getAttentionCopy(
  locale: Locale,
  item: OwnerAttentionItem,
  noShowRate: number,
  averageRating: number,
  today: OwnerTodaySummary,
) {
  switch (item.kind) {
    case "unconfirmedToday":
      return {
        title: t(locale, "admin.owner.unconfirmedAttention", {
          count: today.unconfirmedAppointments,
        }),
        description: t(locale, "admin.owner.unconfirmedAttentionDesc"),
        action: t(locale, "admin.owner.viewAgenda"),
      };
    case "waitingToday":
      return {
        title: t(locale, "admin.owner.waitingAttention", {
          count: today.checkedInAppointments,
        }),
        description: t(locale, "admin.owner.waitingAttentionDesc"),
        action: t(locale, "admin.owner.viewAgenda"),
      };
    case "noShowToday":
      return {
        title: t(locale, "admin.owner.todayNoShowAttention", {
          count: today.noShowAppointments,
        }),
        description: t(locale, "admin.owner.todayNoShowAttentionDesc"),
        action: t(locale, "admin.owner.viewAgenda"),
      };
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

export function OwnerAttention({
  items,
  locale,
  noShowRate,
  averageRating,
  today,
}: OwnerAttentionProps) {
  return (
    <section aria-labelledby="attention-title">
      <div className="mb-3">
        <h2 id="attention-title" className="text-lg font-semibold">
          {t(locale, "admin.owner.attention")}
        </h2>
        <p className="text-sm text-muted-foreground">{t(locale, "admin.owner.attentionDesc")}</p>
      </div>

      {items.length > 0 ? (
        (() => {
          const [primary, ...rest] = items;
          const primaryCopy = getAttentionCopy(locale, primary, noShowRate, averageRating, today);
          return (
            <div className="space-y-3">
              <Card
                className={`overflow-hidden border-2 ${
                  primary.tone === "danger" ? "border-destructive/40" : "border-primary/40"
                } bg-primary/5`}
              >
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                        primary.tone === "danger"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-[var(--signal-amber)]/10 text-[var(--signal-amber)]"
                      }`}
                    >
                      <CircleAlert className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold">{primaryCopy.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {primaryCopy.description}
                      </p>
                    </div>
                  </div>
                  <Link href={primary.href} className="shrink-0">
                    <Button
                      size="lg"
                      variant={primary.tone === "danger" ? "destructive" : "default"}
                    >
                      {primaryCopy.action}
                      <ArrowRight className="h-4 w-4 ms-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {rest.length > 0 && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {rest.map((item) => {
                    const copy = getAttentionCopy(locale, item, noShowRate, averageRating, today);
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
                              <p className="mt-1 text-sm text-muted-foreground">
                                {copy.description}
                              </p>
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
              )}
            </div>
          );
        })()
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
