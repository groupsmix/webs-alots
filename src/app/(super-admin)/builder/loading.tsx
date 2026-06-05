import { Loader2, Sparkles } from "lucide-react";

export default function BuilderLoading() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="relative">
          <Sparkles className="w-8 h-8 opacity-30" />
          <Loader2 className="w-4 h-4 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <p className="text-sm">Loading AI Builder...</p>
      </div>
    </div>
  );
}
