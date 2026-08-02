"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Accordion } from "@/components/landing/oltigo/components/ui/accordion";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-kit";

export function Faq() {
  const { dict } = useI18n();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dict.faq.items;
    return dict.faq.items.filter(
      (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
    );
  }, [dict.faq.items, query]);

  return (
    <section id="faq" className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading eyebrow={dict.faq.eyebrow} title={dict.faq.title} />
        <div className="lg:pt-2">
          <div className="relative mb-6">
            <Search
              className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.faq.searchPlaceholder}
              aria-label={dict.faq.searchPlaceholder}
              className={cn(
                "w-full rounded-xl border border-hairline bg-surface/40 py-2.5 pe-4 text-[14px] text-text placeholder:text-text-muted focus:border-emerald/50 focus:outline-none focus:ring-2 focus:ring-emerald/20",
                "ps-10",
              )}
            />
          </div>
          {filtered.length > 0 ? (
            <Accordion key={query} items={filtered} />
          ) : (
            <p className="text-[14px] text-text-secondary">{dict.faq.noResults}</p>
          )}
        </div>
      </div>
    </section>
  );
}
