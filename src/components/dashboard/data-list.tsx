"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DataListColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  primary?: boolean;
}

export interface DataListAction<T> {
  label: string;
  onClick: (row: T) => void;
  destructive?: boolean;
}

interface DataListProps<T> {
  data: T[];
  columns: DataListColumn<T>[];
  keyExtractor: (row: T) => string;
  rowActions?: (row: T) => DataListAction<T>[];
  onRowClick?: (row: T) => void;
  pageSize?: number;
  ariaLabel?: string;
  className?: string;
}

export function DataList<T>({
  data,
  columns,
  keyExtractor,
  rowActions,
  onRowClick,
  pageSize = 10,
  ariaLabel = "Data list",
  className,
}: DataListProps<T>) {
  const [page, setPage] = React.useState(0);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageData = data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const primaryColumn = columns.find((c) => c.primary) ?? columns[0];
  const detailColumns = columns.filter((c) => c.id !== primaryColumn?.id);

  return (
    <div className={cn("space-y-4", className)} aria-label={ariaLabel}>
      <ul className="grid gap-4" role="list">
        {pageData.map((row) => {
          const actions = rowActions?.(row) ?? [];
          return (
            <li key={keyExtractor(row)}>
              <Card
                className={cn(
                  "overflow-hidden",
                  onRowClick && "cursor-pointer transition-colors hover:bg-muted/30",
                )}
                onClick={() => onRowClick?.(row)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {primaryColumn && (
                        <div className="text-start font-medium text-foreground">
                          {primaryColumn.cell(row)}
                        </div>
                      )}
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                        {detailColumns.map((column) => (
                          <div key={column.id} className="min-w-0">
                            <dt className="text-xs text-muted-foreground">{column.header}</dt>
                            <dd className="truncate text-sm text-foreground">{column.cell(row)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    {rowActions && actions.length > 0 && (
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
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {data.length > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, data.length)} of{" "}
            {data.length}
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
