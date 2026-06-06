"use client";

import { CheckCircle2, Loader2, Wrench, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ToolCallProps {
  name: string;
  state?: "running" | "success" | "error";
  description?: string;
  className?: string;
}

export function ToolCall({ name, state = "running", description, className }: ToolCallProps) {
  const icon =
    state === "running" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : state === "success" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : (
      <XCircle className="h-3.5 w-3.5" />
    );

  return (
    <div className={cn("rounded-lg border bg-muted/40 p-2 text-xs", className)}>
      <div className="flex items-center gap-2">
        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{name}</span>
        <Badge
          variant={state === "error" ? "destructive" : "secondary"}
          className="ml-auto text-[10px]"
        >
          <span className="mr-1">{icon}</span>
          {state}
        </Badge>
      </div>
      {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
