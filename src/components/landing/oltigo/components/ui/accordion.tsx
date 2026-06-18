"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { q: string; a: string };

/** Accessible single-open accordion (shadcn-style), no external deps. */
export function Accordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div className="divide-y divide-hairline border-y border-hairline">
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-panel-${i}`;
        const buttonId = `${baseId}-button-${i}`;
        return (
          <div key={i}>
            <h3>
              <button
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group flex w-full items-center justify-between gap-6 py-5 text-start"
              >
                <span className="text-[15px] font-medium text-text sm:text-base">{item.q}</span>
                <Plus
                  className={cn(
                    "size-4 shrink-0 text-text-muted transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:text-text-secondary",
                    isOpen && "rotate-45 text-emerald",
                  )}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="grid"
            >
              <p className="max-w-[60ch] pb-6 text-[14.5px] leading-relaxed text-text-secondary">
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
