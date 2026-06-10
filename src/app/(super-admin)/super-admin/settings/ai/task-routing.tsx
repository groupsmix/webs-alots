/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: same i18n posture as page.tsx */
"use client";

import { Loader2, Route } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

interface TaskRow {
  id: string;
  task_type: string;
  pinned_provider: string | null;
  pinned_model: string | null;
  is_active: boolean;
  updated_at: string;
}

const AUTO = "__auto__";
const DEFAULT_MODEL = "__default__";

const TASK_LABELS: Record<string, { label: string; hint: string }> = {
  conversation: { label: "Chatbot", hint: "Patient-facing conversations and assistant chat" },
  code: { label: "Building / Code", hint: "Site builder and code generation" },
  generate: { label: "Content generation", hint: "Drafts, descriptions, WhatsApp templates" },
  summarize: { label: "Summarization", hint: "Patient summaries and clinic briefings" },
  classify: { label: "Classification", hint: "Triage, tagging, routing decisions" },
  translate: { label: "Translation", hint: "French / Darija / Arabic translation" },
  analyze: { label: "Analysis", hint: "Analytics insights and health scores" },
  reason: { label: "Complex reasoning", hint: "Multi-step clinical or business reasoning" },
};

/**
 * Per-task model routing. Each AI task type can be pinned to a specific
 * provider (and optionally a specific allowlisted model). "Auto" keeps the
 * router's tier-based selection. Pins are a preference, not a constraint:
 * if the pinned provider is down or over budget, normal fallback applies.
 */
export function TaskRouting() {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [migrated, setMigrated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-task-config");
      const json = (await res.json()) as {
        ok: boolean;
        data?: { tasks: TaskRow[]; models: Record<string, string[]>; migrated: boolean };
      };
      if (json.ok && json.data) {
        setTasks(json.data.tasks);
        setModels(json.data.models);
        setMigrated(json.data.migrated);
      }
    } catch {
      // degraded — section shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const update = async (taskType: string, patch: Record<string, unknown>) => {
    setSaving(taskType);
    try {
      const res = await fetch("/api/admin/ai-task-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_type: taskType, ...patch }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        addToast(`Routing updated for ${TASK_LABELS[taskType]?.label ?? taskType}`, "success");
        await fetchData();
      } else {
        addToast(json.error ?? "Failed to update routing", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading task routing…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Route className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Task Routing</h2>
        <Badge variant="outline">per-task model selection</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Pin a provider and model for each AI task, or leave on Auto to let the router pick by
        tier. If a pinned provider is unavailable or over budget, normal fallback still applies.
      </p>

      {!migrated && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              The <span className="font-mono">ai_task_configs</span> migration has not been
              applied yet. Run{" "}
              <span className="font-mono">supabase db push</span> to enable task routing.
            </p>
          </CardContent>
        </Card>
      )}

      {tasks.map((task) => {
        const meta = TASK_LABELS[task.task_type] ?? { label: task.task_type, hint: "" };
        const providerModels = task.pinned_provider ? (models[task.pinned_provider] ?? []) : [];
        const isSaving = saving === task.task_type;

        return (
          <Card key={task.id} className={task.is_active ? "" : "opacity-60"}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-[180px]">
                <p className="font-medium">{meta.label}</p>
                <p className="text-xs text-muted-foreground">{meta.hint}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="w-44">
                  <Select
                    value={task.pinned_provider ?? AUTO}
                    onValueChange={(v) =>
                      void update(task.task_type, {
                        pinned_provider: v === AUTO ? null : v,
                      })
                    }
                  >
                    <SelectTrigger disabled={isSaving || !task.is_active}>
                      <SelectValue
                        placeholder="Provider"
                        value={task.pinned_provider ?? "Auto (router decides)"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO}>Auto (router decides)</SelectItem>
                      {Object.keys(models).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-52">
                  <Select
                    value={task.pinned_model ?? DEFAULT_MODEL}
                    onValueChange={(v) =>
                      void update(task.task_type, {
                        pinned_model: v === DEFAULT_MODEL ? null : v,
                      })
                    }
                  >
                    <SelectTrigger disabled={isSaving || !task.is_active || !task.pinned_provider}>
                      <SelectValue
                        placeholder="Model"
                        value={task.pinned_model ?? "Provider default"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_MODEL}>Provider default</SelectItem>
                      {providerModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={task.is_active}
                    onCheckedChange={(checked) =>
                      void update(task.task_type, { is_active: checked })
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
