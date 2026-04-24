"use client";

import {
  Settings, Stethoscope, UserCog, Clock, Palette,
  ChevronRight, ChevronLeft, X, Rocket,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ONBOARDING_STEPS,
  dismissTour,
  markStepComplete,
  type OnboardingStepId,
} from "@/lib/data/client/onboarding";

const STEP_ICONS: Record<OnboardingStepId, React.ComponentType<{ className?: string }>> = {
  clinic_profile: Settings,
  add_services: Stethoscope,
  add_doctors: UserCog,
  set_working_hours: Clock,
  customize_website: Palette,
};

interface OnboardingTourProps {
  onDismiss: () => void;
  completedSteps: OnboardingStepId[];
  onStepComplete: (stepId: OnboardingStepId) => void;
}

export function OnboardingTour({ onDismiss, completedSteps, onStepComplete }: OnboardingTourProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);

  const step = ONBOARDING_STEPS[currentStep];
  const Icon = STEP_ICONS[step.id];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const isStepCompleted = completedSteps.includes(step.id);

  async function handleDismiss() {
    setDismissing(true);
    await dismissTour();
    onDismiss();
  }

  async function handleGoToStep() {
    await markStepComplete(step.id);
    onStepComplete(step.id);
    router.push(step.href);
  }

  function handleNext() {
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handlePrev() {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  async function handleFinish() {
    await dismissTour();
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleDismiss} />
      <Card className="relative z-10 w-full max-w-lg mx-4 shadow-2xl">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-primary/5">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Welcome to Your Clinic!</h2>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={dismissing}
              className="rounded-md p-1 hover:bg-muted transition-colors"
              aria-label="Dismiss tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 px-4 pt-4">
            {ONBOARDING_STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i === currentStep
                    ? "bg-primary"
                    : completedSteps.includes(s.id)
                    ? "bg-green-500"
                    : i < currentStep
                    ? "bg-primary/40"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`rounded-lg p-3 ${isStepCompleted ? "bg-green-100" : "bg-primary/10"}`}>
                <Icon className={`h-6 w-6 ${isStepCompleted ? "text-green-600" : "text-primary"}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Step {currentStep + 1} of {ONBOARDING_STEPS.length}
                  </p>
                  {isStepCompleted && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Done
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold mt-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
              </div>
            </div>

            <div className="mt-6">
              <Button onClick={handleGoToStep} className="w-full" size="sm">
                {isStepCompleted ? "Review this step" : "Set up now"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Footer navigation */}
          <div className="flex items-center justify-between p-4 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={isFirstStep}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <p className="text-xs text-muted-foreground">
              {completedSteps.length} of {ONBOARDING_STEPS.length} completed
            </p>

            {isLastStep ? (
              <Button variant="outline" size="sm" onClick={handleFinish}>
                Finish Tour
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
