"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface ActivityListItem {
  id: string;
  content: string;
  meta: string;
  badge?: string;
  href?: string;
}

interface ActivityListProps {
  items: ActivityListItem[];
  maxItems?: number;
  ariaLabel?: string;
  className?: string;
}

export function ActivityList({
  items,
  maxItems = 10,
  ariaLabel = "Recent activity",
  className,
}: ActivityListProps) {
  const visible = items.slice(0, maxItems);

  return (
    <ul className={cn("divide-y", className)} aria-label={ariaLabel}>
      {visible.map((item) => {
        const content = (
          <div className="flex items-start justify-between gap-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <div className="min-w-0">
                <p className="text-start text-sm text-foreground">{item.content}</p>
                {item.badge && (
                  <p className="text-start text-xs text-muted-foreground">{item.badge}</p>
                )}
              </div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>
          </div>
        );

        return item.href ? (
          <li key={item.id}>
            <Link
              href={item.href}
              className="block transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {content}
            </Link>
          </li>
        ) : (
          <li key={item.id}>{content}</li>
        );
      })}
    </ul>
  );
}
