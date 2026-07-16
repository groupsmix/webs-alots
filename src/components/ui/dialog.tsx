"use client";

import { X } from "lucide-react";
import * as React from "react";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, children }: DialogProps) {
  return <>{open ? children : null}</>;
}

interface DialogTriggerProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  asChild?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

function DialogTrigger({ children, asChild, onClick, ...props }: DialogTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      ...props,
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        (children.props as { onClick?: React.MouseEventHandler<HTMLElement> }).onClick?.(e);
        onClick?.(e);
      },
    });
  }
  return (
    <button
      type="button"
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement> | undefined}
      {...props}
    >
      {children}
    </button>
  );
}

function DialogOverlay({ className, onClick, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="presentation"
      className={cn("fixed inset-0 z-50 bg-black/80 animate-in fade-in-0", className)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter") {
          onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  onClose,
  ...props
}: React.ComponentProps<"div"> & { onClose?: () => void }) {
  const [locale] = useLocale();
  const closeLabel = t(locale, "action.close");
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Keep the latest onClose in a ref so the focus-trap effect below can run
  // once on mount instead of re-running (and re-stealing focus) on every
  // render when callers pass an inline `onClose={() => ...}`.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus management: trap focus inside modal and restore on close
  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // Store previously focused element to restore on close
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus first focusable element inside the dialog
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      el.focus();
    }

    // Trap focus within dialog
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab" || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
    // Mount-only: the dialog mounts when opened and unmounts when closed, so
    // running this once per mount is correct. The latest onClose is read via
    // onCloseRef, so no reactive dependency is needed here.
  }, []);

  return (
    <>
      <DialogOverlay onClick={onClose} />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border bg-background p-6 shadow-lg rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        {onClose && (
          <button
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{closeLabel}</span>
          </button>
        )}
      </div>
    </>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-start", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
