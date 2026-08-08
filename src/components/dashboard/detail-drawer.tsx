"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  ariaLabel,
}: DetailDrawerProps) {
  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open}>
      <DialogOverlay onClick={handleClose} />
      <DialogContent
        onClose={handleClose}
        aria-label={ariaLabel ?? (typeof title === "string" ? title : "Detail panel")}
        className={cn(
          "fixed left-auto right-0 top-0 h-full w-full max-w-full translate-x-0 translate-y-0 rounded-none border-0 bg-card p-0 shadow-xl sm:max-w-xl sm:border-l sm:rounded-l-lg",
          className,
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b px-6 py-5">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-start">
              {title}
            </h2>
            {description && (
              <div className="mt-1.5 text-sm text-muted-foreground text-start">{description}</div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="border-t px-6 py-4">{footer}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
