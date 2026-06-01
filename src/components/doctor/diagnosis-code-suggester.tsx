"use client";

import { Check, ChevronsUpDown, Loader2, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { suggestICD10Codes, type CodeSuggestion } from "@/lib/algorithms/icd10-coder";
import { cn } from "@/lib/utils";

interface DiagnosisCodeSuggesterProps {
  initialText?: string;
  onCodeSelected: (code: string, description: string) => void;
  className?: string;
}

/**
 * ICD-10 diagnosis code combobox.
 *
 * This component was originally authored against shadcn `Command` + Radix
 * `Popover`. Those primitives aren't installed in this codebase (and
 * pulling them in would bloat the Workers bundle — see PR #949), so the
 * combobox is implemented natively: a trigger button, a controlled Input
 * inside an absolutely-positioned dropdown, and an outside-click handler
 * to dismiss.
 */
export function DiagnosisCodeSuggester({
  initialText = "",
  onCodeSelected,
  className,
}: DiagnosisCodeSuggesterProps) {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialText);
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedDescription, setSelectedDescription] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  // Debounced search.
  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    const timer = setTimeout(() => {
      setSuggestions(suggestICD10Codes(query));
      setIsTyping(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // If parent passes a new initialText (and the user hasn't picked yet),
  // mirror it into the query so the suggestions match.
  useEffect(() => {
    if (initialText && !selectedCode) {
      setQuery(initialText);
    }
  }, [initialText, selectedCode]);

  // Outside-click closes the dropdown.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Auto-focus the input when the dropdown opens.
  useEffect(() => {
    if (open) {
      // Defer to the next frame so the input is mounted.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const handleSelect = (code: string, description: string) => {
    setSelectedCode(code);
    setSelectedDescription(description);
    setOpen(false);
    onCodeSelected(code, description);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return "bg-green-100 text-green-800";
    if (confidence > 0.5) return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-800";
  };

  const triggerLabel = selectedCode
    ? (selectedDescription ?? selectedCode)
    : lang === "ar"
      ? "ابحث عن التشخيص أو رمز ICD-10..."
      : "Rechercher un diagnostic ou code CIM-10...";

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          !selectedCode && "text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{triggerLabel}</span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-[min(400px,100%)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b border-border p-2">
            {/* Raw input — the codebase Input component doesn't forward refs,
                and we need the ref for auto-focus on open. The styling
                mirrors `Input` (`src/components/ui/input.tsx`) so the visual
                stays consistent. */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === "ar" ? "أدخل التشخيص..." : "Saisissez le diagnostic..."}
              className={cn(
                "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
          </div>

          <div className="max-h-72 overflow-y-auto">
            {suggestions.length === 0 ? (
              <div className="py-6 text-center text-sm">
                {isTyping ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span>{lang === "ar" ? "جاري البحث..." : "Recherche en cours..."}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    {lang === "ar" ? "لم يتم العثور على تشخيص مطابق." : "Aucun diagnostic trouvé."}
                  </span>
                )}
              </div>
            ) : (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {lang === "ar" ? "الاقتراحات الذكية" : "Suggestions intelligentes"}
                </div>
                {suggestions.map((suggestion) => {
                  const description =
                    lang === "ar" ? suggestion.description_ar : suggestion.description_fr;
                  const isSelected = selectedCode === suggestion.code;
                  return (
                    <button
                      type="button"
                      key={suggestion.code}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(suggestion.code, description)}
                      className="flex w-full cursor-pointer flex-col items-start gap-1 p-3 text-left hover:bg-muted focus:bg-muted focus:outline-none"
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
                          />
                          <span className="font-medium text-primary">{suggestion.code}</span>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-5 text-[10px]",
                            getConfidenceColor(suggestion.confidence),
                          )}
                        >
                          {Math.round(suggestion.confidence * 100)}%
                        </Badge>
                      </div>
                      <span className="pl-6 text-sm text-muted-foreground">{description}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
