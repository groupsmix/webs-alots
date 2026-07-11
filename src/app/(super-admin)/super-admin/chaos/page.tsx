"use client";

import { PlayCircle, StopCircle, Activity } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  category: "database" | "api" | "external";
  probability: number;
}

const EXPERIMENTS: ChaosExperiment[] = [
  {
    id: "database_timeout",
    name: "Database Timeout",
    description: "Simulate 5-second database query delays",
    category: "database",
    probability: 0.1,
  },
  {
    id: "database_error",
    name: "Database Error",
    description: "Simulate connection failures",
    category: "database",
    probability: 0.05,
  },
  {
    id: "api_latency",
    name: "API Latency",
    description: "Add 2-second delays to API responses",
    category: "api",
    probability: 0.15,
  },
  {
    id: "api_error",
    name: "API Error",
    description: "Return random 503 errors",
    category: "api",
    probability: 0.1,
  },
  {
    id: "external_api_timeout",
    name: "External API Timeout",
    description: "Simulate slow Stripe/WhatsApp APIs",
    category: "external",
    probability: 0.1,
  },
  {
    id: "external_api_error",
    name: "External API Error",
    description: "Simulate external service failures",
    category: "external",
    probability: 0.1,
  },
];

export default function ChaosEngineeringPage() {
  const { addToast } = useToast();
  const [chaosEnabled, setChaosEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggleChaos() {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/chaos/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !chaosEnabled }),
      });

      if (!res.ok) throw new Error("Failed to toggle chaos");

      setChaosEnabled(!chaosEnabled);
      addToast(chaosEnabled ? "Chaos experiments stopped" : "Chaos experiments started", "success");
    } catch (_err) {
      addToast("Failed to toggle chaos mode", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Chaos Engineering" },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Chaos Engineering</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test system resilience under failure conditions
          </p>
        </div>
        <Button
          variant={chaosEnabled ? "destructive" : "default"}
          onClick={toggleChaos}
          disabled={loading}
        >
          {chaosEnabled ? (
            <>
              <StopCircle className="h-4 w-4 mr-2" />
              Stop Chaos
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4 mr-2" />
              Start Chaos
            </>
          )}
        </Button>
      </div>

      {chaosEnabled && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-destructive animate-pulse" />
            <p className="text-sm font-medium text-destructive">
              Chaos experiments are active — expect random failures!
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {["database", "api", "external"].map((category) => {
          const experiments = EXPERIMENTS.filter((e) => e.category === category);
          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base capitalize">{category} Experiments</CardTitle>
                <CardDescription>{experiments.length} experiments configured</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {experiments.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-start justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{exp.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{exp.description}</p>
                      <Badge variant="outline" className="text-[10px] mt-2">
                        {exp.probability * 100}% probability
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Chaos Engineering Runbook</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol>
            <li>Enable chaos experiments in staging environment</li>
            <li>
              Run smoke tests to trigger failures: <code>npm run test:e2e</code>
            </li>
            <li>Monitor Sentry for chaos-induced errors</li>
            <li>Verify graceful degradation (no user-facing crashes)</li>
            <li>Document failure modes and recovery behavior</li>
            <li>Disable chaos when testing complete</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
