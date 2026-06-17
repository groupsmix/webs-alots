import type { Json } from "./database";
import { Database as GenDatabase } from "./database";

// ── X-1: Extend the generated `users` Row/Insert/Update with `deletion_requested_at` ──
// The column was added via migration but the auto-generated types were never
// regenerated. This overlay adds it so API routes can stop casting through
// `as unknown as {...}`.

type UsersRowExtended = GenDatabase["public"]["Tables"]["users"]["Row"] & {
  deletion_requested_at: string | null;
  // A62-F1 (Art.18 restriction)
  processing_restricted: boolean;
  processing_restricted_at: string | null;
  processing_restriction_reason: string | null;
  // A62-F2 (Art.21 objection)
  processing_objection_active: boolean;
  processing_objection_at: string | null;
  processing_objection_activities: string[];
};
type UsersInsertExtended = GenDatabase["public"]["Tables"]["users"]["Insert"] & {
  deletion_requested_at?: string | null;
  processing_restricted?: boolean;
  processing_restricted_at?: string | null;
  processing_restriction_reason?: string | null;
  processing_objection_active?: boolean;
  processing_objection_at?: string | null;
  processing_objection_activities?: string[];
};
type UsersUpdateExtended = GenDatabase["public"]["Tables"]["users"]["Update"] & {
  deletion_requested_at?: string | null;
  processing_restricted?: boolean;
  processing_restricted_at?: string | null;
  processing_restriction_reason?: string | null;
  processing_objection_active?: boolean;
  processing_objection_at?: string | null;
  processing_objection_activities?: string[];
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
      // PR #980 follow-up: consent_records table (00160) — added here so
      // the typed tenant client can target it via supabase.from(...) and
      // RLS (policy user_inserts_own_consent_records, 00163) enforces
      // ownership without needing a service-role client.
      consent_records: {
        Row: {
          id: string;
          user_id: string | null;
          clinic_id: string | null;
          consent_type:
            | "terms_of_service"
            | "privacy_policy"
            | "health_data_processing"
            | "marketing_communications"
            | "whatsapp_notifications"
            | "data_sharing_with_clinic";
          granted: boolean;
          version: string;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          clinic_id?: string | null;
          consent_type:
            | "terms_of_service"
            | "privacy_policy"
            | "health_data_processing"
            | "marketing_communications"
            | "whatsapp_notifications"
            | "data_sharing_with_clinic";
          granted: boolean;
          version: string;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          clinic_id?: string | null;
          consent_type?:
            | "terms_of_service"
            | "privacy_policy"
            | "health_data_processing"
            | "marketing_communications"
            | "whatsapp_notifications"
            | "data_sharing_with_clinic";
          granted?: boolean;
          version?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
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
      // Batch 4B: Clinic Owner Tools tables
      expense_categories: {
        Row: {
          id: string;
          clinic_id: string;
          name: string;
          type: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          name: string;
          type: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          name?: string;
          type?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clinic_expenses: {
        Row: {
          id: string;
          clinic_id: string;
          category_id: string | null;
          description: string;
          amount: number;
          currency: string;
          expense_date: string;
          is_recurring: boolean;
          recurring_interval: string | null;
          receipt_url: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          category_id?: string | null;
          description: string;
          amount: number;
          currency?: string;
          expense_date: string;
          is_recurring?: boolean;
          recurring_interval?: string | null;
          receipt_url?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          category_id?: string | null;
          description?: string;
          amount?: number;
          currency?: string;
          expense_date?: string;
          is_recurring?: boolean;
          recurring_interval?: string | null;
          receipt_url?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_campaigns: {
        Row: {
          id: string;
          clinic_id: string;
          name: string;
          channel: string;
          budget: number;
          spend: number;
          currency: string;
          start_date: string;
          end_date: string | null;
          status: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          name: string;
          channel: string;
          budget: number;
          spend?: number;
          currency?: string;
          start_date: string;
          end_date?: string | null;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          name?: string;
          channel?: string;
          budget?: number;
          spend?: number;
          currency?: string;
          start_date?: string;
          end_date?: string | null;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patient_acquisition_channels: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          channel: string;
          campaign_id: string | null;
          referral_source: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          patient_id: string;
          channel: string;
          campaign_id?: string | null;
          referral_source?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          patient_id?: string;
          channel?: string;
          campaign_id?: string | null;
          referral_source?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      insurance_claims: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          doctor_id: string | null;
          appointment_id: string | null;
          insurance_type: string;
          policy_number: string | null;
          claim_number: string | null;
          amount_claimed: number;
          amount_approved: number | null;
          currency: string;
          status: string;
          submitted_at: string | null;
          resolved_at: string | null;
          rejection_reason: string | null;
          diagnosis_code: string | null;
          treatment_description: string | null;
          documents: Json;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          patient_id: string;
          doctor_id?: string | null;
          appointment_id?: string | null;
          insurance_type: string;
          policy_number?: string | null;
          claim_number?: string | null;
          amount_claimed: number;
          amount_approved?: number | null;
          currency?: string;
          status?: string;
          submitted_at?: string | null;
          resolved_at?: string | null;
          rejection_reason?: string | null;
          diagnosis_code?: string | null;
          treatment_description?: string | null;
          documents?: Json;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          patient_id?: string;
          doctor_id?: string | null;
          appointment_id?: string | null;
          insurance_type?: string;
          policy_number?: string | null;
          claim_number?: string | null;
          amount_claimed?: number;
          amount_approved?: number | null;
          currency?: string;
          status?: string;
          submitted_at?: string | null;
          resolved_at?: string | null;
          rejection_reason?: string | null;
          diagnosis_code?: string | null;
          treatment_description?: string | null;
          documents?: Json;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
  };
};

export type Database = ExtendedDatabase;
