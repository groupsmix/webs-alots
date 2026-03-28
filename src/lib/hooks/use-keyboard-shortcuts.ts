"use client";

import { useEffect, useCallback } from "react";

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

/**
 * Register keyboard shortcuts for navigation and actions.
 * Shortcuts are disabled when focus is inside an input/textarea/select.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable) {
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
