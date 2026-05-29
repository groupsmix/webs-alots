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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TimelineEvent } from "@/lib/data/client/timeline";
import { cn } from "@/lib/utils";

const EVENT_CONFIG: Record<
  string,
  { icon: typeof Calendar; label: string; color: string; dotColor: string }
> = {
  visit: {
    icon: Calendar,
    label: "Consultation",
    color: "text-blue-600 dark:text-blue-400",
    dotColor: "bg-blue-500",
  },
  prescription: {
    icon: Pill,
    label: "Ordonnance",
    color: "text-purple-600 dark:text-purple-400",
    dotColor: "bg-purple-500",
  },
  lab_result: {
    icon: FlaskConical,
    label: "Résultat labo",
    color: "text-green-600 dark:text-green-400",
    dotColor: "bg-green-500",
  },
  imaging: {
    icon: ScanLine,
    label: "Imagerie",
    color: "text-orange-600 dark:text-orange-400",
    dotColor: "bg-orange-500",
  },
  payment: {
    icon: CreditCard,
    label: "Paiement",
    color: "text-emerald-600 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  note: {
    icon: FileText,
    label: "Note",
    color: "text-slate-600 dark:text-slate-400",
    dotColor: "bg-slate-500",
  },
  communication: {
    icon: MessageSquare,
    label: "WhatsApp",
    color: "text-green-600 dark:text-green-400",
    dotColor: "bg-green-600",
  },
};

function getStatusVariant(
  status: string | undefined,
): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (!status) return "secondary";
  switch (status) {
    case "completed":
    case "reviewed":
    case "shared":
    case "delivered":
    case "reported":
    case "validated":
      return "success";
    case "pending":
    case "scheduled":
    case "in_progress":
    case "images_ready":
      return "warning";
    case "cancelled":
    case "no_show":
    case "failed":
    case "refunded":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TimelineEventCardProps {
  event: TimelineEvent;
  className?: string;
}

export function TimelineEventCard({ event, className }: TimelineEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = EVENT_CONFIG[event.event_type] ?? EVENT_CONFIG.note;
  const Icon = config.icon;
  const meta = event.metadata;
  const status = meta.status as string | undefined;

  return (
    <div className={cn("relative flex gap-4", className)} dir="auto">
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            config.dotColor,
          )}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Event card */}
      <Card className="mb-4 flex-1">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-sm font-semibold", config.color)}>{config.label}</span>
                {status && (
                  <Badge variant={getStatusVariant(status)} className="text-xs">
                    {status}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(event.event_date)}</p>
              {renderSummary(event)}
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
              aria-label={expanded ? "Réduire" : "Développer"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t text-sm space-y-1">{renderDetails(event)}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function renderSummary(event: TimelineEvent) {
  const meta = event.metadata;
  switch (event.event_type) {
    case "visit":
      return (
        <p className="text-sm text-foreground mt-1 truncate">
          {meta.source === "walk_in"
            ? "Sans rendez-vous"
            : meta.source === "whatsapp"
              ? "Réservation WhatsApp"
              : "Rendez-vous"}
          {meta.is_first_visit ? " (Première visite)" : ""}
        </p>
      );
    case "prescription":
      return (
        <p className="text-sm text-foreground mt-1 truncate">
          {Array.isArray(meta.items)
            ? `${(meta.items as unknown[]).length} médicament(s)`
            : "Ordonnance émise"}
        </p>
      );
    case "lab_result":
      return (
        <p className="text-sm text-foreground mt-1 truncate">
          {(meta.title as string) ?? "Résultat d'analyse"}
        </p>
      );
    case "imaging":
      return (
        <p className="text-sm text-foreground mt-1 truncate">
          {(meta.modality as string)?.toUpperCase()} — {(meta.body_part as string) ?? "N/A"}
        </p>
      );
    case "payment":
      return (
        <p className="text-sm text-foreground mt-1 truncate">
          {meta.amount ? `${meta.amount} MAD` : ""} par {(meta.method as string) ?? "N/A"}
        </p>
      );
    case "note":
      return (
        <p className="text-sm text-foreground mt-1 truncate">
          {(meta.diagnosis as string) ??
            (meta.notes as string)?.slice(0, 80) ??
            "Note de consultation"}
        </p>
      );
    case "communication":
      return (
        <p className="text-sm text-foreground mt-1 truncate">
          {(meta.trigger as string) ?? "Message WhatsApp"} — {(meta.recipient_name as string) ?? ""}
        </p>
      );
    default:
      return null;
  }
}

function renderDetails(event: TimelineEvent) {
  const meta = event.metadata;
  const entries = Object.entries(meta).filter(([, v]) => v !== null && v !== undefined && v !== "");

  return entries.map(([key, value]) => (
    <div key={key} className="flex gap-2">
      <span className="text-muted-foreground font-medium min-w-[100px] capitalize">
        {key.replace(/_/g, " ")}:
      </span>
      <span className="text-foreground break-all">
        {typeof value === "object" ? JSON.stringify(value) : String(value)}
      </span>
    </div>
  ));
}
