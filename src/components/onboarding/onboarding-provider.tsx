"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  fetchOnboardingState,
  autoDetectCompletedSteps,
  updateOnboardingState,
  markStepComplete,
  type OnboardingState,
  type OnboardingStepId,
} from "@/lib/data/client/onboarding";
import { getCurrentUser } from "@/lib/data/client";

interface OnboardingContextValue {
  state: OnboardingState | null;
  loading: boolean;
  showTour: boolean;
  setShowTour: (show: boolean) => void;
  markComplete: (stepId: OnboardingStepId) => void;
  dismiss: () => void;
  reshow: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  state: null,
  loading: true,
  showTour: false,
  setShowTour: () => {},
  markComplete: () => {},
  dismiss: () => {},
  reshow: () => {},
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function init() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id || user.role !== "clinic_admin") {
        setLoading(false);
        return;
      }

      const onboardingState = await fetchOnboardingState();
      if (controller.signal.aborted) return;

      // Auto-detect completed steps on first visit
      if (!onboardingState.hasCompletedOnboarding && onboardingState.completedSteps.length === 0) {
        const detected = await autoDetectCompletedSteps(user.clinic_id);
        if (controller.signal.aborted) return;
        if (detected.length > 0) {
          onboardingState.completedSteps = detected;
          await updateOnboardingState({ completedSteps: detected });
        }
      }

      setState(onboardingState);

      // Show tour on first login (not dismissed and not completed)
      if (!onboardingState.tourDismissed && !onboardingState.hasCompletedOnboarding) {
        setShowTour(true);
      }

      setLoading(false);
    }
    init().catch(() => setLoading(false));
    return () => { controller.abort(); };
  }, []);

  const markComplete = useCallback((stepId: OnboardingStepId) => {
    setState((prev) => {
      if (!prev) return prev;
      if (prev.completedSteps.includes(stepId)) return prev;
      const completedSteps = [...prev.completedSteps, stepId];
      // Persist to database so progress survives refresh / browser switch (issue #20)
      void markStepComplete(stepId);
      return { ...prev, completedSteps };
    });
  }, []);

  const dismiss = useCallback(() => {
    setShowTour(false);
    setState((prev) => (prev ? { ...prev, tourDismissed: true } : prev));
    // Persist dismissal so it survives page refresh (issue #20)
    void updateOnboardingState({ tourDismissed: true });
  }, []);

  const reshow = useCallback(() => {
    setShowTour(true);
    setState((prev) => (prev ? { ...prev, tourDismissed: false } : prev));
    void updateOnboardingState({ tourDismissed: false });
  }, []);

  return (
    <OnboardingContext value={{
      state,
      loading,
      showTour,
      setShowTour,
      markComplete,
      dismiss,
      reshow,
    }}>
      {children}
    </OnboardingContext>
  );
}
