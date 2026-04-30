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
      // A164-01: Sequential invoice numbering per clinic per fiscal year
      invoice_sequences: {
        Row: {
          clinic_id: string;
          fiscal_year: number;
          last_number: number;
          updated_at: string;
        };
        Insert: {
          clinic_id: string;
          fiscal_year: number;
          last_number?: number;
          updated_at?: string;
        };
        Update: {
          clinic_id?: string;
          fiscal_year?: number;
          last_number?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      // A164-02: Tax exemption certificates
      tax_exemptions: {
        Row: {
          id: string;
          clinic_id: string;
          name: string;
          exemption_type: string;
          legal_reference: string | null;
          rate_override: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          name: string;
          exemption_type?: string;
          legal_reference?: string | null;
          rate_override?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          name?: string;
          exemption_type?: string;
          legal_reference?: string | null;
          rate_override?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // A169-01: Refund idempotency keys
      refund_idempotency_keys: {
        Row: {
          idempotency_key: string;
          clinic_id: string;
          payment_id: string;
          refund_amount: number;
          result_status: "processing" | "completed" | "failed";
          created_at: string;
        };
        Insert: {
          idempotency_key: string;
          clinic_id: string;
          payment_id: string;
          refund_amount: number;
          result_status?: "processing" | "completed" | "failed";
          created_at?: string;
        };
        Update: {
          idempotency_key?: string;
          clinic_id?: string;
          payment_id?: string;
          refund_amount?: number;
          result_status?: "processing" | "completed" | "failed";
          created_at?: string;
        };
        Relationships: [];
      };
      // A169-05: Chargeback correlation
      chargebacks: {
        Row: {
          id: string;
          clinic_id: string;
          payment_id: string;
          gateway: "stripe" | "cmi";
          gateway_dispute_id: string | null;
          amount: number;
          currency: string;
          fee: number;
          status: "open" | "under_review" | "won" | "lost" | "accepted";
          reason: string | null;
          evidence_due_by: string | null;
          evidence_submitted_at: string | null;
          resolved_at: string | null;
          resolution_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          payment_id: string;
          gateway: "stripe" | "cmi";
          gateway_dispute_id?: string | null;
          amount: number;
          currency?: string;
          fee?: number;
          status?: "open" | "under_review" | "won" | "lost" | "accepted";
          reason?: string | null;
          evidence_due_by?: string | null;
          evidence_submitted_at?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          payment_id?: string;
          gateway?: "stripe" | "cmi";
          gateway_dispute_id?: string | null;
          amount?: number;
          currency?: string;
          fee?: number;
          status?: "open" | "under_review" | "won" | "lost" | "accepted";
          reason?: string | null;
          evidence_due_by?: string | null;
          evidence_submitted_at?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // A167-02: Money table audit log
      money_audit_log: {
        Row: {
          id: number;
          table_name: string;
          operation: "UPDATE" | "DELETE";
          row_id: string;
          clinic_id: string | null;
          actor: string | null;
          old_data: unknown;
          new_data: unknown | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: never; // GENERATED ALWAYS AS IDENTITY
          table_name: string;
          operation: "UPDATE" | "DELETE";
          row_id: string;
          clinic_id?: string | null;
          actor?: string | null;
          old_data: unknown;
          new_data?: unknown | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          table_name?: string;
          operation?: "UPDATE" | "DELETE";
          row_id?: string;
          clinic_id?: string | null;
          actor?: string | null;
          old_data?: unknown;
          new_data?: unknown | null;
          reason?: string | null;
          created_at?: string;
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
