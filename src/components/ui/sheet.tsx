"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Sheet({ open, children }: SheetProps) {
  if (!open) return null
  return <>{children}</>
}

function SheetTrigger({ children, onClick, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  return <button type="button" onClick={onClick} {...props}>{children}</button>
}

function SheetContent({
  className,
  children,
  side = "right",
  onClose,
  ...props
}: React.ComponentProps<"div"> & { side?: "left" | "right"; onClose?: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80" onClick={onClose} />
      <div
        className={cn(
          "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out",
          side === "left" ? "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r" : "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l",
          className
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-lg font-semibold text-foreground", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription }
