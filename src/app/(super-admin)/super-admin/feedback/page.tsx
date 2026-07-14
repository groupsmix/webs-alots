"use client";

import { MessageSquarePlus, Star, Loader2, Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";

interface FeedbackItem {
  id: string;
  clinic_id: string | null;
  role: string | null;
  rating: number | null;
  message: string;
  page_url: string | null;
  status: string;
  created_at: string | null;
}

export default function SuperAdminFeedbackPage() {
  const [locale] = useLocale();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json?.data?.feedback ?? []);
    } catch (err) {
      logger.warn("Failed to load feedback", { context: "super-admin/feedback", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fetch on mount; setState only runs after the await resolves
    void load();
  }, [load]);

  const title = t(locale, "help.adminTitle");

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: title }]}
      />
      <div className="mb-6 flex items-center gap-2">
        <MessageSquarePlus className="h-5 w-5" />
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t(locale, "help.adminLoading")}
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">{t(locale, "help.adminEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.role && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {item.role.replace("_", " ")}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {item.status}
                    </Badge>
                  </div>
                  {item.rating ? (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= (item.rating ?? 0)
                              ? "fill-yellow-500 text-yellow-500"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm">{item.message}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {item.created_at && <span>{new Date(item.created_at).toLocaleString()}</span>}
                  {item.page_url && <span className="truncate">{item.page_url}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
