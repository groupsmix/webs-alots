"use client";

import { useState } from "react";
import {
  ClipboardList, Plus, CheckCircle, Clock, Circle, Trash2,
  ChevronDown, ChevronUp, DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TreatmentPlan, TreatmentStep } from "@/lib/types/dental";
import { formatDisplayDate } from "@/lib/utils";

const STATUS_ICON = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "outline"> = {
  pending: "outline",
  in_progress: "default",
  completed: "success",
};

interface TreatmentPlanBuilderProps {
  plans: TreatmentPlan[];
  editable?: boolean;
  onUpdateStep?: (planId: string, stepIndex: number, status: TreatmentStep["status"]) => void;
  onAddStep?: (planId: string, description: string, cost: number) => void;
  onDeleteStep?: (planId: string, stepIndex: number) => void;
}

export function TreatmentPlanBuilder({
  plans,
  editable = false,
  onUpdateStep,
  onAddStep,
  onDeleteStep,
}: TreatmentPlanBuilderProps) {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(plans[0]?.id ?? null);
  const [newStepDesc, setNewStepDesc] = useState("");
  const [newStepCost, setNewStepCost] = useState("");
  const [addingToPlan, setAddingToPlan] = useState<string | null>(null);

  const handleAddStep = (planId: string) => {
    if (newStepDesc.trim() && onAddStep) {
      onAddStep(planId, newStepDesc.trim(), parseFloat(newStepCost) || 0);
      setNewStepDesc("");
      setNewStepCost("");
      setAddingToPlan(null);
    }
  };

  return (
    <div className="space-y-4">
      {plans.map((plan) => {
        const isExpanded = expandedPlan === plan.id;
        const completedSteps = plan.steps.filter((s) => s.status === "completed").length;
        const progress = Math.round((completedSteps / plan.steps.length) * 100);
        const paidAmount = plan.steps
          .filter((s) => s.status === "completed")
          .reduce((sum, s) => sum + s.cost, 0);

        return (
          <Card key={plan.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-sm">{plan.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {plan.patientName} &middot; {plan.doctorName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[plan.status] ?? "outline"} className="text-xs">
                    {plan.status.replace("_", " ")}
                  </Badge>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{completedSteps}/{plan.steps.length} steps completed</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent>
                <div className="space-y-3">
                  {plan.steps.map((step, index) => {
                    const Icon = STATUS_ICON[step.status];
                    return (
                      <div
                        key={`step-${step.step}`}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          step.status === "completed" ? "bg-green-50/50 dark:bg-green-950/20" :
                          step.status === "in_progress" ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" :
                          ""
                        }`}
                      >
                        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${
                          step.status === "completed" ? "text-green-600" :
                          step.status === "in_progress" ? "text-blue-600" :
                          "text-muted-foreground"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-medium ${step.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                              Step {step.step}: {step.description}
                            </p>
                            <span className="text-xs font-medium whitespace-nowrap">{step.cost.toLocaleString()} MAD</span>
                          </div>
                          {step.date && (
                            <p className="text-xs text-muted-foreground mt-0.5">{formatDisplayDate(step.date, "fr", "short")}</p>
                          )}
                        </div>
                        {editable && (
                          <div className="flex gap-1 shrink-0">
                            {step.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Start"
                                onClick={() => onUpdateStep?.(plan.id, index, "in_progress")}
                              >
                                <Clock className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                            )}
                            {step.status === "in_progress" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Complete"
                                onClick={() => onUpdateStep?.(plan.id, index, "completed")}
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                            )}
                            {step.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Remove"
                                onClick={() => onDeleteStep?.(plan.id, index)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Cost Summary */}
                <div className="mt-4 p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Cost Summary</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold">{plan.totalCost.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Total (MAD)</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600">{paidAmount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Completed</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-orange-600">{(plan.totalCost - paidAmount).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Remaining</p>
                    </div>
                  </div>
                </div>

                {/* Add Step */}
                {editable && (
                  <div className="mt-3">
                    {addingToPlan === plan.id ? (
                      <div className="space-y-2 p-3 border rounded-lg">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <Label className="text-xs">Description</Label>
                            <Input
                              value={newStepDesc}
                              onChange={(e) => setNewStepDesc(e.target.value)}
                              placeholder="Treatment step..."
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Cost (MAD)</Label>
                            <Input
                              value={newStepCost}
                              onChange={(e) => setNewStepCost(e.target.value)}
                              placeholder="0"
                              type="number"
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAddStep(plan.id)}>Add Step</Button>
                          <Button size="sm" variant="outline" onClick={() => setAddingToPlan(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setAddingToPlan(plan.id)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Treatment Step
                      </Button>
                    )}
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
