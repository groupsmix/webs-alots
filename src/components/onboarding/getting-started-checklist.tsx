"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Settings, Stethoscope, UserCog, Clock, Palette,
  CheckCircle2, Circle, ChevronDown, ChevronUp, Rocket,
  RotateCcw, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ONBOARDING_STEPS,
  dismissTour,
  resetTour,
  type OnboardingStepId,
} from "@/lib/data/client/onboarding";

const STEP_ICONS: Record<OnboardingStepId, React.ComponentType<{ className?: string }>> = {
  clinic_profile: Settings,
  add_services: Stethoscope,
  add_doctors: UserCog,
  set_working_hours: Clock,
  customize_website: Palette,
};

interface GettingStartedChecklistProps {
  completedSteps: OnboardingStepId[];
  dismissed: boolean;
  onDismiss: () => void;
  onReshow: () => void;
}

export function GettingStartedChecklist({
  completedSteps,
  dismissed,
  onDismiss,
  onReshow,
}: GettingStartedChecklistProps) {
  const [expanded, setExpanded] = useState(true);

  const completedCount = completedSteps.length;
  const totalSteps = ONBOARDING_STEPS.length;
  const allDone = completedCount === totalSteps;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  if (dismissed && allDone) return null;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={async () => {
          await resetTour();
          onReshow();
        }}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted w-full"
      >
        <RotateCcw className="h-3 w-3" />
        Show setup guide
      </button>
    );
  }

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            Getting Started
          </CardTitle>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded p-0.5 hover:bg-muted transition-colors"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                await dismissTour();
                onDismiss();
              }}
              className="rounded p-0.5 hover:bg-muted transition-colors"
              aria-label="Dismiss checklist"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>{completedCount} of {totalSteps} steps</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-3 pt-2">
          <div className="space-y-1">
            {ONBOARDING_STEPS.map((step) => {
              const isCompleted = completedSteps.includes(step.id);
              const Icon = STEP_ICONS[step.id];
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors group ${
                    isCompleted
                      ? "text-muted-foreground"
                      : "text-foreground hover:bg-primary/5"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary shrink-0" />
                  )}
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isCompleted ? "text-muted-foreground/50" : "text-muted-foreground"}`} />
                  <span className={isCompleted ? "line-through" : ""}>{step.title}</span>
                </Link>
              );
            })}
          </div>

          {allDone && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-700 font-medium text-center">
                All set! Your clinic is ready to go.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
