import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/data/server";

export function SetupChecklistWidget({ stats }: { stats: DashboardStats }) {
  const hasDoctors = stats.doctorCount > 0;
  // Basic heuristic for setup: if they have doctors, they've done some setup.
  // We can expand this with services, schedule, etc. if available in stats.
  const isSetupComplete = hasDoctors; // We can refine this later

  if (isSetupComplete) return null;

  return (
    <Card className="mb-8 border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Complete your clinic setup
        </CardTitle>
        <CardDescription>
          Finish onboarding to start accepting bookings and managing your clinic.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {hasDoctors ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
            <span className={hasDoctors ? "text-muted-foreground line-through" : "font-medium"}>
              Add your first doctor and services
            </span>
          </div>
          
          <div className="pt-2">
            <Link href="/admin/onboarding">
              <Button size="sm">
                Continue Setup
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
