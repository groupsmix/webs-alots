interface PageErrorProps {
  message?: string;
  details?: string | null;
}

export function PageError({
  message = "Failed to load data. Please try refreshing the page.",
  details,
}: PageErrorProps) {
  return (
    <div className="p-8 text-center">
      <p className="text-red-600 font-medium">{message}</p>
      {details ? <p className="mt-2 text-sm text-muted-foreground">{details}</p> : null}
    </div>
  );
}
