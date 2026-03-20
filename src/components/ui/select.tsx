"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

function Select({ value, onValueChange, children }: SelectProps) {
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
    <div ref={ref} className="relative">
      {React.Children.map(children, (child) => {
        if (React.isValidElement<SelectTriggerProps>(child) && child.type === SelectTrigger) {
          return React.cloneElement(child, { onClick: () => setOpen(!open), value })
        }
        if (React.isValidElement<SelectContentProps>(child) && child.type === SelectContent) {
          return open
            ? React.cloneElement(child, {
                onValueChange: (v: string) => {
                  onValueChange?.(v)
                  setOpen(false)
                },
                currentValue: value,
              })
            : null
        }
        return child
      })}
    </div>
  )
}

interface SelectTriggerProps extends React.ComponentProps<"button"> {
  value?: string
}

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
}

function SelectValue({ placeholder, value }: { placeholder?: string; value?: string }) {
  return <span className={value ? "" : "text-muted-foreground"}>{value || placeholder}</span>
}

interface SelectContentProps extends React.ComponentProps<"div"> {
  onValueChange?: (value: string) => void
  currentValue?: string
}

function SelectContent({ className, children, onValueChange, currentValue, ...props }: SelectContentProps) {
  return (
    <div
      className={cn(
        "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement<SelectItemProps>(child) && child.type === SelectItem) {
          return React.cloneElement(child, {
            onSelect: () => onValueChange?.(child.props.value),
            isSelected: currentValue === child.props.value,
          })
        }
        return child
      })}
    </div>
  )
}

interface SelectItemProps extends React.ComponentProps<"div"> {
  value: string
  onSelect?: () => void
  isSelected?: boolean
}

function SelectItem({ className, children, onSelect, isSelected, ...props }: SelectItemProps) {
  return (
    <div
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground",
        className
      )}
      onClick={onSelect}
      {...props}
    >
      {children}
    </div>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
