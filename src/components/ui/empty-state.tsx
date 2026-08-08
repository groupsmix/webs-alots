type LucideIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "default" | "plain";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const iconEl =
    variant === "plain" ? (
      <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
    ) : (
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      </div>
    );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        variant === "plain" && "py-8",
        className,
      )}
    >
      {iconEl}
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
