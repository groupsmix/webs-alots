/* eslint-disable i18next/no-literal-string -- French-first AI dashboard UI strings */
"use client";

/**
 * AI Team Kanban Board (Phase C3)
 *
 * Displays durable AI team tasks as a kanban board with columns for each status.
 * Supports human override actions: approve, request changes, cancel, retry.
 */

import {
  ArrowRight,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Megaphone,
  MessageSquare,
  RotateCcw,
  X,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ── Types ──

type TaskStatus = "backlog" | "in_progress" | "review" | "changes_requested" | "done" | "cancelled";

interface HistoryEvent {
  type: string;
  actor: string;
  at: string;
  payload: Record<string, unknown>;
}

interface TeamTask {
  id: string;
  title: string;
  description: string | null;
  agent_type: string;
  status: TaskStatus;
  reviewer_agent_type: string | null;
  review_comments: string | null;
  review_cycles: number;
  history_events: HistoryEvent[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Column config ──

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "backlog", label: "Backlog", color: "bg-gray-100 dark:bg-gray-800" },
  { status: "in_progress", label: "En cours", color: "bg-blue-50 dark:bg-blue-900/20" },
  { status: "review", label: "En révision", color: "bg-amber-50 dark:bg-amber-900/20" },
  {
    status: "changes_requested",
    label: "Modifications demandées",
    color: "bg-orange-50 dark:bg-orange-900/20",
  },
  { status: "done", label: "Terminé", color: "bg-green-50 dark:bg-green-900/20" },
  { status: "cancelled", label: "Annulé", color: "bg-red-50 dark:bg-red-900/20" },
];

const AGENT_ICONS: Record<string, typeof Bot> = {
  marketing: Megaphone,
  support: MessageSquare,
  reminder: Calendar,
};

const AGENT_COLORS: Record<string, string> = {
  marketing: "text-pink-600 dark:text-pink-400",
  support: "text-blue-600 dark:text-blue-400",
  reminder: "text-emerald-600 dark:text-emerald-400",
};

// ── Task Card ──

function TaskCard({
  task,
  onTransition,
  transitioning,
}: {
  task: TeamTask;
  onTransition: (taskId: string, from: TaskStatus, to: TaskStatus, comments?: string) => void;
  transitioning: string | null;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const Icon = AGENT_ICONS[task.agent_type] ?? Bot;
  const agentColor = AGENT_COLORS[task.agent_type] ?? "text-gray-500";
  const isTransitioning = transitioning === task.id;

  const actions = getAvailableActions(task.status);

  return (
    <Card className="mb-2 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${agentColor}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">{task.title}</p>
            {task.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
            )}
            {task.review_comments && (
              <p className="mt-1 rounded bg-amber-50 p-1.5 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                💬 {task.review_comments}
              </p>
            )}
            {task.review_cycles > 0 && (
              <span className="mt-1 inline-flex items-center text-[10px] text-muted-foreground">
                <RotateCcw className="mr-0.5 h-3 w-3" />
                Cycle {task.review_cycles}
                {task.review_cycles > 2 && " — escalade humaine requise"}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {actions.map((action) => (
              <Button
                key={action.to}
                size="sm"
                variant={action.variant as "default" | "outline" | "destructive"}
                className="h-6 px-2 text-[10px]"
                disabled={isTransitioning}
                onClick={() => {
                  if (action.needsComment) {
                    const comment = commentRef.current?.value || commentInput;
                    onTransition(task.id, task.status, action.to, comment || undefined);
                  } else {
                    onTransition(task.id, task.status, action.to);
                  }
                }}
              >
                {isTransitioning ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <action.icon className="mr-1 h-3 w-3" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Comment input for changes_requested action */}
        {actions.some((a) => a.needsComment) && (
          <textarea
            ref={commentRef}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="Commentaire (optionnel)..."
            className="mt-1 w-full rounded border bg-transparent p-1.5 text-xs"
            rows={2}
          />
        )}

        {/* History timeline toggle */}
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Historique ({(task.history_events ?? []).length})
        </button>

        {historyOpen && (task.history_events ?? []).length > 0 && (
          <div className="mt-1 space-y-1 border-l-2 border-muted pl-2">
            {(task.history_events ?? []).map((evt, i) => (
              <div key={`${evt.at}-${evt.type}-${i}`} className="text-[10px] text-muted-foreground">
                <span className="font-medium">{evt.type}</span>
                {typeof evt.payload?.from === "string" && typeof evt.payload?.to === "string" && (
                  <span>
                    {" "}
                    {evt.payload.from} → {evt.payload.to}
                  </span>
                )}
                <span className="ml-1 opacity-60">
                  {new Date(evt.at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(task.updated_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface ActionDef {
  to: TaskStatus;
  label: string;
  icon: typeof Check;
  variant: string;
  needsComment?: boolean;
}

function getAvailableActions(status: TaskStatus): ActionDef[] {
  switch (status) {
    case "backlog":
      return [
        { to: "in_progress", label: "Démarrer", icon: ArrowRight, variant: "default" },
        { to: "cancelled", label: "Annuler", icon: X, variant: "destructive" },
      ];
    case "in_progress":
      return [
        { to: "review", label: "Soumettre", icon: ArrowRight, variant: "default" },
        { to: "cancelled", label: "Annuler", icon: X, variant: "destructive" },
      ];
    case "review":
      return [
        { to: "done", label: "Approuver", icon: Check, variant: "default" },
        {
          to: "changes_requested",
          label: "Demander modifs",
          icon: RotateCcw,
          variant: "outline",
          needsComment: true,
        },
        { to: "cancelled", label: "Annuler", icon: X, variant: "destructive" },
      ];
    case "changes_requested":
      return [
        { to: "in_progress", label: "Reprendre", icon: RotateCcw, variant: "default" },
        { to: "cancelled", label: "Annuler", icon: X, variant: "destructive" },
      ];
    default:
      return [];
  }
}

// ── Main Kanban Board ──

export function AITeamKanban({ tasks, onRefresh }: { tasks: TeamTask[]; onRefresh: () => void }) {
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTransition = useCallback(
    async (taskId: string, fromStatus: TaskStatus, toStatus: TaskStatus, comments?: string) => {
      setTransitioning(taskId);
      setError(null);
      try {
        const res = await fetch("/api/ai/team/tasks/v2", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            fromStatus,
            toStatus,
            reviewComments: comments,
          }),
        });

        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!json.ok) {
          setError(json.error ?? "Erreur lors de la transition");
        } else {
          onRefresh();
        }
      } catch {
        setError("Erreur réseau");
      } finally {
        setTransitioning(null);
      }
    },
    [onRefresh],
  );

  const tasksByStatus = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.status),
  }));

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid auto-cols-fr grid-flow-col gap-3 overflow-x-auto pb-2">
        {tasksByStatus.map((col) => (
          <div key={col.status} className={`min-w-[200px] rounded-lg p-2 ${col.color}`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.label}
              </h3>
              <Badge variant="secondary" className="text-[10px]">
                {col.tasks.length}
              </Badge>
            </div>

            <div className="space-y-0">
              {col.tasks.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground/50">Aucune tâche</p>
              ) : (
                col.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onTransition={handleTransition}
                    transitioning={transitioning}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { TeamTask, TaskStatus as TeamTaskStatus };
