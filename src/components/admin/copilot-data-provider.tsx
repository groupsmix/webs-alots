"use client";

import { useCopilotReadable } from "@copilotkit/react-core";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

interface ClinicSummary {
  id: string;
  name: string;
  subdomain: string;
  status: "active" | "trial" | "suspended" | "pending_kyc";
  tier: string;
  city: string;
  created_at: string;
}

interface DashboardStats {
  total_clinics: number;
  active_clinics: number;
  pending_kyc: number;
  suspended: number;
  mrr_mad: number;
}

interface CopilotDataProviderProps {
  children: React.ReactNode;
}

export function CopilotDataProvider({ children }: CopilotDataProviderProps) {
  const supabase = createClient();
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: clinicData } = await supabase
          .from("clinics")
          .select("id, name, subdomain, status, tier, city, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (clinicData) setClinics(clinicData as ClinicSummary[]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: statsData } = await (supabase as any)
          .rpc("get_super_admin_dashboard_stats")
          .single();
        if (statsData) setStats(statsData);
      } catch (err) {
        console.error("[CopilotDataProvider] Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useCopilotReadable({
    description: "List of all clinics on the platform with their current status and tier",
    value: loading ? "Loading..." : JSON.stringify(clinics),
  });

  useCopilotReadable({
    description: "Aggregated platform statistics: total clinics, active, pending KYC, MRR in MAD",
    value: loading ? "Loading..." : JSON.stringify(stats),
  });

  return <>{children}</>;
}
