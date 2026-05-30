/**
 * Supabase Realtime utilities.
 *
 * Provides a reusable hook for subscribing to Postgres table changes.
 * No connections are created until a component actually subscribes —
 * zero overhead when not in use.
 *
 * Usage:
 *   const { data } = useRealtimeSubscription<Appointment>({
 *     table: "appointments",
 *     event: "INSERT",
 *     filter: `clinic_id=eq.${clinicId}`,
 *     onRecord: (record) => { ... },
 *   });
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase-client";

// ── Types ──

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface RealtimeSubscriptionOptions<T extends Record<string, unknown>> {
  /** Postgres table name to subscribe to */
  table: string;
  /** Schema (defaults to "public") */
  schema?: string;
  /** Event type to listen for (* = all) */
  event?: RealtimeEvent;
  /** Optional Postgres filter (e.g. "clinic_id=eq.abc-123") */
  filter?: string;
  /** Called when a matching event fires */
  onRecord?: (payload: RealtimePostgresChangesPayload<T>) => void;
  /** Whether the subscription is active (defaults to true) */
  enabled?: boolean;
}

interface RealtimeSubscriptionResult {
  /** Current connection status */
  status: "connecting" | "connected" | "disconnected" | "error";
  /** Manually unsubscribe */
  unsubscribe: () => void;
}

// ── Hook ──

/**
 * Subscribe to Supabase Realtime Postgres changes.
 *
 * Automatically manages the channel lifecycle — subscribes on mount,
 * unsubscribes on unmount. Does nothing if `enabled` is false.
 *
 * Every subscription is scoped to a single table + optional filter,
 * which keeps it tenant-safe when you pass `clinic_id=eq.${clinicId}`.
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>(
  options: RealtimeSubscriptionOptions<T>,
): RealtimeSubscriptionResult {
  const { table, schema = "public", event = "*", filter, onRecord, enabled = true } = options;
  const [status, setStatus] = useState<RealtimeSubscriptionResult["status"]>("disconnected");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRecordRef = useRef(onRecord);

  // Keep callback ref up to date without re-subscribing
  useEffect(() => {
    onRecordRef.current = onRecord;
  }, [onRecord]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const supabase = createClient();
    const channelName = `realtime:${schema}:${table}:${event}:${filter ?? "all"}`;

    // Build the channel config
    const channelConfig: {
      event: RealtimeEvent;
      schema: string;
      table: string;
      filter?: string;
    } = { event, schema, table };

    if (filter) {
      channelConfig.filter = filter;
    }

    // Status updates happen in the subscribe callback (not synchronously)
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as "system",
        channelConfig as unknown as { event: string },
        (payload: unknown) => {
          onRecordRef.current?.(payload as RealtimePostgresChangesPayload<T>);
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          setStatus("connected");
        } else if (subscriptionStatus === "CLOSED") {
          setStatus("disconnected");
        } else if (subscriptionStatus === "CHANNEL_ERROR") {
          setStatus("error");
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, schema, event, filter, enabled, unsubscribe]);

  return { status, unsubscribe };
}

// ── Pre-defined channel configs ──
// These are ready-to-use configs for tables that will need Realtime.
// Components just import and spread:
//
//   useRealtimeSubscription({ ...REALTIME_CHANNELS.appointments, filter: `clinic_id=eq.${id}` })

export const REALTIME_CHANNELS = {
  /** Live appointment updates (new bookings, cancellations, reschedules) */
  appointments: {
    table: "appointments",
    event: "*" as RealtimeEvent,
  },
  /** New support messages / ticket updates */
  supportTickets: {
    table: "support_tickets",
    event: "*" as RealtimeEvent,
  },
  /** In-app notification count updates */
  notifications: {
    table: "notifications",
    event: "INSERT" as RealtimeEvent,
  },
  /** WhatsApp message inbox */
  whatsappMessages: {
    table: "whatsapp_messages",
    event: "INSERT" as RealtimeEvent,
  },
  /** AI usage log updates (for live usage dashboard) */
  aiUsageLogs: {
    table: "ai_usage_logs",
    event: "INSERT" as RealtimeEvent,
  },
  /** Patient check-in / waiting room status */
  waitingRoom: {
    table: "waiting_room",
    event: "*" as RealtimeEvent,
  },
} as const;
