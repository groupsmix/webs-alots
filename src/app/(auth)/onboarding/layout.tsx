import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>
      <div className="flex justify-center p-4 pt-8">
        <div className="w-full max-w-4xl">{children}</div>
      </div>
    </div>
  );
}
