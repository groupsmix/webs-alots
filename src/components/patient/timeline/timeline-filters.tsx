/* eslint-disable i18next/no-literal-string */
"use client";

import {
  Calendar,
  Pill,
  FlaskConical,
  ScanLine,
  CreditCard,
  FileText,
  MessageSquare,
  Filter,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIMELINE_EVENT_TYPES, type TimelineEventType } from "@/lib/validations/patient-timeline";

const EVENT_FILTER_CONFIG: Record<TimelineEventType, { icon: typeof Calendar; label: string }> = {
  visit: { icon: Calendar, label: "Visits" },
  prescription: { icon: Pill, label: "Prescriptions" },
  lab_result: { icon: FlaskConical, label: "Lab Results" },
  imaging: { icon: ScanLine, label: "Imaging" },
  payment: { icon: CreditCard, label: "Payments" },
  note: { icon: FileText, label: "Notes" },
  communication: { icon: MessageSquare, label: "WhatsApp" },
};

interface TimelineFiltersProps {
  activeFilter: TimelineEventType | undefined;
  onFilterChange: (filter: TimelineEventType | undefined) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  className?: string;
}

export function TimelineFilters({
  activeFilter,
  onFilterChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  className,
}: TimelineFiltersProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Event type filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <button
          onClick={() => onFilterChange(undefined)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
            !activeFilter
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-transparent text-muted-foreground border-input hover:bg-muted",
          )}
        >
          All
        </button>
        {TIMELINE_EVENT_TYPES.map((type) => {
          const config = EVENT_FILTER_CONFIG[type];
          const Icon = config.icon;
          const isActive = activeFilter === type;
          return (
            <button
              key={type}
              onClick={() => onFilterChange(isActive ? undefined : type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-input hover:bg-muted",
              )}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Date range filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground" htmlFor="timeline-from">
          From:
        </label>
        <input
          id="timeline-from"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        />
        <label className="text-xs text-muted-foreground" htmlFor="timeline-to">
          To:
        </label>
        <input
          id="timeline-to"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        />
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDateFromChange("");
              onDateToChange("");
            }}
            className="h-8 px-2"
          >
            <X className="h-3 w-3" />
            Clear dates
          </Button>
        )}
      </div>

      {/* Active filter indicator */}
      {activeFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            Showing: {EVENT_FILTER_CONFIG[activeFilter].label}
            <button
              onClick={() => onFilterChange(undefined)}
              className="ml-1 hover:text-destructive"
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}
    </div>
  );
}
