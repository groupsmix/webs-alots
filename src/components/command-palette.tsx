"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Search, X, User, Phone, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Additional metadata shown as badge */
  badge?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  /** Items to search through */
  items: CommandPaletteItem[];
  /** Placeholder text */
  placeholder?: string;
  /** Called when the palette is closed */
  onClose?: () => void;
  /** Whether the palette is open */
  open: boolean;
  /** Relay query changes to the parent (e.g. for server-side search). */
  onQueryChange?: (query: string) => void;
}

/**
 * Global command palette (Cmd+K / Ctrl+K) for instant search.
 * Ideal for patient lookup by name, CIN, or phone number.
 *
 * Usage:
 * ```tsx
 * const [open, setOpen] = useState(false);
 * useKeyboardShortcuts([{ key: "k", ctrl: true, handler: () => setOpen(true) }]);
 * <CommandPalette open={open} onClose={() => setOpen(false)} items={patients} />
 * ```
 */
export function CommandPalette({
  items,
  placeholder,
  onClose,
  open,
  onQueryChange,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [locale] = useLocale();
  const effectivePlaceholder = placeholder ?? t(locale, "commandPalette.searchPlaceholder");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = items.filter((item) => {
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.badge?.toLowerCase().includes(q)
    );
  });

  const updateQuery = useCallback(
    (value: string) => {
      setQuery(value);
      onQueryChange?.(value);
    },
    [onQueryChange],
  );

  const handleClose = useCallback(() => {
    updateQuery("");
    setSelectedIndex(0);
    onClose?.();
  }, [onClose, updateQuery]);

  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    if (selectedIndex !== 0) setSelectedIndex(0);
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            filtered[selectedIndex].onSelect();
            handleClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          handleClose();
          break;
      }
    },
    [filtered, selectedIndex, handleClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label={t(locale, "commandPalette.quickSearch")}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Palette */}
      <div className="relative z-10 w-full max-w-lg mx-4 overflow-hidden rounded-xl border bg-background shadow-2xl">
        {/* Search input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
            aria-label={t(locale, "commandPalette.searchLabel")}
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-activedescendant={
              filtered[selectedIndex]
                ? `command-item-${filtered[selectedIndex].id}`
                : undefined
            }
          />
          {query && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              className="p-1 text-muted-foreground hover:text-foreground"
              aria-label={t(locale, "commandPalette.clearSearch")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Results */}
        <div
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          className="max-h-72 overflow-y-auto p-2"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t(locale, "commandPalette.noResults")} &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, index) => (
              <div
                key={item.id}
                id={`command-item-${item.id}`}
                role="option"
                aria-selected={index === selectedIndex}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
                onClick={() => {
                  item.onSelect();
                  handleClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  {item.icon ?? <User className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </div>
                  )}
                </div>
                {item.badge && (
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                    {item.badge}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ↑↓
            </kbd>
            {t(locale, "commandPalette.navigate")}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ↵
            </kbd>
            {t(locale, "commandPalette.select")}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              esc
            </kbd>
            {t(locale, "commandPalette.close")}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Icon helpers for patient search results */
export const CommandIcons = {
  patient: <User className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  cin: <CreditCard className="h-4 w-4" />,
} as const;
