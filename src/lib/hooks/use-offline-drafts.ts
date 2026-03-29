"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface DraftMeta {
  savedAt: number;
  synced: boolean;
}

interface DraftEntry<T> {
  data: T;
  meta: DraftMeta;
}

/**
 * Auto-save drafts to localStorage during poor connectivity with sync recovery.
 * Ideal for clinical notes that should not be lost during network issues.
 *
 * Usage:
 * ```tsx
 * const { draft, saveDraft, clearDraft, isSynced, syncDraft } = useOfflineDrafts<string>(
 *   "clinical-note-123",
 *   { autoSaveMs: 5000 }
 * );
 *
 * // Auto-saves every 5s, or manually:
 * saveDraft(noteContent);
 *
 * // When ready to sync:
 * await syncDraft(async (data) => {
 *   await api.saveClinicalNote(noteId, data);
 * });
 * ```
 */
export function useOfflineDrafts<T>(
  key: string,
  options?: {
    /** Auto-save interval in ms (default: disabled) */
    autoSaveMs?: number;
    /** Max age for drafts in ms (default: 24 hours) */
    maxAgeMs?: number;
  }
) {
  const { autoSaveMs, maxAgeMs = 24 * 60 * 60 * 1000 } = options ?? {};
  const storageKey = `offline-draft:${key}`;

  const [draft, setDraft] = useState<T | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;
      const entry: DraftEntry<T> = JSON.parse(stored);
      // Check expiry
      if (Date.now() - entry.meta.savedAt > maxAgeMs) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  });

  const [isSynced, setIsSynced] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return true;
      const entry: DraftEntry<T> = JSON.parse(stored);
      return entry.meta.synced;
    } catch {
      return true;
    }
  });

  const latestDraftRef = useRef<T | null>(draft);
  latestDraftRef.current = draft;

  const saveDraft = useCallback(
    (data: T) => {
      setDraft(data);
      setIsSynced(false);
      try {
        const entry: DraftEntry<T> = {
          data,
          meta: { savedAt: Date.now(), synced: false },
        };
        localStorage.setItem(storageKey, JSON.stringify(entry));
      } catch {
        // localStorage full or unavailable — silently fail
      }
    },
    [storageKey]
  );

  const clearDraft = useCallback(() => {
    setDraft(null);
    setIsSynced(true);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const syncDraft = useCallback(
    async (syncFn: (data: T) => Promise<void>) => {
      const current = latestDraftRef.current;
      if (current === null) return;

      try {
        await syncFn(current);
        // Mark as synced
        setIsSynced(true);
        try {
          const entry: DraftEntry<T> = {
            data: current,
            meta: { savedAt: Date.now(), synced: true },
          };
          localStorage.setItem(storageKey, JSON.stringify(entry));
        } catch {
          // ignore
        }
      } catch {
        // Sync failed — draft remains unsynced for retry
      }
    },
    [storageKey]
  );

  // Auto-save interval
  useEffect(() => {
    if (!autoSaveMs || !latestDraftRef.current) return;

    const interval = setInterval(() => {
      const current = latestDraftRef.current;
      if (current !== null) {
        saveDraft(current);
      }
    }, autoSaveMs);

    return () => clearInterval(interval);
  }, [autoSaveMs, saveDraft]);

  return {
    draft,
    saveDraft,
    clearDraft,
    syncDraft,
    isSynced,
    hasDraft: draft !== null,
  };
}
