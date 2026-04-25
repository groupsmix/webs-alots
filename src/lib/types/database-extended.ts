import { Database as GenDatabase } from "./database";

// Define the missing tables that are not in the generated types
export type ExtendedDatabase = GenDatabase & {
  public: GenDatabase["public"] & {
    Tables: GenDatabase["public"]["Tables"] & {
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
    };
  };
};

export type Database = ExtendedDatabase;
