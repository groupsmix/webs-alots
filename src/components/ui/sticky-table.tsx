import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StickyTableProps {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
}

/**
 * Table wrapper with sticky headers that remain visible while scrolling.
 * Uses a scrollable container with CSS sticky positioning.
 */
export function StickyTable({ children, className, maxHeight = "70vh" }: StickyTableProps) {
  return (
    <div
      className={cn("overflow-auto rounded-lg border", className)}
      style={{ maxHeight }}
    >
      <table className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

export function StickyTableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead className={cn("[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted/95 [&_th]:backdrop-blur-sm", className)}>
      {children}
    </thead>
  );
}

export function StickyTableRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/50", className)}>{children}</tr>;
}

export function StickyTableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn("h-10 px-4 text-left align-middle font-medium text-muted-foreground border-b", className)}>
      {children}
    </th>
  );
}

export function StickyTableCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn("px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

export function StickyTableBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>;
}
