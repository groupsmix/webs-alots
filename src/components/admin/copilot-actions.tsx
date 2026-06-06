"use client";

import { useCopilotAction } from "@copilotkit/react-core";
import { createClient } from "@/lib/supabase-client";

export function CopilotActions() {
  const supabase = createClient();

  useCopilotAction({
    name: "lookupClinic",
    description: "Look up detailed information about a specific clinic by name or subdomain",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "The clinic name or subdomain to search for",
        required: true,
      },
    ],
    handler: async ({ query }) => {
        // Sanitize: allow only alphanumeric, whitespace, hyphens, dots, and
        // common French/Arabic Latin characters. Strips PostgREST filter
        // injection chars (commas, operators, parentheses, quotes, etc.)
        // before interpolating into the .or() filter string (per SQL Injection
        // guardrail in AGENTS.md). Capped at 100 chars to bound DB work.
        const sanitizedQuery = query
          .replace(/[^a-zA-Z0-9\s\-._àâäèéêëîïôùûüÿæœçÀÂÄÈÉÊËÎÏÔÙÛÜŸÆŒÇ]/g, "")
          .slice(0, 100);
        const { data, error } = await supabase
          .from("clinics")
          .select(`id, name, subdomain, status, tier, city, phone, created_at, users (count)`)
          .or(`name.ilike.%${sanitizedQuery}%,subdomain.ilike.%${sanitizedQuery}%`)
          .limit(5);
      if (error) return `Error looking up clinic: ${error.message}`;
      if (!data || data.length === 0) return `No clinic found matching "${query}"`;
      return JSON.stringify(data, null, 2);
    },
  });

  useCopilotAction({
    name: "getPendingKYCQueue",
    description: "Get the list of clinics waiting for KYC (identity verification) approval",
    parameters: [],
    handler: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name, subdomain, city, created_at")
        .eq("status", "pending_kyc")
        .order("created_at", { ascending: true });
      if (error) return `Error: ${error.message}`;
      if (!data || data.length === 0) return "No clinics pending KYC — queue is empty!";
      return `${data.length} clinics pending KYC:\n${JSON.stringify(data, null, 2)}`;
    },
  });

  useCopilotAction({
    name: "generateClinicReport",
    description: "Generate a plain-text summary report about a clinic to share with the team",
    parameters: [
      { name: "clinicId", type: "string", description: "The clinic UUID", required: true },
    ],
    handler: async ({ clinicId }) => {
      const { data, error } = await supabase
        .from("clinics")
        .select(
          `name, subdomain, status, tier, city, phone, created_at, users (count), appointments (count)`,
        )
        .eq("id", clinicId)
        .single();
      if (error) return `Error: ${error.message}`;
      if (!data) return "Clinic not found";
      return `
CLINIC REPORT — ${new Date().toLocaleDateString("fr-MA")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${data.name}
Subdomain: ${data.subdomain}.oltigo.com
Status: ${data.status}
Tier: ${data.tier}
City: ${data.city}
Phone: ${data.phone}
Created: ${data.created_at ? new Date(data.created_at).toLocaleDateString("fr-MA") : "N/A"}
`.trim();
    },
  });

  return null;
}
