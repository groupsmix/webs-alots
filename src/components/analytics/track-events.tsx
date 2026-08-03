"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Global click tracker for `data-event` attributes.
 *
 * Place once near the root layout. Any click on or inside an element with
 * `data-event="event-name"` will fire `trackEvent()`. Optional event props can
 * be added with `data-event-prop-key="value"`.
 */
export function TrackEvents() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const trigger = target.closest("[data-event]");
      if (!(trigger instanceof HTMLElement)) return;

      const name = trigger.dataset.event;
      if (!name) return;

      const props: Record<string, string | number | boolean> = {};
      for (const key of Object.keys(trigger.dataset)) {
        if (key.startsWith("eventProp")) {
          const propName = key.replace(/^eventProp/, "").toLowerCase();
          const value = trigger.dataset[key];
          if (value !== undefined) {
            if (value === "true") props[propName] = true;
            else if (value === "false") props[propName] = false;
            else if (/^-?\d+$/.test(value)) props[propName] = Number(value);
            else props[propName] = value;
          }
        }
      }

      trackEvent(name, props);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
