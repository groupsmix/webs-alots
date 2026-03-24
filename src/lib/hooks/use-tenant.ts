"use client";

/**
 * Client-side tenant hook.
 *
 * Resolves the current clinic_id from the authenticated user's profile.
 * This replaces all client-side usage of `clinicConfig.clinicId` for
 * database queries, ensuring multi-tenant isolation.
 *
 * Usage:
 *   const { clinicId, isLoading } = useTenant();
 */

import { useState, useEffect } from "react";
import { getCurrentUser } from "@/lib/data/client";

interface TenantState {
  clinicId: string | null;
  isLoading: boolean;
}

/**
 * Returns the current user's clinic_id from their authenticated profile.
 * Falls back to null if not authenticated or profile has no clinic_id.
 */
export function useTenant(): TenantState {
  const [state, setState] = useState<TenantState>({
    clinicId: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const user = await getCurrentUser();
        if (!cancelled) {
          setState({
            clinicId: user?.clinic_id ?? null,
            isLoading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ clinicId: null, isLoading: false });
        }
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
