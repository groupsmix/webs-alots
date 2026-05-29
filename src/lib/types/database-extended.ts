import type { Json } from "./database";
import { Database as GenDatabase } from "./database";

// ── X-1: Extend the generated `users` Row/Insert/Update with `deletion_requested_at` ──
// The column was added via migration but the auto-generated types were never
// regenerated. This overlay adds it so API routes can stop casting through
// `as unknown as {...}`.

type UsersRowExtended = GenDatabase["public"]["Tables"]["users"]["Row"] & {
  deletion_requested_at: string | null;
};
type UsersInsertExtended = GenDatabase["public"]["Tables"]["users"]["Insert"] & {
  deletion_requested_at?: string | null;
};
type UsersUpdateExtended = GenDatabase["public"]["Tables"]["users"]["Update"] & {
  deletion_requested_at?: string | null;
};

// Define the missing tables that are not in the generated types
type ExtendedDatabase = GenDatabase & {
  public: GenDatabase["public"] & {
    Tables: GenDatabase["public"]["Tables"] & {
      // X-1: Override `users` table with the extended column
      users: {
        Row: UsersRowExtended;
        Insert: UsersInsertExtended;
        Update: UsersUpdateExtended;
        Relationships: GenDatabase["public"]["Tables"]["users"]["Relationships"];
      };
      // X-1: consent_logs table (not in generated types)
      consent_logs: {
        Row: {
          id: string;
          clinic_id: string | null;
          user_id: string | null;
          consent_type: string;
          granted: boolean;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          user_id?: string | null;
          consent_type: string;
          granted: boolean;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          user_id?: string | null;
          consent_type?: string;
          granted?: boolean;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      // X-1: patient_files table (not in generated types)
      patient_files: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          r2_key: string;
          encryption_iv: string | null;
          uploaded_by: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          patient_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          r2_key: string;
          encryption_iv?: string | null;
          uploaded_by?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          patient_id?: string;
          file_name?: string;
          file_type?: string;
          file_size?: number;
          r2_key?: string;
          encryption_iv?: string | null;
          uploaded_by?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      doctor_unavailability: {
        Row: {
          id: string;
          doctor_id: string;
          clinic_id: string;
          start_time: string;
          end_time: string;
          reason: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          clinic_id: string;
          start_time: string;
          end_time: string;
          reason?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          doctor_id?: string;
          clinic_id?: string;
          start_time?: string;
          end_time?: string;
          reason?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      patient_feedback: {
        Row: {
          id: string;
          clinic_id: string;
          appointment_id: string | null;
          patient_id: string;
          doctor_id: string | null;
          rating: number;
          comment: string | null;
          source: string;
          feedback_sent_at: string | null;
          responded_at: string | null;
          google_review_sent: boolean;
          whatsapp_message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          appointment_id?: string | null;
          patient_id: string;
          doctor_id?: string | null;
          rating: number;
          comment?: string | null;
          source?: string;
          feedback_sent_at?: string | null;
          responded_at?: string | null;
          google_review_sent?: boolean;
          whatsapp_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          appointment_id?: string | null;
          patient_id?: string;
          doctor_id?: string | null;
          rating?: number;
          comment?: string | null;
          source?: string;
          feedback_sent_at?: string | null;
          responded_at?: string | null;
          google_review_sent?: boolean;
          whatsapp_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_queue: {
        Row: {
          id: string;
          clinic_id: string;
          channel: "whatsapp" | "email" | "sms" | "in_app";
          recipient: string;
          template_id: string | null;
          payload: unknown;
          status: "pending" | "processing" | "sent" | "failed";
          attempts: number;
          max_attempts: number;
          next_attempt_at: string;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          channel: "whatsapp" | "email" | "sms" | "in_app";
          recipient: string;
          template_id?: string | null;
          payload: unknown;
          status?: "pending" | "processing" | "sent" | "failed";
          attempts?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          channel?: "whatsapp" | "email" | "sms" | "in_app";
          recipient?: string;
          template_id?: string | null;
          payload?: unknown;
          status?: "pending" | "processing" | "sent" | "failed";
          attempts?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      restaurant_orders: {
        Row: {
          id: string;
          clinic_id: string;
          table_number: string | null;
          status: string;
          items: unknown;
          total_amount: number;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          table_number?: string | null;
          status?: string;
          items?: unknown;
          total_amount?: number;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          table_number?: string | null;
          status?: string;
          items?: unknown;
          total_amount?: number;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      // Batch 3B: Custom Domains table
      custom_domains: {
        Row: {
          id: string;
          clinic_id: string;
          domain: string;
          status: string;
          cloudflare_custom_hostname_id: string | null;
          ssl_status: string | null;
          verification_txt: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          domain: string;
          status?: string;
          cloudflare_custom_hostname_id?: string | null;
          ssl_status?: string | null;
          verification_txt?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          domain?: string;
          status?: string;
          cloudflare_custom_hostname_id?: string | null;
          ssl_status?: string | null;
          verification_txt?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      // Batch 3B: Referrals table
      referrals: {
        Row: {
          id: string;
          clinic_id: string;
          referring_doctor_id: string;
          referred_to_doctor_id: string;
          patient_id: string;
          reason: string | null;
          notes: string | null;
          status: string;
          whatsapp_notified: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          referring_doctor_id: string;
          referred_to_doctor_id: string;
          patient_id: string;
          reason?: string | null;
          notes?: string | null;
          status?: string;
          whatsapp_notified?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          referring_doctor_id?: string;
          referred_to_doctor_id?: string;
          patient_id?: string;
          reason?: string | null;
          notes?: string | null;
          status?: string;
          whatsapp_notified?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      // Batch 3B: Lab Results table
      lab_results: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          doctor_id: string | null;
          order_id: string | null;
          title: string;
          file_key: string | null;
          file_name: string | null;
          file_size: number | null;
          mime_type: string | null;
          notes: string | null;
          status: string;
          whatsapp_notified: boolean;
          shared_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          patient_id: string;
          doctor_id?: string | null;
          order_id?: string | null;
          title: string;
          file_key?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          notes?: string | null;
          status?: string;
          whatsapp_notified?: boolean;
          shared_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          patient_id?: string;
          doctor_id?: string | null;
          order_id?: string | null;
          title?: string;
          file_key?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          notes?: string | null;
          status?: string;
          whatsapp_notified?: boolean;
          shared_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
  };
};

export type Database = ExtendedDatabase;
