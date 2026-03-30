"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { clinicConfig } from "@/config/clinic.config";

interface BookingCalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Format a full accessible date label (e.g. "lundi 15 mars 2026"). */
function formatAriaDate(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingCalendar({ selectedDate, onSelectDate }: BookingCalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  // Track which day has roving tabindex focus
  const [focusedDay, setFocusedDay] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setFocusedDay(null);
  }, [currentMonth, currentYear]);

  const nextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setFocusedDay(null);
  }, [currentMonth, currentYear]);

  /** Check whether a calendar day is bookable and, if not, why. */
  const getDateStatus = (day: number): { available: boolean; reason?: string } => {
    const date = new Date(currentYear, currentMonth, day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date < todayStart) return { available: false, reason: "Date passée" };
    const dayOfWeek = date.getDay();
    const hours = clinicConfig.workingHours[dayOfWeek];
    if (!hours?.enabled) return { available: false, reason: "Fermé" };
    return { available: true };
  };

  /** Backwards-compatible helper used by the rest of the component. */
  const isDateAvailable = (day: number) => getDateStatus(day).available;

  /** Return the reason a day is disabled, or null if available. */
  const getDisableReason = (day: number): string | null => {
    return getDateStatus(day).reason ?? null;
  };

  // Determine which day should be tabbable (roving tabindex)
  const selectedDayInMonth = (() => {
    if (!selectedDate) return null;
    const [y, m, d] = selectedDate.split("-").map(Number);
    if (y === currentYear && m - 1 === currentMonth) return d;
    return null;
  })();

  const tabbableDay = focusedDay ?? selectedDayInMonth ?? 1;

  // Focus the day button after focusedDay changes
  useEffect(() => {
    if (focusedDay === null || !gridRef.current) return;
    const btn = gridRef.current.querySelector<HTMLButtonElement>(`[data-day="${focusedDay}"]`);
    btn?.focus();
  }, [focusedDay, currentMonth, currentYear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = focusedDay ?? tabbableDay;
    let next = current;

    switch (e.key) {
      case "ArrowLeft":
        next = current - 1;
        break;
      case "ArrowRight":
        next = current + 1;
        break;
      case "ArrowUp":
        next = current - 7;
        break;
      case "ArrowDown":
        next = current + 7;
        break;
      case "Home":
        next = 1;
        break;
      case "End":
        next = daysInMonth;
        break;
      case "PageUp":
        e.preventDefault();
        prevMonth();
        return;
      case "PageDown":
        e.preventDefault();
        nextMonth();
        return;
      default:
        return;
    }

    e.preventDefault();

    // Navigate to prev/next month if out of range
    if (next < 1) {
      prevMonth();
      return;
    }
    if (next > daysInMonth) {
      nextMonth();
      return;
    }

    setFocusedDay(next);
  }, [focusedDay, tabbableDay, daysInMonth, prevMonth, nextMonth]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Mois précédent">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <h3 id="calendar-heading" className="font-semibold" aria-live="polite">
          {monthNames[currentMonth]} {currentYear}
        </h3>
        <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-labelledby="calendar-heading"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-7 gap-1 text-center"
      >
        <div role="row" className="contents">
          {dayNames.map((d) => (
            <div key={d} role="columnheader" className="text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>

        <div role="row" className="contents">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} role="gridcell" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDate(currentYear, currentMonth, day);
            const available = isDateAvailable(day);
            const isSelected = selectedDate === dateStr;
            const isTabbable = day === tabbableDay;

            const disableReason = available ? null : getDisableReason(day);
            const ariaLabel = formatAriaDate(currentYear, currentMonth, day) + (disableReason ? `, ${disableReason}` : "");

            const btn = (
              <button
                data-day={day}
                onClick={() => available && onSelectDate(dateStr)}
                disabled={!available}
                tabIndex={isTabbable ? 0 : -1}
                aria-label={ariaLabel}
                onFocus={() => setFocusedDay(day)}
                className={`h-9 w-full rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : available
                      ? "hover:bg-muted"
                      : "text-muted-foreground/30 cursor-not-allowed"
                }`}
              >
                {day}
              </button>
            );

            return (
              <div key={day} role="gridcell" aria-selected={isSelected}>
                {disableReason ? (
                  <Tooltip content={disableReason}>{btn}</Tooltip>
                ) : (
                  btn
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
