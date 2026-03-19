"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuProps {
  children: React.ReactNode
}

function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      {React.Children.map(children, (child) => {
        if (React.isValidElement<DropdownMenuTriggerProps>(child) && child.type === DropdownMenuTrigger) {
          return React.cloneElement(child, { onClick: () => setOpen(!open) })
        }
        if (React.isValidElement(child) && child.type === DropdownMenuContent) {
          return open ? React.cloneElement(child, { onClose: () => setOpen(false) } as Record<string, unknown>) : null
        }
        return child
      })}
    </div>
  )
}

interface DropdownMenuTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean
}

function DropdownMenuTrigger({ className, children, asChild, ...props }: DropdownMenuTriggerProps) {
  return (
    <button type="button" className={cn("outline-none", className)} {...props}>
      {children}
    </button>
  )
}

function DropdownMenuContent({
  className,
  children,
  align = "end",
  onClose,
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end"; onClose?: () => void }) {
  return (
    <div
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        align === "end" ? "right-0" : "left-0",
        "top-full mt-1",
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === DropdownMenuItem) {
          return React.cloneElement(child, { onClose } as Record<string, unknown>)
        }
        return child
      })}
    </div>
  )
}

function DropdownMenuItem({
  className,
  children,
  onClick,
  onClose,
  ...props
}: React.ComponentProps<"div"> & { onClose?: () => void }) {
  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
      onClick={(e) => {
        onClick?.(e)
        onClose?.()
      }}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
}
