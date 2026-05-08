"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseAsyncDataResult<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for data fetching with AbortController support.
 *
 * Provides:
 * - Automatic request cancellation on unmount via AbortController
 * - Loading and error state management
 * - A `refetch` callback for manual re-fetching
 *
 * For fetch() calls, pass the signal to abort the network request:
 *   useAsyncData((signal) => fetch(url, { signal }).then(r => r.json()), [])
 *
 * For Supabase/async calls, the signal is used to prevent state updates after unmount:
 *   useAsyncData(() => fetchDoctors(clinicId), [], [])
 */
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  initialData: T,
  deps: React.DependencyList = [],
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const runFetch = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    return runFetch();
  }, [runFetch]);

  const refetch = useCallback(() => {
    runFetch();
  }, [runFetch]);

  return { data, loading, error, refetch };
}
