"use client";

import type { TimelineEventType } from "@/lib/validations/patient-timeline";
import { createClient } from "./_core";

export interface TimelineEvent {
  id: string;
  event_type: TimelineEventType;
  event_date: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TimelinePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  pagination: TimelinePagination;
}

export async function fetchPatientTimeline(params: {
  patientId: string;
  eventType?: TimelineEventType;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<TimelineResponse> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const searchParams = new URLSearchParams();
  searchParams.set("patientId", params.patientId);
  if (params.eventType) searchParams.set("eventType", params.eventType);
  if (params.search) searchParams.set("search", params.search);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));

  const res = await fetch(`/api/patient/timeline?${searchParams.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error ?? "Failed to fetch timeline");
  }

  return json.data as TimelineResponse;
}
