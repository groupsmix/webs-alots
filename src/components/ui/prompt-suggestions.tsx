"use client";

import { cn } from "@/lib/utils";

interface PromptSuggestionsProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  className?: string;
}

export function PromptSuggestions({
  suggestions,
  onSuggestionClick,
  className,
}: PromptSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("grid w-full gap-2", className)}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="rounded-lg border bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSuggestionClick(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
