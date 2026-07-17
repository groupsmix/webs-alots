"use client";

import { Apple, Users, Scale, Calculator, Calendar, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTenant } from "@/components/tenant-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchMealPlans, fetchBodyMeasurements } from "@/lib/data/client";
import type { MealPlan, BodyMeasurement } from "@/lib/types/para-medical";

const PRIMARY_ACTION_LABEL = "Create meal plan";

function withinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return false;
  return Date.now() - d <= days * 24 * 60 * 60 * 1000;
}

export default function NutritionistDashboardPage() {
  const tenant = useTenant();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cId = tenant?.clinicId ?? "";
    Promise.all([fetchMealPlans(cId), fetchBodyMeasurements(cId)])
      .then(([plans, meas]) => {
        if (!controller.signal.aborted) {
          setMealPlans(plans);
          setMeasurements(meas);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e as Error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [tenant?.clinicId]);

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">
          Failed to load data. Please try refreshing the page.
        </p>
      </div>
    );
  }

  const activePlans = mealPlans.filter((p) => p.status === "active");
  const activePatients = new Set(activePlans.map((p) => p.patient_id)).size;
  const measurementsThisWeek = measurements.filter((m) => withinDays(m.measurement_date, 7)).length;
  const bmiAssessments = measurements.filter((m) => m.bmi != null).length;

  const stats = [
    { icon: Users, label: "Active Patients", value: activePatients, color: "text-blue-600" },
    { icon: Apple, label: "Active Meal Plans", value: activePlans.length, color: "text-green-600" },
    {
      icon: Scale,
      label: "Measurements This Week",
      value: measurementsThisWeek,
      color: "text-orange-600",
    },
    { icon: Calculator, label: "BMI Assessments", value: bmiAssessments, color: "text-purple-600" },
  ];

  const recentMeasurements = [...measurements]
    .sort((a, b) => (a.measurement_date < b.measurement_date ? 1 : -1))
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Nutritionist Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Nutritionniste — أخصائي تغذية</p>
        </div>
        <Link href="/nutritionist/meal-plans" className="shrink-0">
          <Button size="lg">
            <Apple className="h-4 w-4 me-2" />
            {PRIMARY_ACTION_LABEL}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Active Meal Plans
            </CardTitle>
            <Link href="/nutritionist/meal-plans" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {activePlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active meal plans yet.</p>
            ) : (
              <div className="space-y-3">
                {activePlans.slice(0, 5).map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{plan.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{plan.patient_name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {plan.target_calories} kcal
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recent Measurements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentMeasurements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent data to display.</p>
            ) : (
              <div className="space-y-3">
                {recentMeasurements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm">{m.measurement_date}</span>
                    <span className="text-sm text-muted-foreground">
                      {m.weight_kg != null ? `${m.weight_kg} kg` : "—"}
                      {m.bmi != null ? ` · BMI ${m.bmi}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
