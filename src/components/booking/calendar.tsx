"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Full day names for accessible date labels (issue #26). */
const fullDayNames = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
];

/** Full month names for accessible date labels (issue #26). */
const fullMonthNames = [
  "janvier", "f\u00e9vrier", "mars", "avril", "mai", "juin",
  "juillet", "ao\u00fbt", "septembre", "octobre", "novembre", "d\u00e9cembre",
];

export function BookingCalendar({ selectedDate, onSelectDate }: BookingCalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Roving tabindex focus tracking (issue #26)
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

  const isDateAvailable = useCallback((day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const dayOfWeek = date.getDay();
    const hours = clinicConfig.workingHours[dayOfWeek];
    if (!hours?.enabled) return false;
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date >= todayStart;
  }, [currentYear, currentMonth, today]);

  /** Build accessible label, e.g. "lundi 15 mars 2026" (issue #26) */
  const getAriaLabel = useCallback((day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    return `${fullDayNames[date.getDay()]} ${day} ${fullMonthNames[currentMonth]} ${currentYear}`;
  }, [currentYear, currentMonth]);

  // Move DOM focus to the button matching focusedDay
  useEffect(() => {
    if (focusedDay === null) return;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusedDay}"]`);
    btn?.focus();
  }, [focusedDay, currentMonth, currentYear]);

  /** Arrow-key, Home/End, PageUp/PageDown navigation (issue #26) */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const day = focusedDay ?? 1;
      let next: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          next = day < daysInMonth ? day + 1 : null;
          break;
        case "ArrowLeft":
          e.preventDefault();
          next = day > 1 ? day - 1 : null;
          break;
        case "ArrowDown":
          e.preventDefault();
          next = day + 7 <= daysInMonth ? day + 7 : null;
          break;
        case "ArrowUp":
          e.preventDefault();
          next = day - 7 >= 1 ? day - 7 : null;
          break;
        case "Home":
          e.preventDefault();
          next = 1;
          break;
        case "End":
          e.preventDefault();
          next = daysInMonth;
          break;
        case "PageDown":
          e.preventDefault();
          nextMonth();
          return;
        case "PageUp":
          e.preventDefault();
          prevMonth();
          return;
        default:
          return;
      }

      if (next !== null) setFocusedDay(next);
    },
    [focusedDay, daysInMonth, nextMonth, prevMonth],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Mois pr\u00e9c\u00e9dent">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold" aria-live="polite">
          {monthNames[currentMonth]} {currentYear}
        </h3>
        <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid with role="grid" and keyboard navigation (issue #26) */}
      <div
        ref={gridRef}
        role="grid"
        aria-label="Calendrier de r\u00e9servation"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-7 gap-1 text-center"
      >
        {dayNames.map((d) => (
          <div key={d} role="columnheader" className="text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}

        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} role="gridcell" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDate(currentYear, currentMonth, day);
          const available = isDateAvailable(day);
          const isSelected = selectedDate === dateStr;
          const isFocusTarget = focusedDay === day || (focusedDay === null && day === 1);

          return (
            <button
              key={day}
              data-day={day}
              role="gridcell"
              aria-selected={isSelected}
              aria-label={getAriaLabel(day)}
              tabIndex={isFocusTarget ? 0 : -1}
              onClick={() => {
                if (available) {
                  onSelectDate(dateStr);
                  setFocusedDay(day);
                }
              }}
              onFocus={() => setFocusedDay(day)}
              disabled={!available}
              className={`h-9 w-full rounded-md text-sm transition-colors ${
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
        })}
      </div>
    </div>
  );
}
