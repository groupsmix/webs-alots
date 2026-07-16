import { Inbox, MessageSquarePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { fetchFeedback } from "@/lib/data/feedback";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { getLocaleFromTenant, getTenant } from "@/lib/tenant";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${
            star <= rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
          }`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

export default async function SuperAdminFeedbackPage() {
  const tenant = await getTenant();
  const locale = (getLocaleFromTenant(tenant) as Locale) ?? "fr";
  const items = await fetchFeedback();

  const title = t(locale, "help.adminTitle");
  const emptyText = t(locale, "help.adminEmpty");

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: title }]}
      />
      <div className="mb-6 flex items-center gap-2">
        <MessageSquarePlus className="h-5 w-5" />
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">{emptyText}</p>
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
                  {item.rating != null ? <StarRating rating={item.rating} /> : null}
                </div>
                <p className="whitespace-pre-wrap text-sm">{item.message}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {item.created_at && (
                    <span>{new Date(item.created_at).toLocaleString(locale)}</span>
                  )}
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
