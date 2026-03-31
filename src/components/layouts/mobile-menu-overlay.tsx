"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * A11Y-01: Accessible mobile menu overlay with Escape-key dismissal and focus
 * trapping so keyboard-only and screen-reader users can interact properly.
 */
export function MobileMenuOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Focus trap: keep Tab cycling within the overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // Focus the first focusable element inside the panel
    const firstFocusable = overlay.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !overlay) return;

      const focusable = Array.from(overlay.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="absolute left-0 top-0 bottom-0 w-64 bg-card p-4 shadow-lg overflow-y-auto flex flex-col">
        {children}
      </div>
    </div>
  );
}
