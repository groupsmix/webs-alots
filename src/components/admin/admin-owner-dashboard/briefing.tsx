"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { OwnerDailyBriefing } from "@/lib/data/admin-owner-dashboard";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { MOROCCO_LOCALE_MAP } from "@/lib/utils";

interface OwnerBriefingProps {
  briefing: OwnerDailyBriefing | null;
  locale: Locale;
}

const COLLAPSED_LENGTH = 360;

export function OwnerBriefing({ briefing, locale }: OwnerBriefingProps) {
  const [expanded, setExpanded] = useState(false);

  if (!briefing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            {t(locale, "admin.owner.aiBriefTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Sparkles}
            title={t(locale, "admin.owner.aiBriefEmpty")}
            description={t(locale, "admin.owner.aiBriefEmptyDesc")}
          />
        </CardContent>
      </Card>
    );
  }

  const dateLabel = new Intl.DateTimeFormat(MOROCCO_LOCALE_MAP[locale], {
    day: "numeric",
    month: "long",
  }).format(new Date(`${briefing.briefingDate}T12:00:00`));
  const isLong = briefing.content.length > COLLAPSED_LENGTH;
  const content =
    !expanded && isLong
      ? `${briefing.content.slice(0, COLLAPSED_LENGTH).trimEnd()}…`
      : briefing.content;

  return (
    <Card className="border-primary/15 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" />
              {t(locale, "admin.owner.aiBriefTitle")}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(locale, "admin.owner.aiBriefDate", { date: dateLabel })}
            </p>
          </div>
          <Badge variant="outline">{t(locale, "admin.owner.aiGenerated")}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p dir="auto" className="whitespace-pre-line text-sm leading-6 text-foreground/85">
          {content}
        </p>
        {isLong && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            className="mt-2 h-auto px-0"
          >
            {expanded
              ? t(locale, "admin.owner.aiBriefShowLess")
              : t(locale, "admin.owner.aiBriefShowMore")}
          </Button>
        )}
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          {t(locale, "admin.owner.aiBriefPrivacy")}
        </p>
      </CardContent>
    </Card>
  );
}
