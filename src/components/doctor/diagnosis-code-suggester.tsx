"use client";

import { Check, ChevronsUpDown, Loader2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { suggestICD10Codes, type CodeSuggestion } from "@/lib/algorithms/icd10-coder";

interface DiagnosisCodeSuggesterProps {
  initialText?: string;
  onCodeSelected: (code: string, description: string) => void;
  className?: string;
}

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
  const [isTyping, setIsTyping] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      return;
    }

    setIsTyping(true);
    const timer = setTimeout(() => {
      const results = suggestICD10Codes(query);
      setSuggestions(results);
      setIsTyping(false);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  // If initial text changes from parent, update search
  useEffect(() => {
    if (initialText && !selectedCode) {
      setQuery(initialText);
    }
  }, [initialText, selectedCode]);

  const handleSelect = (code: string, description: string) => {
    setSelectedCode(code);
    setOpen(false);
    onCodeSelected(code, description);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return "bg-green-100 text-green-800";
    if (confidence > 0.5) return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-800";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !selectedCode && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">
              {selectedCode
                ? suggestions.find((s) => s.code === selectedCode)?.[lang === "ar" ? "description_ar" : "description_fr"] ?? selectedCode
                : lang === "ar"
                ? "ابحث عن التشخيص أو رمز ICD-10..."
                : "Rechercher un diagnostic ou code CIM-10..."}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={lang === "ar" ? "أدخل التشخيص..." : "Saisissez le diagnostic..."} 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm">
              {isTyping ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span>{lang === "ar" ? "جاري البحث..." : "Recherche en cours..."}</span>
                </div>
              ) : (
                <span>{lang === "ar" ? "لم يتم العثور على تشخيص مطابق." : "Aucun diagnostic trouvé."}</span>
              )}
            </CommandEmpty>
            
            {suggestions.length > 0 && (
              <CommandGroup heading={lang === "ar" ? "الاقتراحات الذكية" : "Suggestions intelligentes"}>
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.code}
                    value={suggestion.code}
                    onSelect={() => handleSelect(suggestion.code, lang === "ar" ? suggestion.description_ar : suggestion.description_fr)}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4",
                            selectedCode === suggestion.code ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-medium text-primary">{suggestion.code}</span>
                      </div>
                      <Badge variant="secondary" className={cn("text-[10px] h-5", getConfidenceColor(suggestion.confidence))}>
                        {Math.round(suggestion.confidence * 100)}%
                      </Badge>
                    </div>
                    <span className="text-sm pl-6 text-muted-foreground">
                      {lang === "ar" ? suggestion.description_ar : suggestion.description_fr}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
