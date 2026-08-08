"use client";

import { AttentionCard } from "@/components/dashboard/attention-card";
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
          const secondary = rest.slice(0, 2);
          const primaryCopy = getAttentionCopy(locale, primary, noShowRate, averageRating, today);
          return (
            <div className="space-y-3">
              <AttentionCard
                tone={primary.tone === "danger" ? "danger" : "warning"}
                title={primaryCopy.title}
                description={primaryCopy.description}
                action={{ label: primaryCopy.action, href: primary.href }}
              />
              {secondary.length > 0 && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {secondary.map((item) => {
                    const copy = getAttentionCopy(locale, item, noShowRate, averageRating, today);
                    return (
                      <AttentionCard
                        key={item.kind}
                        tone={item.tone === "danger" ? "danger" : "warning"}
                        title={copy.title}
                        description={copy.description}
                        action={{ label: copy.action, href: item.href }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <AttentionCard
          tone="success"
          title={t(locale, "admin.owner.allGood")}
          description={t(locale, "admin.owner.allGoodDesc")}
          action={{ label: t(locale, "admin.owner.viewAgenda"), href: "/admin/agenda" }}
        />
      )}
    </section>
  );
}
