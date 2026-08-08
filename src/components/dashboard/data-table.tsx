"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableAction<T> {
  label: string;
  onClick: (row: T) => void;
  destructive?: boolean;
}

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortFn?: (a: T, b: T) => number;
  className?: string;
  headClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor: (row: T) => string;
  rowActions?: (row: T) => DataTableAction<T>[];
  onRowClick?: (row: T) => void;
  pageSize?: number;
  ariaLabel?: string;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  rowActions,
  onRowClick,
  pageSize = 10,
  ariaLabel = "Data table",
  className,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(0);

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;
    if (sortColumn === column.id) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column.id);
      setSortDirection("asc");
    }
    setPage(0);
  };

  const sortedData = React.useMemo(() => {
    if (!sortColumn) return data;
    const column = columns.find((c) => c.id === sortColumn);
    if (!column?.sortable) return data;
    const sorted = [...data];
    const sortFn = column.sortFn;
    if (sortFn) {
      sorted.sort((a, b) => sortFn(a, b) * (sortDirection === "asc" ? 1 : -1));
      return sorted;
    }
    sorted.sort((a, b) => {
      const aVal = String(column.cell(a) ?? "");
      const bVal = String(column.cell(b) ?? "");
      return aVal.localeCompare(bVal) * (sortDirection === "asc" ? 1 : -1);
    });
    return sorted;
  }, [data, sortColumn, columns, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageData = sortedData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border bg-card shadow-sm">
        <Table aria-label={ariaLabel}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id} className={cn(column.headClassName)}>
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className="flex items-center gap-1 font-medium hover:text-foreground"
                      aria-label={`Sort by ${column.header}`}
                    >
                      {column.header}
                      <span
                        className={cn(
                          "inline-block h-3 w-3 transition-opacity",
                          sortColumn === column.id ? "opacity-100" : "opacity-40",
                        )}
                        aria-hidden="true"
                      >
                        {sortColumn === column.id && sortDirection === "desc" ? "↓" : "↑"}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
              {!!rowActions && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map((row) => {
              const actions = rowActions?.(row) ?? [];
              return (
                <TableRow
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className={cn(column.className)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {!!rowActions && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {actions.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Row actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {actions.map((action, idx) => (
                              <DropdownMenuItem
                                key={idx}
                                onClick={() => action.onClick(row)}
                                className={cn(action.destructive && "text-destructive")}
                              >
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {sortedData.length > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, sortedData.length)} of{" "}
            {sortedData.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={pageIndex >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
