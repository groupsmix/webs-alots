"use client";

/**
 * ExceptionDayPicker
 *
 * Month-grid calendar that lets clinic staff mark / unmark specific dates
 * as doctor unavailability exceptions. Red dates are exception days;
 * clicking them removes the exception. Clicking a non-red date opens a
 * dialog to confirm the reason and create the exception.
 *
 * No external calendar library is needed — the grid is built from plain
 * Date arithmetic so the component has zero extra dependencies.
 */

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { use, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { logger } from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────

interface Exception {
  id: string;
  date: string; // "YYYY-MM-DD"
  reason: string | null;
}

interface Props {
  doctorId: string;
  clinicId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function toDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Return the Date objects for all cells in a 6-row × 7-col calendar grid. */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startCell = new Date(firstDay);
  startCell.setDate(1 - firstDay.getDay()); // rewind to the Sunday before month start
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(startCell.getTime() + i * 86_400_000));
  }
  return cells;
}

async function fetchExceptions(doctorId: string, clinicId: string): Promise<Exception[]> {
  try {
    const res = await fetch(`/api/doctor-exceptions?doctorId=${doctorId}`);
    const json = (await res.json()) as { ok: boolean; data?: { exceptions: Exception[] } };
    if (json.ok) {
      return json.data?.exceptions ?? [];
    }
  } catch (err) {
    logger.warn("ExceptionDayPicker: failed to load exceptions", {
      context: "schedule/exception-day-picker",
      doctorId,
      clinicId,
      error: err,
    });
  }
  return [];
}

// ── Component ──────────────────────────────────────────────────────────────

export function ExceptionDayPicker({ doctorId, clinicId }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [promise] = useState(() => fetchExceptions(doctorId, clinicId));
  const initialExceptions = use(promise);
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null); // exception id being removed

  // ── Exception lookup ──────────────────────────────────────────────────────

  const exceptionMap = new Map(exceptions.map((e) => [e.date, e]));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDayClick = (date: Date) => {
    if (date.getMonth() !== month) return; // ignore cells from adjacent months
    const dateStr = toDateString(date);
    const existing = exceptionMap.get(dateStr);

    if (existing) {
      // Remove the exception immediately
      void handleRemove(existing.id);
    } else {
      // Open dialog to add an exception
      setSelectedDate(dateStr);
      setReason("");
      setDialogOpen(true);
    }
  };

  const handleRemove = async (exceptionId: string) => {
    setRemoving(exceptionId);
    try {
      const res = await fetch(`/api/doctor-exceptions/${exceptionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setExceptions((prev) => prev.filter((e) => e.id !== exceptionId));
      }
    } catch (err) {
      logger.warn("ExceptionDayPicker: failed to remove exception", {
        context: "schedule/exception-day-picker",
        exceptionId,
        error: err,
      });
    } finally {
      setRemoving(null);
    }
  };

  const handleCreate = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/doctor-exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, date: selectedDate, reason: reason || undefined }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { exception: Exception } };
      if (json.ok && json.data?.exception) {
        setExceptions((prev) => [...prev, json.data!.exception]);
        setDialogOpen(false);
      }
    } catch (err) {
      logger.warn("ExceptionDayPicker: failed to create exception", {
        context: "schedule/exception-day-picker",
        date: selectedDate,
        error: err,
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Month navigation ───────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const cells = buildMonthGrid(year, month);
  const todayStr = toDateString(today);

  return (
    <div className="w-full max-w-sm select-none">
      {/* Month navigation header */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Mois précédent">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">
          {MONTH_LABELS[month]} {year}
        </span>
        <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day labels row */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, i) => {
          const dateStr = toDateString(cell);
          const isException = exceptionMap.has(dateStr);
          const isToday = dateStr === todayStr;
          const isCurrentMonth = cell.getMonth() === month;
          const isRemoving = removing === exceptionMap.get(dateStr)?.id;

          return (
            <button
              key={i}
              onClick={() => handleDayClick(cell)}
              disabled={isRemoving}
              aria-label={`${dateStr}${isException ? " — jour d'exception, cliquer pour supprimer" : " — marquer indisponible"}`}
              className={[
                "relative h-9 w-full rounded text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !isCurrentMonth && "opacity-30 pointer-events-none",
                isException
                  ? "bg-red-100 text-red-800 font-semibold hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
                  : "hover:bg-accent hover:text-accent-foreground",
                isToday && !isException && "ring-1 ring-primary font-semibold",
                isRemoving && "opacity-50 cursor-wait",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {cell.getDate()}
              {isException && (
                <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {exceptions.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 rounded-sm bg-red-100 border border-red-300 inline-block" />
          <span>
            {exceptions.length} jour{exceptions.length > 1 ? "s" : ""} d&apos;exception
          </span>
        </div>
      )}

      {/* Exception list (compact) */}
      {exceptions.length > 0 && (
        <ul className="mt-3 space-y-1 max-h-40 overflow-y-auto">
          {exceptions
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((ex) => (
              <li
                key={ex.id}
                className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs"
              >
                <span className="font-medium">{ex.date}</span>
                {ex.reason && (
                  <Badge variant="outline" className="mx-2 truncate max-w-[120px] text-[10px]">
                    {ex.reason}
                  </Badge>
                )}
                <button
                  onClick={() => void handleRemove(ex.id)}
                  disabled={removing === ex.id}
                  className="ml-auto text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  aria-label={`Supprimer l'exception du ${ex.date}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
        </ul>
      )}

      {/* Add-exception dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marquer comme indisponible</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Date : <span className="font-medium text-foreground">{selectedDate}</span>
          </p>
          <Textarea
            placeholder="Raison (facultative) — vacances, maladie, jour férié…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Enregistrement…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
