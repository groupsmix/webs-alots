"use client";

/**
 * Drug Search / Autocomplete Component
 *
 * Provides a searchable dropdown for the DCI drug database.
 * Searches by DCI (generic) name or brand name.
 * When a drug is selected, auto-populates dosage form and strength.
 */

import { Search, Pill, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { searchDrugs, CATEGORY_LABELS, type DCIDrug } from "@/lib/dci-drug-database";

// ---- Types ----

export interface DrugSelection {
  /** DCI (generic) name */
  dci: string;
  /** Selected brand name (if any) */
  brand?: string;
  /** Selected dosage form */
  form?: string;
  /** Selected strength */
  strength?: string;
}

interface DrugSearchProps {
  /** Current medication name value */
  value: string;
  /** Called when the text input changes */
  onChange: (value: string) => void;
  /** Called when a drug is selected from the dropdown */
  onSelect: (selection: DrugSelection) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

// ---- Component ----

export function DrugSearch({
  value,
  onChange,
  onSelect,
  placeholder = "Rechercher un médicament (DCI ou marque)...",
  className,
}: DrugSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<DCIDrug[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<DCIDrug | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search when input changes
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      onChange(q);
      setSelectedDrug(null);
      setShowDetails(false);

      if (q.length >= 2) {
        const matches = searchDrugs(q, 10);
        setResults(matches);
        setIsOpen(matches.length > 0);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    },
    [onChange],
  );

  // Select a drug from the dropdown
  const handleSelectDrug = useCallback(
    (drug: DCIDrug) => {
      setSelectedDrug(drug);
      setIsOpen(false);
      setShowDetails(true);
      onChange(drug.dci);

      // Auto-select first form and strength
      onSelect({
        dci: drug.dci,
        brand: drug.brands[0],
        form: drug.forms[0],
        strength: drug.strengths[0],
      });
    },
    [onChange, onSelect],
  );

  // Select specific form/strength
  const handleSelectForm = useCallback(
    (form: string) => {
      if (!selectedDrug) return;
      onSelect({
        dci: selectedDrug.dci,
        brand: selectedDrug.brands[0],
        form,
        strength: selectedDrug.strengths[0],
      });
    },
    [selectedDrug, onSelect],
  );

  const handleSelectStrength = useCallback(
    (strength: string) => {
      if (!selectedDrug) return;
      onSelect({
        dci: selectedDrug.dci,
        brand: selectedDrug.brands[0],
        form: selectedDrug.forms[0],
        strength,
      });
    },
    [selectedDrug, onSelect],
  );

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0 && !selectedDrug) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-[300px] overflow-y-auto rounded-lg border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 shadow-lg">
          {results.map((drug) => (
            <button
              key={drug.id}
              type="button"
              onClick={() => handleSelectDrug(drug)}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <Pill className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{drug.dci}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {drug.brands.join(", ")}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {CATEGORY_LABELS[drug.category]}
                    </Badge>
                    {drug.requiresPrescription && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        Rx
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Drug Details */}
      {showDetails && selectedDrug && (
        <div className="mt-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">{selectedDrug.dci}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          <div className="text-xs text-muted-foreground">
            Marques: {selectedDrug.brands.join(", ")}
          </div>

          {/* Form selection */}
          <div>
            <div className="text-xs font-medium mb-1">Forme:</div>
            <div className="flex flex-wrap gap-1">
              {selectedDrug.forms.map((form) => (
                <button
                  key={form}
                  type="button"
                  onClick={() => handleSelectForm(form)}
                  className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {form}
                </button>
              ))}
            </div>
          </div>

          {/* Strength selection */}
          <div>
            <div className="text-xs font-medium mb-1">Dosage:</div>
            <div className="flex flex-wrap gap-1">
              {selectedDrug.strengths.map((strength) => (
                <button
                  key={strength}
                  type="button"
                  onClick={() => handleSelectStrength(strength)}
                  className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {strength}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
