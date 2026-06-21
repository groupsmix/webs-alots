"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  children: React.ReactNode;
}

function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      {React.Children.map(children, (child) => {
        if (
          React.isValidElement<DropdownMenuTriggerProps>(child) &&
          child.type === DropdownMenuTrigger
        ) {
          return React.cloneElement(child, { onClick: () => setOpen(!open) });
        }
        if (React.isValidElement(child) && child.type === DropdownMenuContent) {
          return open
            ? React.cloneElement(child, { onClose: () => setOpen(false) } as {
                onClose: () => void;
              })
            : null;
        }
        return child;
      })}
    </div>
  );
}

interface DropdownMenuTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

function DropdownMenuTrigger({ className, children, asChild, ...props }: DropdownMenuTriggerProps) {
  // When `asChild` is set, merge the trigger's props (including the open/close
  // onClick injected by <DropdownMenu>) onto the single child element instead
  // of rendering our own <button>. Rendering a <button> here while the caller
  // also passes a <button> child produces invalid nested <button><button>
  // markup, which the browser reparents on hydration and triggers React #418
  // (hydration mismatch) on every page using this trigger.
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;
    return React.cloneElement(child, {
      ...props,
      className: cn(child.props.className, className),
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        child.props.onClick?.(e);
        props.onClick?.(e);
      },
    });
  }
  return (
    <button type="button" className={cn("outline-none", className)} {...props}>
      {children}
    </button>
  );
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
        className,
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === DropdownMenuItem) {
          return React.cloneElement(child, { onClose } as { onClose?: () => void });
        }
        return child;
      })}
    </div>
  );
}

function DropdownMenuItem({
  className,
  children,
  onClick,
  onClose,
  disabled,
  ...props
}: React.ComponentProps<"div"> & { onClose?: () => void; disabled?: boolean }) {
  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      onClick={(e) => {
        if (!disabled) {
          onClick?.(e);
          onClose?.();
        }
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
          onClose?.();
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />;
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
