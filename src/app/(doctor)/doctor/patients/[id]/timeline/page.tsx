/* eslint-disable i18next/no-literal-string */
"use client";

import { ArrowLeft, Clock, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  TimelineEventCard,
  TimelineFilters,
  TimelineSkeleton,
  TimelineSearch,
} from "@/components/patient/timeline";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchPatientTimeline,
  type TimelineEvent,
  type TimelinePagination,
} from "@/lib/data/client/timeline";
import type { TimelineEventType } from "@/lib/validations/patient-timeline";

export default function PatientTimelinePage() {
  const params = useParams();
  const patientId = params.id as string;

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [pagination, setPagination] = useState<TimelinePagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<TimelineEventType | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const loadTimeline = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPatientTimeline({
        patientId,
        eventType: activeFilter,
        search: searchQuery || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page,
        limit: 50,
      });
      setEvents(data.events);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }, [patientId, activeFilter, searchQuery, dateFrom, dateTo, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadTimeline();
    }, 300);
    return () => clearTimeout(debounce);
  }, [loadTimeline]);

  useEffect(() => {
    setPage(1);
  }, [activeFilter, searchQuery, dateFrom, dateTo]);

  const groupedEvents = groupByDate(events);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Breadcrumb
            items={[
              { label: "Doctor", href: "/doctor" },
              { label: "Patients", href: "/doctor/patients" },
              { label: "Timeline" },
            ]}
          />
          <div className="flex items-center gap-2">
            <Link href="/doctor/patients">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Patient Timeline</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="print:hidden"
          >
            <Printer className="h-4 w-4" />
            Print Dossier
          </Button>
        </div>
      </div>

      {/* Search */}
      <TimelineSearch
        value={searchQuery}
        onChange={setSearchQuery}
        className="max-w-md print:hidden"
      />

      {/* Filters */}
      <TimelineFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        className="print:hidden"
      />

      {/* Content */}
      {loading && <TimelineSkeleton />}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="ml-3" onClick={loadTimeline}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <EmptyState
          icon={Clock}
          title="No events found"
          description={
            activeFilter || searchQuery || dateFrom || dateTo
              ? "Try adjusting your filters or search query"
              : "This patient has no recorded interactions yet"
          }
          action={
            (activeFilter || searchQuery || dateFrom || dateTo) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveFilter(undefined);
                  setSearchQuery("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear all filters
              </Button>
            )
          }
        />
      )}

      {!loading && !error && events.length > 0 && (
        <>
          {/* Stats */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
            <Badge variant="secondary">{pagination?.total ?? events.length} events</Badge>
            {pagination && pagination.totalPages > 1 && (
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
            )}
          </div>

          {/* Timeline */}
          <div className="relative">
            {Object.entries(groupedEvents).map(([dateStr, dayEvents]) => (
              <div key={dateStr} className="mb-6">
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    {formatGroupDate(dateStr)}
                  </h2>
                </div>
                {dayEvents.map((event) => (
                  <TimelineEventCard key={event.id} event={event} />
                ))}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 print:hidden">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Print-friendly styles */}
      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          [data-slot="card"] { break-inside: avoid; box-shadow: none; border: 1px solid #e5e7eb; }
        }
      `}</style>
    </div>
  );
}

function groupByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const event of events) {
    const dateKey = new Date(event.event_date).toISOString().split("T")[0];
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(event);
  }
  return groups;
}

function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split("T")[0]) return "Today";
  if (dateStr === yesterday.toISOString().split("T")[0]) return "Yesterday";

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
