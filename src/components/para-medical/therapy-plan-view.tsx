"use client";

import { useState } from "react";
import {
  Target, CheckCircle, Circle, Clock, ChevronDown, ChevronUp,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TherapyPlan, TherapyGoal } from "@/lib/types/para-medical";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "outline"> = {
  active: "default",
  completed: "success",
  on_hold: "secondary",
};

const GOAL_STATUS_ICON = {
  not_started: Circle,
  in_progress: Clock,
  achieved: CheckCircle,
  revised: RotateCcw,
};

const GOAL_STATUS_COLOR: Record<string, string> = {
  not_started: "text-muted-foreground",
  in_progress: "text-blue-600",
  achieved: "text-green-600",
  revised: "text-orange-600",
};

interface TherapyPlanViewProps {
  plans: TherapyPlan[];
  editable?: boolean;
  onUpdateGoalStatus?: (planId: string, goalId: string, status: TherapyGoal["status"]) => void;
  onToggleMilestone?: (planId: string, goalId: string, milestoneIndex: number) => void;
}

export function TherapyPlanView({
  plans,
  editable = false,
  onUpdateGoalStatus,
  onToggleMilestone,
}: TherapyPlanViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(plans[0]?.id ?? null);

  return (
    <div className="space-y-4">
      {plans.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No therapy plans yet.</p>
      )}
      {plans.map((plan) => {
        const isExpanded = expandedId === plan.id;
        const achievedGoals = plan.goals.filter((g) => g.status === "achieved").length;
        const totalGoals = plan.goals.length;
        const progress = totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0;

        return (
          <Card key={plan.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : plan.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-purple-600" />
                  <div>
                    <CardTitle className="text-sm">{plan.patient_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {plan.treatment_approach} &middot; {plan.therapist_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[plan.status]} className="text-xs">{plan.status}</Badge>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{achievedGoals}/{totalGoals} goals achieved</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-4">
                {plan.diagnosis && (
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <p className="text-xs font-medium mb-1">Diagnosis</p>
                    <p className="text-xs text-muted-foreground">{plan.diagnosis}</p>
                  </div>
                )}

                {/* Goals */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Treatment Goals</h4>
                  {plan.goals.map((goal) => {
                    const GoalIcon = GOAL_STATUS_ICON[goal.status];
                    const completedMilestones = goal.milestones.filter((m) => m.completed).length;
                    return (
                      <div key={goal.id} className="p-3 rounded-lg border">
                        <div className="flex items-start gap-3">
                          <GoalIcon className={`h-5 w-5 mt-0.5 shrink-0 ${GOAL_STATUS_COLOR[goal.status]}`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{goal.description}</p>
                              <Badge variant="outline" className="text-[10px]">{goal.status.replace("_", " ")}</Badge>
                            </div>

                            {/* Progress */}
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Progress</span>
                                <span>{goal.progress_pct}%</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-purple-400 rounded-full" style={{ width: `${goal.progress_pct}%` }} />
                              </div>
                            </div>

                            {/* Milestones */}
                            {goal.milestones.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] text-muted-foreground font-medium">
                                  Milestones ({completedMilestones}/{goal.milestones.length})
                                </p>
                                {goal.milestones.map((ms, mIdx) => (
                                  <div key={mIdx} className="flex items-center gap-2 text-xs">
                                    <button
                                      disabled={!editable}
                                      onClick={() => onToggleMilestone?.(plan.id, goal.id, mIdx)}
                                      className="shrink-0"
                                    >
                                      {ms.completed ? (
                                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                      ) : (
                                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                                      )}
                                    </button>
                                    <span className={ms.completed ? "line-through text-muted-foreground" : ""}>
                                      {ms.description}
                                    </span>
                                    {ms.target_date && (
                                      <span className="text-[10px] text-muted-foreground ml-auto">{ms.target_date}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Goal status actions */}
                            {editable && goal.status !== "achieved" && (
                              <div className="flex gap-1 mt-2">
                                {goal.status === "not_started" && (
                                  <Button size="sm" variant="outline" onClick={() => onUpdateGoalStatus?.(plan.id, goal.id, "in_progress")}>
                                    Start
                                  </Button>
                                )}
                                {goal.status === "in_progress" && (
                                  <Button size="sm" variant="outline" onClick={() => onUpdateGoalStatus?.(plan.id, goal.id, "achieved")}>
                                    Mark Achieved
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dates */}
                <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span>Started: {plan.start_date}</span>
                  {plan.review_date && <span>Review: {plan.review_date}</span>}
                </div>

                {plan.notes && (
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <p className="text-xs font-medium mb-1">Notes</p>
                    <p className="text-xs text-muted-foreground">{plan.notes}</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
