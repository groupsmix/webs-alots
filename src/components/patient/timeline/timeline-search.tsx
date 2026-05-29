"use client";

import { Search, X } from "lucide-react";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TimelineSearchProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimelineSearch({ value, onChange, className }: TimelineSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Rechercher dans l'historique..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-8 h-9"
      />
      {value && (
        <button
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm hover:bg-muted"
          aria-label="Effacer la recherche"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
