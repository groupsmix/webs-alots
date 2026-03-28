"use client";

import { useState, useCallback } from "react";

type Status = "idle" | "pending" | "success" | "error";

interface OptimisticState<T> {
  data: T;
  status: Status;
  error: string | null;
}

/**
 * Hook for optimistic UI updates.
 * Immediately applies the change locally, then syncs with the server.
 * Rolls back on failure.
 *
 * Usage:
 * ```tsx
 * const { data: appointments, mutate } = useOptimisticUpdate(initialAppointments);
 *
 * async function handleBook(newAppt: Appointment) {
 *   await mutate(
 *     [...appointments, newAppt],           // optimistic value
 *     () => api.bookAppointment(newAppt),    // server call
 *   );
 * }
 * ```
 */
export function useOptimisticUpdate<T>(initialData: T) {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    status: "idle",
    error: null,
  });

  const mutate = useCallback(
    async (
      optimisticData: T,
      serverAction: () => Promise<T | void>,
      options?: { onSuccess?: () => void; onError?: (err: string) => void }
    ) => {
      const previousData = state.data;

      // Apply optimistic update immediately
      setState({ data: optimisticData, status: "pending", error: null });

      try {
        const serverResult = await serverAction();
        // Use server result if returned, otherwise keep optimistic data
        setState({
          data: serverResult !== undefined ? serverResult : optimisticData,
          status: "success",
          error: null,
        });
        options?.onSuccess?.();
      } catch (err) {
        // Roll back to previous data on failure
        const message =
          err instanceof Error ? err.message : "Une erreur est survenue";
        setState({ data: previousData, status: "error", error: message });
        options?.onError?.(message);
      }
    },
    [state.data]
  );

  const reset = useCallback(() => {
    setState((prev) => ({ ...prev, status: "idle", error: null }));
  }, []);

  return {
    data: state.data,
    status: state.status,
    error: state.error,
    isPending: state.status === "pending",
    mutate,
    reset,
  };
}
