"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTenantClient } from "@/lib/supabase-server";

export interface ChannelStat {
  channel: string;
  patientCount: number;
  totalSpend: number;
  costPerPatient: number;
}

export interface AcquisitionSummary {
  totalPatients: number;
  trackedPatients: number;
  untrackedPatients: number;
  totalMarketingSpend: number;
  overallCostPerPatient: number;
}

export interface PatientAcquisitionView {
  channels: ChannelStat[];
  summary: AcquisitionSummary;
}

interface AcquisitionRow {
  channel: string;
}

interface CampaignRow {
  channel: string;
  spend: number;
}

interface PatientRow {
  id: string;
  created_at: string;
}

export async function fetchPatientAcquisition(clinicId: string): Promise<PatientAcquisitionView> {
  const supabase = await createTenantClient(clinicId);
  const untyped = supabase as unknown as SupabaseClient;

  const [channelsRes, campaignsRes, patientsRes] = await Promise.all([
    untyped.from("patient_acquisition_channels").select("*").eq("clinic_id", clinicId),
    untyped
      .from("marketing_campaigns")
      .select("id, name, channel, spend, budget, status")
      .eq("clinic_id", clinicId),
    supabase.from("users").select("id, created_at").eq("clinic_id", clinicId).eq("role", "patient"),
  ]);

  if (channelsRes.error)
    throw new Error(`Failed to load acquisition channels: ${channelsRes.error.message}`);
  if (campaignsRes.error)
    throw new Error(`Failed to load campaigns: ${campaignsRes.error.message}`);
  if (patientsRes.error) throw new Error(`Failed to load patients: ${patientsRes.error.message}`);

  const channels = ((channelsRes.data ?? []) as unknown as AcquisitionRow[]).map((row) => ({
    channel: row.channel,
  }));
  const campaigns = ((campaignsRes.data ?? []) as unknown as CampaignRow[]).map((row) => ({
    channel: row.channel,
    spend: row.spend,
  }));
  const patients = (patientsRes.data ?? []) as unknown as PatientRow[];

  const channelBreakdown: Record<string, { count: number; spend: number }> = {};
  const channelTypes = [
    "whatsapp",
    "google",
    "facebook",
    "instagram",
    "referral",
    "walk_in",
    "website",
    "other",
  ];

  for (const ch of channelTypes) {
    channelBreakdown[ch] = { count: 0, spend: 0 };
  }

  for (const acq of channels) {
    const ch = acq.channel;
    if (channelBreakdown[ch]) {
      channelBreakdown[ch].count += 1;
    }
  }

  for (const camp of campaigns) {
    const ch = camp.channel;
    if (channelBreakdown[ch]) {
      channelBreakdown[ch].spend += typeof camp.spend === "number" ? camp.spend : 0;
    }
  }

  const channelStats = Object.entries(channelBreakdown).map(([channel, stats]) => ({
    channel,
    patientCount: stats.count,
    totalSpend: stats.spend,
    costPerPatient: stats.count > 0 ? Math.round(stats.spend / stats.count) : 0,
  }));

  const totalSpend = channelStats.reduce((sum, c) => sum + c.totalSpend, 0);
  const totalTrackedPatients = channelStats.reduce((sum, c) => sum + c.patientCount, 0);
  const overallCostPerPatient =
    totalTrackedPatients > 0 ? Math.round(totalSpend / totalTrackedPatients) : 0;

  return {
    channels: channelStats,
    summary: {
      totalPatients: patients.length,
      trackedPatients: totalTrackedPatients,
      untrackedPatients: patients.length - totalTrackedPatients,
      totalMarketingSpend: totalSpend,
      overallCostPerPatient,
    },
  };
}
