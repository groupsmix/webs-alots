export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor: string | null
          clinic_id: string | null
          clinic_name: string | null
          created_at: string | null
          description: string | null
          id: string
          timestamp: string | null
          type: string
        }
        Insert: {
          action: string
          actor?: string | null
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          timestamp?: string | null
          type: string
        }
        Update: {
          action?: string
          actor?: string | null
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          timestamp?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      admissions: {
        Row: {
          admission_date: string
          admitting_doctor_id: string | null
          bed_id: string
          clinic_id: string
          created_at: string | null
          department_id: string | null
          diagnosis: string | null
          discharge_date: string | null
          id: string
          notes: string | null
          patient_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          admission_date?: string
          admitting_doctor_id?: string | null
          bed_id: string
          clinic_id: string
          created_at?: string | null
          department_id?: string | null
          diagnosis?: string | null
          discharge_date?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          admission_date?: string
          admitting_doctor_id?: string | null
          bed_id?: string
          clinic_id?: string
          created_at?: string | null
          department_id?: string | null
          diagnosis?: string | null
          discharge_date?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_admitting_doctor_id_fkey"
            columns: ["admitting_doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          message: string
          published_at: string | null
          target: string
          target_label: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          published_at?: string | null
          target?: string
          target_label?: string | null
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          published_at?: string | null
          target?: string
          target_label?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      appointment_doctors: {
        Row: {
          appointment_id: string
          created_at: string | null
          doctor_id: string
          id: string
          is_primary: boolean | null
        }
        Insert: {
          appointment_id: string
          created_at?: string | null
          doctor_id: string
          id?: string
          is_primary?: boolean | null
        }
        Update: {
          appointment_id?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
          is_primary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_doctors_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string | null
          booking_source: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          clinic_id: string
          created_at: string | null
          doctor_id: string
          end_time: string | null
          id: string
          insurance_flag: boolean | null
          is_emergency: boolean | null
          is_first_visit: boolean | null
          is_walk_in: boolean | null
          notes: string | null
          patient_id: string
          recurrence_group_id: string | null
          recurrence_index: number | null
          recurrence_pattern: string | null
          rescheduled_from: string | null
          service_id: string | null
          slot_end: string
          slot_start: string
          source: string | null
          start_time: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          appointment_date?: string | null
          booking_source?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          end_time?: string | null
          id?: string
          insurance_flag?: boolean | null
          is_emergency?: boolean | null
          is_first_visit?: boolean | null
          is_walk_in?: boolean | null
          notes?: string | null
          patient_id: string
          recurrence_group_id?: string | null
          recurrence_index?: number | null
          recurrence_pattern?: string | null
          rescheduled_from?: string | null
          service_id?: string | null
          slot_end: string
          slot_start: string
          source?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string | null
          booking_source?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          end_time?: string | null
          id?: string
          insurance_flag?: boolean | null
          is_emergency?: boolean | null
          is_first_visit?: boolean | null
          is_walk_in?: boolean | null
          notes?: string | null
          patient_id?: string
          recurrence_group_id?: string | null
          recurrence_index?: number | null
          recurrence_pattern?: string | null
          rescheduled_from?: string | null
          service_id?: string | null
          slot_end?: string
          slot_start?: string
          source?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointments_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          bed_number: string
          clinic_id: string
          current_patient_id: string | null
          id: string
          notes: string | null
          room_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          bed_number: string
          clinic_id: string
          current_patient_id?: string | null
          id?: string
          notes?: string | null
          room_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          bed_number?: string
          clinic_id?: string
          current_patient_id?: string | null
          id?: string
          notes?: string | null
          room_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beds_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_current_patient_id_fkey"
            columns: ["current_patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      before_after_photos: {
        Row: {
          after_date: string | null
          after_image_url: string | null
          before_date: string | null
          before_image_url: string | null
          category: string | null
          clinic_id: string
          created_at: string | null
          description: string | null
          id: string
          patient_id: string
          treatment_plan_id: string | null
          updated_at: string | null
        }
        Insert: {
          after_date?: string | null
          after_image_url?: string | null
          before_date?: string | null
          before_image_url?: string | null
          category?: string | null
          clinic_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          patient_id: string
          treatment_plan_id?: string | null
          updated_at?: string | null
        }
        Update: {
          after_date?: string | null
          after_image_url?: string | null
          before_date?: string | null
          before_image_url?: string | null
          category?: string | null
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          patient_id?: string
          treatment_plan_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "before_after_photos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "before_after_photos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "before_after_photos_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category: string | null
          clinic_id: string | null
          content: string | null
          created_at: string | null
          date: string
          excerpt: string | null
          id: string
          is_published: boolean | null
          read_time: string | null
          slug: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          clinic_id?: string | null
          content?: string | null
          created_at?: string | null
          date?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          read_time?: string | null
          slug?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          clinic_id?: string | null
          content?: string | null
          created_at?: string | null
          date?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          read_time?: string | null
          slug?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_pressure_readings: {
        Row: {
          arm: string | null
          clinic_id: string
          created_at: string | null
          diastolic: number
          doctor_id: string
          heart_rate: number | null
          id: string
          notes: string | null
          patient_id: string
          position: string | null
          reading_date: string
          systolic: number
        }
        Insert: {
          arm?: string | null
          clinic_id: string
          created_at?: string | null
          diastolic: number
          doctor_id: string
          heart_rate?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          position?: string | null
          reading_date?: string
          systolic: number
        }
        Update: {
          arm?: string | null
          clinic_id?: string
          created_at?: string | null
          diastolic?: number
          doctor_id?: string
          heart_rate?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          position?: string | null
          reading_date?: string
          systolic?: number
        }
        Relationships: [
          {
            foreignKeyName: "blood_pressure_readings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blood_pressure_readings_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blood_pressure_readings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_sugar_readings: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          glucose_level: number
          id: string
          notes: string | null
          patient_id: string
          reading_date: string
          reading_type: string | null
          unit: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          glucose_level: number
          id?: string
          notes?: string | null
          patient_id: string
          reading_date?: string
          reading_type?: string | null
          unit?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          glucose_level?: number
          id?: string
          notes?: string | null
          patient_id?: string
          reading_date?: string
          reading_type?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blood_sugar_readings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blood_sugar_readings_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blood_sugar_readings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          arm_cm: number | null
          bmi: number | null
          body_fat_pct: number | null
          chest_cm: number | null
          clinic_id: string
          created_at: string
          height_cm: number | null
          hip_cm: number | null
          id: string
          measurement_date: string
          notes: string | null
          patient_id: string
          thigh_cm: number | null
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          bmi?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          clinic_id: string
          created_at?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          patient_id: string
          thigh_cm?: number | null
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          bmi?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          clinic_id?: string
          created_at?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          patient_id?: string
          thigh_cm?: number | null
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_measurements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_config: {
        Row: {
          accent_color: string | null
          clinic_id: string
          created_at: string | null
          enabled: boolean | null
          greeting: string | null
          id: string
          intelligence: string
          language: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          clinic_id: string
          created_at?: string | null
          enabled?: boolean | null
          greeting?: string | null
          id?: string
          intelligence?: string
          language?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          clinic_id?: string
          created_at?: string | null
          enabled?: boolean | null
          greeting?: string | null
          id?: string
          intelligence?: string
          language?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_config_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_faqs: {
        Row: {
          answer: string
          clinic_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          question: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          answer: string
          clinic_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          question: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          answer?: string
          clinic_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          question?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_faqs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_feature_overrides: {
        Row: {
          clinic_id: string
          created_at: string | null
          enabled: boolean
          feature_id: string
          id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          enabled?: boolean
          feature_id: string
          id?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          enabled?: boolean
          feature_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_feature_overrides_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_feature_overrides_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "feature_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_holidays: {
        Row: {
          clinic_id: string
          created_at: string | null
          end_date: string
          id: string
          start_date: string
          title: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          end_date: string
          id?: string
          start_date: string
          title: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          start_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_holidays_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_types: {
        Row: {
          category: string
          created_at: string | null
          features_config: Json
          icon: string
          id: string
          is_active: boolean
          name_ar: string
          name_fr: string
          sort_order: number
          type_key: string
        }
        Insert: {
          category: string
          created_at?: string | null
          features_config?: Json
          icon?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_fr: string
          sort_order?: number
          type_key: string
        }
        Update: {
          category?: string
          created_at?: string | null
          features_config?: Json
          icon?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_fr?: string
          sort_order?: number
          type_key?: string
        }
        Relationships: []
      }
      clinics: {
        Row: {
          body_font: string | null
          city: string | null
          clinic_type_id: string | null
          clinic_type_key: string | null
          config: Json | null
          cover_photo_url: string | null
          created_at: string | null
          domain: string | null
          favicon_url: string | null
          features: Json | null
          heading_font: string | null
          hero_image_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          primary_color: string | null
          secondary_color: string | null
          section_visibility: Json | null
          status: string
          subdomain: string | null
          tagline: string | null
          template_id: string | null
          tier: string
          type: string
          updated_at: string | null
        }
        Insert: {
          body_font?: string | null
          city?: string | null
          clinic_type_id?: string | null
          clinic_type_key?: string | null
          config?: Json | null
          cover_photo_url?: string | null
          created_at?: string | null
          domain?: string | null
          favicon_url?: string | null
          features?: Json | null
          heading_font?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          section_visibility?: Json | null
          status?: string
          subdomain?: string | null
          tagline?: string | null
          template_id?: string | null
          tier?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          body_font?: string | null
          city?: string | null
          clinic_type_id?: string | null
          clinic_type_key?: string | null
          config?: Json | null
          cover_photo_url?: string | null
          created_at?: string | null
          domain?: string | null
          favicon_url?: string | null
          features?: Json | null
          heading_font?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          section_visibility?: Json | null
          status?: string
          subdomain?: string | null
          tagline?: string | null
          template_id?: string | null
          tier?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinics_clinic_type_key_fkey"
            columns: ["clinic_type_key"]
            isOneToOne: false
            referencedRelation: "clinic_types"
            referencedColumns: ["type_key"]
          },
        ]
      }
      consultation_notes: {
        Row: {
          appointment_id: string
          clinic_id: string | null
          content: Json | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string
          id: string
          is_private: boolean | null
          notes: string | null
          patient_id: string
          private: boolean | null
          updated_at: string | null
        }
        Insert: {
          appointment_id: string
          clinic_id?: string | null
          content?: Json | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id: string
          id?: string
          is_private?: boolean | null
          notes?: string | null
          patient_id: string
          private?: boolean | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string
          clinic_id?: string | null
          content?: Json | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string
          id?: string
          is_private?: boolean | null
          notes?: string | null
          patient_id?: string
          private?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_photos: {
        Row: {
          annotations: Json | null
          body_area: string | null
          clinic_id: string
          created_at: string | null
          doctor_id: string | null
          id: string
          notes: string | null
          patient_id: string
          photo_url: string
          taken_at: string | null
          thumbnail_url: string | null
        }
        Insert: {
          annotations?: Json | null
          body_area?: string | null
          clinic_id: string
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          photo_url: string
          taken_at?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          annotations?: Json | null
          body_area?: string | null
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          photo_url?: string
          taken_at?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_photos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_photos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_photos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          clinic_type_key: string
          created_at: string | null
          default_value: Json | null
          description: string | null
          entity_type: string
          field_key: string
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          is_system: boolean
          label_ar: string
          label_fr: string
          options: Json | null
          placeholder: string | null
          sort_order: number
          updated_at: string | null
          validation: Json | null
        }
        Insert: {
          clinic_type_key: string
          created_at?: string | null
          default_value?: Json | null
          description?: string | null
          entity_type: string
          field_key: string
          field_type: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_system?: boolean
          label_ar?: string
          label_fr: string
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
          updated_at?: string | null
          validation?: Json | null
        }
        Update: {
          clinic_type_key?: string
          created_at?: string | null
          default_value?: Json | null
          description?: string | null
          entity_type?: string
          field_key?: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_system?: boolean
          label_ar?: string
          label_fr?: string
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
          updated_at?: string | null
          validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_clinic_type_key_fkey"
            columns: ["clinic_type_key"]
            isOneToOne: false
            referencedRelation: "clinic_types"
            referencedColumns: ["type_key"]
          },
        ]
      }
      custom_field_overrides: {
        Row: {
          clinic_id: string
          created_at: string | null
          field_definition_id: string
          id: string
          is_enabled: boolean | null
          is_required: boolean | null
          sort_order: number | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          field_definition_id: string
          id?: string
          is_enabled?: boolean | null
          is_required?: boolean | null
          sort_order?: number | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          field_definition_id?: string
          id?: string
          is_enabled?: boolean | null
          is_required?: boolean | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_overrides_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_overrides_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          clinic_id: string
          created_at: string | null
          entity_id: string
          entity_type: string
          field_values: Json
          id: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          field_values?: Json
          id?: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          field_values?: Json
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          clinic_id: string
          created_at: string | null
          description: string | null
          floor: string | null
          head_doctor_id: string | null
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          description?: string | null
          floor?: string | null
          head_doctor_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          floor?: string | null
          head_doctor_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_head_doctor_id_fkey"
            columns: ["head_doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      developmental_milestones: {
        Row: {
          achieved_date: string | null
          category: string
          clinic_id: string
          created_at: string | null
          doctor_id: string | null
          expected_age_months: number | null
          id: string
          milestone: string
          notes: string | null
          patient_id: string
          status: string
        }
        Insert: {
          achieved_date?: string | null
          category: string
          clinic_id: string
          created_at?: string | null
          doctor_id?: string | null
          expected_age_months?: number | null
          id?: string
          milestone: string
          notes?: string | null
          patient_id: string
          status?: string
        }
        Update: {
          achieved_date?: string | null
          category?: string
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string | null
          expected_age_months?: number | null
          id?: string
          milestone?: string
          notes?: string | null
          patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "developmental_milestones_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developmental_milestones_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developmental_milestones_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diabetes_management: {
        Row: {
          clinic_id: string
          created_at: string | null
          current_hba1c: number | null
          diabetes_type: string | null
          diagnosis_date: string | null
          diet_plan: string | null
          doctor_id: string
          exercise_plan: string | null
          id: string
          last_review_date: string | null
          medications: Json | null
          monitoring_frequency: string | null
          notes: string | null
          patient_id: string
          target_hba1c: number | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          current_hba1c?: number | null
          diabetes_type?: string | null
          diagnosis_date?: string | null
          diet_plan?: string | null
          doctor_id: string
          exercise_plan?: string | null
          id?: string
          last_review_date?: string | null
          medications?: Json | null
          monitoring_frequency?: string | null
          notes?: string | null
          patient_id: string
          target_hba1c?: number | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          current_hba1c?: number | null
          diabetes_type?: string | null
          diagnosis_date?: string | null
          diet_plan?: string | null
          doctor_id?: string
          exercise_plan?: string | null
          id?: string
          last_review_date?: string | null
          medications?: Json | null
          monitoring_frequency?: string | null
          notes?: string | null
          patient_id?: string
          target_hba1c?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diabetes_management_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diabetes_management_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diabetes_management_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dialysis_machines: {
        Row: {
          clinic_id: string
          created_at: string | null
          id: string
          last_maintenance: string | null
          machine_model: string | null
          machine_name: string
          next_maintenance: string | null
          notes: string | null
          serial_number: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          id?: string
          last_maintenance?: string | null
          machine_model?: string | null
          machine_name: string
          next_maintenance?: string | null
          notes?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          id?: string
          last_maintenance?: string | null
          machine_model?: string | null
          machine_name?: string
          next_maintenance?: string | null
          notes?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dialysis_machines_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      dialysis_sessions: {
        Row: {
          access_type: string | null
          blood_flow: number | null
          clinic_id: string
          complications: string | null
          created_at: string | null
          dialysate_flow: number | null
          doctor_id: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          is_recurring: boolean
          machine_id: string | null
          notes: string | null
          patient_id: string
          post_bp_diastolic: number | null
          post_bp_systolic: number | null
          post_pulse: number | null
          post_temperature: number | null
          post_weight: number | null
          pre_bp_diastolic: number | null
          pre_bp_systolic: number | null
          pre_pulse: number | null
          pre_temperature: number | null
          pre_weight: number | null
          recurrence_group_id: string | null
          recurrence_pattern: string | null
          session_date: string
          start_time: string
          status: string
          uf_actual: number | null
          uf_goal: number | null
          updated_at: string | null
        }
        Insert: {
          access_type?: string | null
          blood_flow?: number | null
          clinic_id: string
          complications?: string | null
          created_at?: string | null
          dialysate_flow?: number | null
          doctor_id?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          is_recurring?: boolean
          machine_id?: string | null
          notes?: string | null
          patient_id: string
          post_bp_diastolic?: number | null
          post_bp_systolic?: number | null
          post_pulse?: number | null
          post_temperature?: number | null
          post_weight?: number | null
          pre_bp_diastolic?: number | null
          pre_bp_systolic?: number | null
          pre_pulse?: number | null
          pre_temperature?: number | null
          pre_weight?: number | null
          recurrence_group_id?: string | null
          recurrence_pattern?: string | null
          session_date: string
          start_time: string
          status?: string
          uf_actual?: number | null
          uf_goal?: number | null
          updated_at?: string | null
        }
        Update: {
          access_type?: string | null
          blood_flow?: number | null
          clinic_id?: string
          complications?: string | null
          created_at?: string | null
          dialysate_flow?: number | null
          doctor_id?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          is_recurring?: boolean
          machine_id?: string | null
          notes?: string | null
          patient_id?: string
          post_bp_diastolic?: number | null
          post_bp_systolic?: number | null
          post_pulse?: number | null
          post_temperature?: number | null
          post_weight?: number | null
          pre_bp_diastolic?: number | null
          pre_bp_systolic?: number | null
          pre_pulse?: number | null
          pre_temperature?: number | null
          pre_weight?: number | null
          recurrence_group_id?: string | null
          recurrence_pattern?: string | null
          session_date?: string
          start_time?: string
          status?: string
          uf_actual?: number | null
          uf_goal?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dialysis_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialysis_sessions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialysis_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "dialysis_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialysis_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_departments: {
        Row: {
          clinic_id: string
          department_id: string
          doctor_id: string
          id: string
          is_primary: boolean
          joined_at: string | null
        }
        Insert: {
          clinic_id: string
          department_id: string
          doctor_id: string
          id?: string
          is_primary?: boolean
          joined_at?: string | null
        }
        Update: {
          clinic_id?: string
          department_id?: string
          doctor_id?: string
          id?: string
          is_primary?: boolean
          joined_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_departments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_departments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          clinic_id: string
          created_at: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          type: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          type: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          type?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ecg_records: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          file_url: string | null
          heart_rate: number | null
          id: string
          interpretation: string | null
          is_abnormal: boolean | null
          notes: string | null
          patient_id: string
          record_date: string
          rhythm: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          file_url?: string | null
          heart_rate?: number | null
          id?: string
          interpretation?: string | null
          is_abnormal?: boolean | null
          notes?: string | null
          patient_id: string
          record_date?: string
          rhythm?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          file_url?: string | null
          heart_rate?: number | null
          id?: string
          interpretation?: string | null
          is_abnormal?: boolean | null
          notes?: string | null
          patient_id?: string
          record_date?: string
          rhythm?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecg_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecg_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecg_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      eeg_records: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          duration_minutes: number | null
          file_url: string | null
          findings: string | null
          id: string
          interpretation: string | null
          is_abnormal: boolean | null
          notes: string | null
          patient_id: string
          record_date: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          duration_minutes?: number | null
          file_url?: string | null
          findings?: string | null
          id?: string
          interpretation?: string | null
          is_abnormal?: boolean | null
          notes?: string | null
          patient_id: string
          record_date?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          duration_minutes?: number | null
          file_url?: string | null
          findings?: string | null
          id?: string
          interpretation?: string | null
          is_abnormal?: boolean | null
          notes?: string | null
          patient_id?: string
          record_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "eeg_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eeg_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eeg_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_slots: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          end_time: string
          id: string
          is_booked: boolean | null
          reason: string | null
          slot_date: string
          start_time: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          end_time: string
          id?: string
          is_booked?: boolean | null
          reason?: string | null
          slot_date: string
          start_time: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          end_time?: string
          id?: string
          is_booked?: boolean | null
          reason?: string | null
          slot_date?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_slots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_exam_records: {
        Row: {
          clinic_id: string
          created_at: string | null
          diagnosis: string | null
          doctor_id: string
          exam_date: string
          findings: Json | null
          id: string
          patient_id: string
          plan: string | null
          template_type: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          diagnosis?: string | null
          doctor_id: string
          exam_date?: string
          findings?: Json | null
          id?: string
          patient_id: string
          plan?: string | null
          template_type?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string
          exam_date?: string
          findings?: Json | null
          id?: string
          patient_id?: string
          plan?: string | null
          template_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_exam_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_exam_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_exam_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_inventory: {
        Row: {
          category: string
          clinic_id: string
          condition: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_rentable: boolean | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          rental_price_daily: number | null
          rental_price_monthly: number | null
          rental_price_weekly: number | null
          serial_number: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string
          clinic_id: string
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_rentable?: boolean | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          rental_price_daily?: number | null
          rental_price_monthly?: number | null
          rental_price_weekly?: number | null
          serial_number?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          clinic_id?: string
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_rentable?: boolean | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          rental_price_daily?: number | null
          rental_price_monthly?: number | null
          rental_price_weekly?: number | null
          serial_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_inventory_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance: {
        Row: {
          clinic_id: string
          cost: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          equipment_id: string
          id: string
          next_due: string | null
          notes: string | null
          performed_at: string
          performed_by: string | null
          status: string | null
          type: string
        }
        Insert: {
          clinic_id: string
          cost?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          equipment_id: string
          id?: string
          next_due?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          status?: string | null
          type?: string
        }
        Update: {
          clinic_id?: string
          cost?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          equipment_id?: string
          id?: string
          next_due?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_rentals: {
        Row: {
          actual_return: string | null
          client_id_number: string | null
          client_name: string
          client_phone: string | null
          clinic_id: string
          condition_in: string | null
          condition_out: string | null
          created_at: string | null
          currency: string | null
          deposit_amount: number | null
          equipment_id: string
          id: string
          notes: string | null
          payment_status: string | null
          rental_amount: number | null
          rental_end: string | null
          rental_start: string
          status: string
          updated_at: string | null
        }
        Insert: {
          actual_return?: string | null
          client_id_number?: string | null
          client_name: string
          client_phone?: string | null
          clinic_id: string
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string | null
          currency?: string | null
          deposit_amount?: number | null
          equipment_id: string
          id?: string
          notes?: string | null
          payment_status?: string | null
          rental_amount?: number | null
          rental_end?: string | null
          rental_start: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          actual_return?: string | null
          client_id_number?: string | null
          client_name?: string
          client_phone?: string | null
          clinic_id?: string
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string | null
          currency?: string | null
          deposit_amount?: number | null
          equipment_id?: string
          id?: string
          notes?: string | null
          payment_status?: string | null
          rental_amount?: number | null
          rental_end?: string | null
          rental_start?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_rentals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_rentals_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_programs: {
        Row: {
          clinic_id: string
          created_at: string
          end_date: string | null
          exercises: Json
          frequency: string | null
          id: string
          notes: string | null
          patient_id: string
          start_date: string
          status: string
          therapist_id: string
          title: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          end_date?: string | null
          exercises?: Json
          frequency?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          start_date?: string
          status?: string
          therapist_id: string
          title: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          end_date?: string | null
          exercises?: Json
          frequency?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          start_date?: string
          status?: string
          therapist_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_programs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_programs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_programs_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string | null
          id: string
          member_user_id: string | null
          name: string
          phone: string | null
          primary_user_id: string
          relationship: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_user_id?: string | null
          name: string
          phone?: string | null
          primary_user_id: string
          relationship: string
        }
        Update: {
          created_at?: string | null
          id?: string
          member_user_id?: string | null
          name?: string
          phone?: string | null
          primary_user_id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_member_user_id_fkey"
            columns: ["member_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_definitions: {
        Row: {
          available_tiers: string[]
          category: string
          created_at: string | null
          description: string | null
          global_enabled: boolean | null
          id: string
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          available_tiers?: string[]
          category?: string
          created_at?: string | null
          description?: string | null
          global_enabled?: boolean | null
          id?: string
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          available_tiers?: string[]
          category?: string
          created_at?: string | null
          description?: string | null
          global_enabled?: boolean | null
          id?: string
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      feature_toggles: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          key: string
          label: string
          system_types: string[]
          tiers: string[]
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          key: string
          label: string
          system_types?: string[]
          tiers?: string[]
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          key?: string
          label?: string
          system_types?: string[]
          tiers?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      fracture_records: {
        Row: {
          clinic_id: string
          created_at: string | null
          diagnosis_date: string
          doctor_id: string
          expected_healing_date: string | null
          fracture_type: string
          id: string
          injury_date: string
          location: string
          notes: string | null
          patient_id: string
          severity: string | null
          status: string | null
          updated_at: string | null
          xray_record_id: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          diagnosis_date?: string
          doctor_id: string
          expected_healing_date?: string | null
          fracture_type: string
          id?: string
          injury_date: string
          location: string
          notes?: string | null
          patient_id: string
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          xray_record_id?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          diagnosis_date?: string
          doctor_id?: string
          expected_healing_date?: string | null
          fracture_type?: string
          id?: string
          injury_date?: string
          location?: string
          notes?: string | null
          patient_id?: string
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          xray_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fracture_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fracture_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fracture_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fracture_records_xray_record_id_fkey"
            columns: ["xray_record_id"]
            isOneToOne: false
            referencedRelation: "xray_records"
            referencedColumns: ["id"]
          },
        ]
      }
      frame_catalog: {
        Row: {
          brand: string
          clinic_id: string
          color: string
          cost_price: number
          created_at: string
          frame_type: string
          gender: string
          id: string
          is_active: boolean
          material: string
          model: string
          photo_url: string | null
          price: number
          size: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          brand: string
          clinic_id: string
          color?: string
          cost_price?: number
          created_at?: string
          frame_type?: string
          gender?: string
          id?: string
          is_active?: boolean
          material?: string
          model: string
          photo_url?: string | null
          price?: number
          size?: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          brand?: string
          clinic_id?: string
          color?: string
          cost_price?: number
          created_at?: string
          frame_type?: string
          gender?: string
          id?: string
          is_active?: boolean
          material?: string
          model?: string
          photo_url?: string | null
          price?: number
          size?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frame_catalog_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_measurements: {
        Row: {
          age_months: number
          bmi: number | null
          clinic_id: string
          created_at: string | null
          doctor_id: string
          head_circ_cm: number | null
          height_cm: number | null
          id: string
          measured_at: string
          notes: string | null
          patient_id: string
          weight_kg: number | null
        }
        Insert: {
          age_months: number
          bmi?: number | null
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          head_circ_cm?: number | null
          height_cm?: number | null
          id?: string
          measured_at?: string
          notes?: string | null
          patient_id: string
          weight_kg?: number | null
        }
        Update: {
          age_months?: number
          bmi?: number | null
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          head_circ_cm?: number | null
          height_cm?: number | null
          id?: string
          measured_at?: string
          notes?: string | null
          patient_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_measurements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_measurements_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_measurements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hearing_tests: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          hearing_loss_degree: string | null
          hearing_loss_type: string | null
          id: string
          interpretation: string | null
          left_ear_data: Json | null
          notes: string | null
          patient_id: string
          right_ear_data: Json | null
          test_date: string
          test_type: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          hearing_loss_degree?: string | null
          hearing_loss_type?: string | null
          id?: string
          interpretation?: string | null
          left_ear_data?: Json | null
          notes?: string | null
          patient_id: string
          right_ear_data?: Json | null
          test_date?: string
          test_type?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          hearing_loss_degree?: string | null
          hearing_loss_type?: string | null
          id?: string
          interpretation?: string | null
          left_ear_data?: Json | null
          notes?: string | null
          patient_id?: string
          right_ear_data?: Json | null
          test_date?: string
          test_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hearing_tests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hearing_tests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hearing_tests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      heart_monitoring_notes: {
        Row: {
          category: string | null
          clinic_id: string
          content: string | null
          created_at: string | null
          doctor_id: string
          id: string
          is_alert: boolean | null
          note_date: string
          patient_id: string
          severity: string | null
          title: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          content?: string | null
          created_at?: string | null
          doctor_id: string
          id?: string
          is_alert?: boolean | null
          note_date?: string
          patient_id: string
          severity?: string | null
          title: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          content?: string | null
          created_at?: string | null
          doctor_id?: string
          id?: string
          is_alert?: boolean | null
          note_date?: string
          patient_id?: string
          severity?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "heart_monitoring_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heart_monitoring_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heart_monitoring_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hormone_levels: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          hormone_name: string
          id: string
          is_abnormal: boolean | null
          notes: string | null
          patient_id: string
          reference_range: string | null
          test_date: string
          unit: string
          value: number
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          hormone_name: string
          id?: string
          is_abnormal?: boolean | null
          notes?: string | null
          patient_id: string
          reference_range?: string | null
          test_date?: string
          unit: string
          value: number
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          hormone_name?: string
          id?: string
          is_abnormal?: boolean | null
          notes?: string | null
          patient_id?: string
          reference_range?: string | null
          test_date?: string
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "hormone_levels_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hormone_levels_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hormone_levels_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          clinic_id: string | null
          created_at: string | null
          due_date: string
          id: string
          paid_date: string | null
          patient_id: string
          receipt_url: string | null
          status: string | null
          treatment_plan_id: string
        }
        Insert: {
          amount: number
          clinic_id?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          paid_date?: string | null
          patient_id: string
          receipt_url?: string | null
          status?: string | null
          treatment_plan_id: string
        }
        Update: {
          amount?: number
          clinic_id?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          paid_date?: string | null
          patient_id?: string
          receipt_url?: string | null
          status?: string | null
          treatment_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      iop_measurements: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          id: string
          measured_at: string
          method: string | null
          notes: string | null
          od_pressure: number
          os_pressure: number
          patient_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          id?: string
          measured_at?: string
          method?: string | null
          notes?: string | null
          od_pressure: number
          os_pressure: number
          patient_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
          measured_at?: string
          method?: string | null
          notes?: string | null
          od_pressure?: number
          os_pressure?: number
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iop_measurements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iop_measurements_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iop_measurements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ivf_cycles: {
        Row: {
          beta_hcg_value: number | null
          clinic_id: string
          created_at: string | null
          cycle_number: number
          cycle_type: string
          doctor_id: string | null
          eggs_fertilized: number | null
          eggs_retrieved: number | null
          embryos_frozen: number | null
          embryos_transferred: number | null
          end_date: string | null
          id: string
          notes: string | null
          outcome: string | null
          partner_id: string | null
          patient_id: string
          protocol_id: string | null
          retrieval_date: string | null
          start_date: string | null
          status: string
          stimulation_start: string | null
          transfer_date: string | null
          updated_at: string | null
        }
        Insert: {
          beta_hcg_value?: number | null
          clinic_id: string
          created_at?: string | null
          cycle_number?: number
          cycle_type: string
          doctor_id?: string | null
          eggs_fertilized?: number | null
          eggs_retrieved?: number | null
          embryos_frozen?: number | null
          embryos_transferred?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          partner_id?: string | null
          patient_id: string
          protocol_id?: string | null
          retrieval_date?: string | null
          start_date?: string | null
          status?: string
          stimulation_start?: string | null
          transfer_date?: string | null
          updated_at?: string | null
        }
        Update: {
          beta_hcg_value?: number | null
          clinic_id?: string
          created_at?: string | null
          cycle_number?: number
          cycle_type?: string
          doctor_id?: string | null
          eggs_fertilized?: number | null
          eggs_retrieved?: number | null
          embryos_frozen?: number | null
          embryos_transferred?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          partner_id?: string | null
          patient_id?: string
          protocol_id?: string | null
          retrieval_date?: string | null
          start_date?: string | null
          status?: string
          stimulation_start?: string | null
          transfer_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ivf_cycles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ivf_cycles_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ivf_cycles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ivf_cycles_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ivf_protocols: {
        Row: {
          clinic_id: string
          created_at: string | null
          description: string | null
          duration_days: number | null
          id: string
          is_template: boolean
          medications: Json
          name: string
          protocol_type: string
          steps: Json
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          description?: string | null
          duration_days?: number | null
          id?: string
          is_template?: boolean
          medications?: Json
          name: string
          protocol_type: string
          steps?: Json
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          duration_days?: number | null
          id?: string
          is_template?: boolean
          medications?: Json
          name?: string
          protocol_type?: string
          steps?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ivf_protocols_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      ivf_timeline_events: {
        Row: {
          clinic_id: string
          created_at: string | null
          cycle_id: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          results: Json | null
          title: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          cycle_id: string
          description?: string | null
          event_date: string
          event_type: string
          id?: string
          results?: Json | null
          title: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          cycle_id?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          results?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ivf_timeline_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ivf_timeline_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "ivf_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      joint_assessments: {
        Row: {
          assessment_date: string
          clinic_id: string
          created_at: string | null
          das28_score: number | null
          doctor_id: string
          functional_status: string | null
          id: string
          joints_data: Json | null
          morning_stiffness_minutes: number | null
          notes: string | null
          patient_id: string
          swollen_joint_count: number | null
          tender_joint_count: number | null
          vas_pain_score: number | null
        }
        Insert: {
          assessment_date?: string
          clinic_id: string
          created_at?: string | null
          das28_score?: number | null
          doctor_id: string
          functional_status?: string | null
          id?: string
          joints_data?: Json | null
          morning_stiffness_minutes?: number | null
          notes?: string | null
          patient_id: string
          swollen_joint_count?: number | null
          tender_joint_count?: number | null
          vas_pain_score?: number | null
        }
        Update: {
          assessment_date?: string
          clinic_id?: string
          created_at?: string | null
          das28_score?: number | null
          doctor_id?: string
          functional_status?: string | null
          id?: string
          joints_data?: Json | null
          morning_stiffness_minutes?: number | null
          notes?: string | null
          patient_id?: string
          swollen_joint_count?: number | null
          tender_joint_count?: number | null
          vas_pain_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "joint_assessments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "joint_assessments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "joint_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_deliveries: {
        Row: {
          clinic_id: string
          condition: string | null
          created_at: string | null
          delivered_by: string | null
          delivery_date: string
          id: string
          notes: string | null
          order_id: string
          received_by: string | null
        }
        Insert: {
          clinic_id: string
          condition?: string | null
          created_at?: string | null
          delivered_by?: string | null
          delivery_date?: string
          id?: string
          notes?: string | null
          order_id: string
          received_by?: string | null
        }
        Update: {
          clinic_id?: string
          condition?: string | null
          created_at?: string | null
          delivered_by?: string | null
          delivery_date?: string
          id?: string
          notes?: string | null
          order_id?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_deliveries_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "prosthetic_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_invoices: {
        Row: {
          clinic_id: string
          created_at: string | null
          currency: string
          dentist_id: string | null
          dentist_name: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issued_date: string
          items: Json
          notes: string | null
          paid_date: string | null
          status: string
          subtotal: number
          tax_amount: number | null
          total: number
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          currency?: string
          dentist_id?: string | null
          dentist_name?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_date?: string
          items?: Json
          notes?: string | null
          paid_date?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          total?: number
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          currency?: string
          dentist_id?: string | null
          dentist_name?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_date?: string
          items?: Json
          notes?: string | null
          paid_date?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_invoices_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_materials: {
        Row: {
          category: string
          clinic_id: string
          created_at: string | null
          expiry_date: string | null
          id: string
          last_restocked: string | null
          lot_number: string | null
          min_threshold: number
          name: string
          notes: string | null
          quantity: number
          supplier: string | null
          unit: string
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          clinic_id: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          last_restocked?: string | null
          lot_number?: string | null
          min_threshold?: number
          name: string
          notes?: string | null
          quantity?: number
          supplier?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          clinic_id?: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          last_restocked?: string | null
          lot_number?: string | null
          min_threshold?: number
          name?: string
          notes?: string | null
          quantity?: number
          supplier?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_materials_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          clinic_id: string
          created_at: string | null
          details: string
          doctor_id: string
          due_date: string | null
          id: string
          lab_name: string | null
          patient_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          details: string
          doctor_id: string
          due_date?: string | null
          id?: string
          lab_name?: string | null
          patient_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          details?: string
          doctor_id?: string
          due_date?: string | null
          id?: string
          lab_name?: string | null
          patient_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_test_catalog: {
        Row: {
          category: string
          clinic_id: string
          code: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          price: number | null
          reference_ranges: Json | null
          sample_type: string | null
          sort_order: number | null
          turnaround_hours: number | null
        }
        Insert: {
          category?: string
          clinic_id: string
          code?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          price?: number | null
          reference_ranges?: Json | null
          sample_type?: string | null
          sort_order?: number | null
          turnaround_hours?: number | null
        }
        Update: {
          category?: string
          clinic_id?: string
          code?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          price?: number | null
          reference_ranges?: Json | null
          sample_type?: string | null
          sort_order?: number | null
          turnaround_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_test_catalog_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_test_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          status: string | null
          test_id: string
          test_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          status?: string | null
          test_id: string
          test_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          status?: string | null
          test_id?: string
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_test_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lab_test_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_test_items_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "lab_test_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_test_orders: {
        Row: {
          assigned_technician_id: string | null
          clinic_id: string
          clinical_notes: string | null
          completed_at: string | null
          created_at: string | null
          fasting_required: boolean | null
          id: string
          order_number: string
          ordering_doctor_id: string | null
          patient_id: string
          pdf_url: string | null
          priority: string | null
          sample_collected_at: string | null
          status: string
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          assigned_technician_id?: string | null
          clinic_id: string
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string | null
          fasting_required?: boolean | null
          id?: string
          order_number: string
          ordering_doctor_id?: string | null
          patient_id: string
          pdf_url?: string | null
          priority?: string | null
          sample_collected_at?: string | null
          status?: string
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          assigned_technician_id?: string | null
          clinic_id?: string
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string | null
          fasting_required?: boolean | null
          id?: string
          order_number?: string
          ordering_doctor_id?: string | null
          patient_id?: string
          pdf_url?: string | null
          priority?: string | null
          sample_collected_at?: string | null
          status?: string
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_test_orders_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_test_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_test_orders_ordering_doctor_id_fkey"
            columns: ["ordering_doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_test_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_test_orders_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_test_results: {
        Row: {
          entered_at: string | null
          entered_by: string | null
          flag: string | null
          id: string
          notes: string | null
          order_id: string
          parameter_name: string
          reference_max: number | null
          reference_min: number | null
          test_item_id: string
          unit: string | null
          value: string | null
        }
        Insert: {
          entered_at?: string | null
          entered_by?: string | null
          flag?: string | null
          id?: string
          notes?: string | null
          order_id: string
          parameter_name: string
          reference_max?: number | null
          reference_min?: number | null
          test_item_id: string
          unit?: string | null
          value?: string | null
        }
        Update: {
          entered_at?: string | null
          entered_by?: string | null
          flag?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          parameter_name?: string
          reference_max?: number | null
          reference_min?: number | null
          test_item_id?: string
          unit?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_test_results_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_test_results_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lab_test_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_test_results_test_item_id_fkey"
            columns: ["test_item_id"]
            isOneToOne: false
            referencedRelation: "lab_test_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lens_inventory: {
        Row: {
          clinic_id: string
          coating: string | null
          created_at: string
          id: string
          material: string
          min_threshold: number
          power_range: string
          selling_price: number
          stock_quantity: number
          supplier: string
          type: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          coating?: string | null
          created_at?: string
          id?: string
          material?: string
          min_threshold?: number
          power_range?: string
          selling_price?: number
          stock_quantity?: number
          supplier?: string
          type: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          coating?: string | null
          created_at?: string
          id?: string
          material?: string
          min_threshold?: number
          power_range?: string
          selling_price?: number
          stock_quantity?: number
          supplier?: string
          type?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lens_inventory_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          available_points: number | null
          birthday_reward_claimed: boolean | null
          birthday_reward_year: number | null
          clinic_id: string
          created_at: string | null
          date_of_birth: string | null
          id: string
          last_updated: string | null
          patient_id: string
          points: number
          redeemed_points: number | null
          referral_code: string | null
          referred_by: string | null
          tier: string | null
          total_purchases: number | null
        }
        Insert: {
          available_points?: number | null
          birthday_reward_claimed?: boolean | null
          birthday_reward_year?: number | null
          clinic_id: string
          created_at?: string | null
          date_of_birth?: string | null
          id?: string
          last_updated?: string | null
          patient_id: string
          points?: number
          redeemed_points?: number | null
          referral_code?: string | null
          referred_by?: string | null
          tier?: string | null
          total_purchases?: number | null
        }
        Update: {
          available_points?: number | null
          birthday_reward_claimed?: boolean | null
          birthday_reward_year?: number | null
          clinic_id?: string
          created_at?: string | null
          date_of_birth?: string | null
          id?: string
          last_updated?: string | null
          patient_id?: string
          points?: number
          redeemed_points?: number | null
          referral_code?: string | null
          referred_by?: string | null
          tier?: string | null
          total_purchases?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          clinic_id: string
          created_at: string | null
          description: string | null
          id: string
          patient_id: string
          points: number
          reason: string | null
          sale_id: string | null
          type: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          patient_id: string
          points?: number
          reason?: string | null
          sale_id?: string | null
          type?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          patient_id?: string
          points?: number
          reason?: string | null
          sale_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          clinic_id: string
          created_at: string
          daily_plans: Json
          end_date: string | null
          id: string
          notes: string | null
          nutritionist_id: string
          patient_id: string
          start_date: string
          status: string
          target_calories: number | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          daily_plans?: Json
          end_date?: string | null
          id?: string
          notes?: string | null
          nutritionist_id: string
          patient_id: string
          start_date?: string
          status?: string
          target_calories?: number | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          daily_plans?: Json
          end_date?: string | null
          id?: string
          notes?: string | null
          nutritionist_id?: string
          patient_id?: string
          start_date?: string
          status?: string
          target_calories?: number | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_certificates: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          content: Json
          created_at: string | null
          doctor_id: string
          id: string
          issued_date: string
          patient_id: string
          pdf_url: string | null
          type: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          content?: Json
          created_at?: string | null
          doctor_id: string
          id?: string
          issued_date?: string
          patient_id: string
          pdf_url?: string | null
          type: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          content?: Json
          created_at?: string | null
          doctor_id?: string
          id?: string
          issued_date?: string
          patient_id?: string
          pdf_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_certificates_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_certificates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_certificates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_certificates_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_tests: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          id: string
          joint: string
          notes: string | null
          pain_during_test: number | null
          patient_id: string
          range_of_motion: Json | null
          strength_score: number | null
          test_date: string
          test_type: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          id?: string
          joint: string
          notes?: string | null
          pain_during_test?: number | null
          patient_id: string
          range_of_motion?: Json | null
          strength_score?: number | null
          test_date?: string
          test_type: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
          joint?: string
          notes?: string | null
          pain_during_test?: number | null
          patient_id?: string
          range_of_motion?: Json | null
          strength_score?: number | null
          test_date?: string
          test_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_tests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_tests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_tests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      neuro_exam_records: {
        Row: {
          clinic_id: string
          coordination: Json | null
          cranial_nerves: Json | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string
          exam_date: string
          gait: Json | null
          id: string
          mental_status: Json | null
          motor_function: Json | null
          notes: string | null
          patient_id: string
          plan: string | null
          reflexes: Json | null
          sensory_function: Json | null
        }
        Insert: {
          clinic_id: string
          coordination?: Json | null
          cranial_nerves?: Json | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id: string
          exam_date?: string
          gait?: Json | null
          id?: string
          mental_status?: Json | null
          motor_function?: Json | null
          notes?: string | null
          patient_id: string
          plan?: string | null
          reflexes?: Json | null
          sensory_function?: Json | null
        }
        Update: {
          clinic_id?: string
          coordination?: Json | null
          cranial_nerves?: Json | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string
          exam_date?: string
          gait?: Json | null
          id?: string
          mental_status?: Json | null
          motor_function?: Json | null
          notes?: string | null
          patient_id?: string
          plan?: string | null
          reflexes?: Json | null
          sensory_function?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "neuro_exam_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neuro_exam_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neuro_exam_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          appointment_id: string | null
          body: string | null
          channel: string
          clinic_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          recipient_name: string | null
          recipient_phone: string | null
          status: string
          trigger: string
        }
        Insert: {
          appointment_id?: string | null
          body?: string | null
          channel: string
          clinic_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          trigger: string
        }
        Update: {
          appointment_id?: string | null
          body?: string | null
          channel?: string
          clinic_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          clinic_id: string | null
          id: string
          is_read: boolean | null
          message: string | null
          read_at: string | null
          sent_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel: string
          clinic_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          read_at?: string | null
          sent_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          clinic_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          read_at?: string | null
          sent_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      odontogram: {
        Row: {
          clinic_id: string | null
          dentition: string | null
          id: string
          notes: string | null
          patient_id: string
          status: string | null
          tooth_number: number
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          dentition?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          status?: string | null
          tooth_number: number
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          dentition?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string | null
          tooth_number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "odontogram_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      on_duty_schedule: {
        Row: {
          clinic_id: string
          created_at: string | null
          date: string
          end_time: string
          id: string
          is_on_duty: boolean | null
          notes: string | null
          start_time: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          is_on_duty?: boolean | null
          notes?: string | null
          start_time: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          is_on_duty?: boolean | null
          notes?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "on_duty_schedule_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      optical_prescriptions: {
        Row: {
          clinic_id: string
          created_at: string
          expiry_date: string | null
          frame_id: string | null
          id: string
          left_eye: Json
          lens_type: string | null
          notes: string | null
          ophthalmologist_name: string | null
          patient_id: string
          prescription_date: string
          right_eye: Json
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          expiry_date?: string | null
          frame_id?: string | null
          id?: string
          left_eye?: Json
          lens_type?: string | null
          notes?: string | null
          ophthalmologist_name?: string | null
          patient_id: string
          prescription_date?: string
          right_eye?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          expiry_date?: string | null
          frame_id?: string | null
          id?: string
          left_eye?: Json
          lens_type?: string | null
          notes?: string | null
          ophthalmologist_name?: string | null
          patient_id?: string
          prescription_date?: string
          right_eye?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optical_prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optical_prescriptions_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "frame_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optical_prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pain_questionnaires: {
        Row: {
          additional_notes: string | null
          appointment_id: string | null
          clinic_id: string
          created_at: string | null
          has_bleeding: boolean | null
          has_swelling: boolean | null
          id: string
          pain_duration: string | null
          pain_level: number
          pain_location: string | null
          pain_type: string | null
          patient_id: string
          triggers: string[] | null
        }
        Insert: {
          additional_notes?: string | null
          appointment_id?: string | null
          clinic_id: string
          created_at?: string | null
          has_bleeding?: boolean | null
          has_swelling?: boolean | null
          id?: string
          pain_duration?: string | null
          pain_level: number
          pain_location?: string | null
          pain_type?: string | null
          patient_id: string
          triggers?: string[] | null
        }
        Update: {
          additional_notes?: string | null
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string | null
          has_bleeding?: boolean | null
          has_swelling?: boolean | null
          id?: string
          pain_duration?: string | null
          pain_level?: number
          pain_location?: string | null
          pain_type?: string | null
          patient_id?: string
          triggers?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "pain_questionnaires_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pain_questionnaires_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pain_questionnaires_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      parapharmacy_categories: {
        Row: {
          clinic_id: string
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          parent_id: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parapharmacy_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parapharmacy_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parapharmacy_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_packages: {
        Row: {
          clinic_id: string
          created_at: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          package_id: string
          patient_id: string
          sessions_total: number
          sessions_used: number
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          package_id: string
          patient_id: string
          sessions_total: number
          sessions_used?: number
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          package_id?: string
          patient_id?: string
          sessions_total?: number
          sessions_used?: number
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_packages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "treatment_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string | null
          clinic_id: string
          created_at: string | null
          gateway_session_id: string | null
          id: string
          method: string | null
          patient_id: string
          payment_type: string | null
          ref: string | null
          reference: string | null
          refunded_amount: number | null
          status: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          clinic_id: string
          created_at?: string | null
          gateway_session_id?: string | null
          id?: string
          method?: string | null
          patient_id: string
          payment_type?: string | null
          ref?: string | null
          reference?: string | null
          refunded_amount?: number | null
          status?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string | null
          gateway_session_id?: string | null
          id?: string
          method?: string | null
          patient_id?: string
          payment_type?: string | null
          ref?: string | null
          reference?: string | null
          refunded_amount?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_consent_forms: {
        Row: {
          clinic_id: string
          consent_text: string | null
          consent_type: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          patient_id: string
          signature_url: string | null
          signed_at: string
        }
        Insert: {
          clinic_id: string
          consent_text?: string | null
          consent_type?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          patient_id: string
          signature_url?: string | null
          signed_at?: string
        }
        Update: {
          clinic_id?: string
          consent_text?: string | null
          consent_type?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          patient_id?: string
          signature_url?: string | null
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_consent_forms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_consent_forms_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      physio_sessions: {
        Row: {
          attended: boolean
          clinic_id: string
          created_at: string
          duration_minutes: number
          exercises_completed: Json
          id: string
          pain_level_after: number | null
          pain_level_before: number | null
          patient_id: string
          program_id: string | null
          progress_notes: string | null
          session_date: string
          therapist_id: string
        }
        Insert: {
          attended?: boolean
          clinic_id: string
          created_at?: string
          duration_minutes?: number
          exercises_completed?: Json
          id?: string
          pain_level_after?: number | null
          pain_level_before?: number | null
          patient_id: string
          program_id?: string | null
          progress_notes?: string | null
          session_date?: string
          therapist_id: string
        }
        Update: {
          attended?: boolean
          clinic_id?: string
          created_at?: string
          duration_minutes?: number
          exercises_completed?: Json
          id?: string
          pain_level_after?: number | null
          pain_level_before?: number | null
          patient_id?: string
          program_id?: string | null
          progress_notes?: string | null
          session_date?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "physio_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "exercise_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_sessions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_billing: {
        Row: {
          amount_due: number
          amount_paid: number
          clinic_id: string
          clinic_name: string | null
          created_at: string | null
          currency: string
          due_date: string
          id: string
          invoice_date: string
          paid_date: string | null
          payment_method: string | null
          plan: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          clinic_id: string
          clinic_name?: string | null
          created_at?: string | null
          currency?: string
          due_date: string
          id?: string
          invoice_date: string
          paid_date?: string | null
          payment_method?: string | null
          plan?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          clinic_id?: string
          clinic_name?: string | null
          created_at?: string | null
          currency?: string
          due_date?: string
          id?: string
          invoice_date?: string
          paid_date?: string | null
          payment_method?: string | null
          plan?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_billing_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      pregnancies: {
        Row: {
          baby_gender: string | null
          baby_weight_kg: number | null
          birth_plan_notes: string | null
          blood_type: string | null
          clinic_id: string
          created_at: string | null
          delivery_date: string | null
          delivery_type: string | null
          doctor_id: string
          edd_date: string
          gravida: number | null
          id: string
          lmp_date: string
          notes: string | null
          para: number | null
          patient_id: string
          rh_factor: string | null
          risk_factors: Json | null
          status: string
        }
        Insert: {
          baby_gender?: string | null
          baby_weight_kg?: number | null
          birth_plan_notes?: string | null
          blood_type?: string | null
          clinic_id: string
          created_at?: string | null
          delivery_date?: string | null
          delivery_type?: string | null
          doctor_id: string
          edd_date: string
          gravida?: number | null
          id?: string
          lmp_date: string
          notes?: string | null
          para?: number | null
          patient_id: string
          rh_factor?: string | null
          risk_factors?: Json | null
          status?: string
        }
        Update: {
          baby_gender?: string | null
          baby_weight_kg?: number | null
          birth_plan_notes?: string | null
          blood_type?: string | null
          clinic_id?: string
          created_at?: string | null
          delivery_date?: string | null
          delivery_type?: string | null
          doctor_id?: string
          edd_date?: string
          gravida?: number | null
          id?: string
          lmp_date?: string
          notes?: string | null
          para?: number | null
          patient_id?: string
          rh_factor?: string | null
          risk_factors?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregnancies_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancies_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregnancies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_requests: {
        Row: {
          clinic_id: string
          created_at: string | null
          delivery_requested: boolean | null
          id: string
          image_url: string
          notes: string | null
          patient_id: string
          ready_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          delivery_requested?: boolean | null
          id?: string
          image_url: string
          notes?: string | null
          patient_id: string
          ready_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          delivery_requested?: boolean | null
          id?: string
          image_url?: string
          notes?: string | null
          patient_id?: string
          ready_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          clinic_id: string | null
          content: Json
          created_at: string | null
          doctor_id: string
          id: string
          items: Json | null
          notes: string | null
          patient_id: string
          pdf_url: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_id?: string | null
          content?: Json
          created_at?: string | null
          doctor_id: string
          id?: string
          items?: Json | null
          notes?: string | null
          patient_id: string
          pdf_url?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string | null
          content?: Json
          created_at?: string | null
          doctor_id?: string
          id?: string
          items?: Json | null
          notes?: string | null
          patient_id?: string
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          limits: Json
          name: string
          pricing: Json
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          limits?: Json
          name: string
          pricing?: Json
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          limits?: Json
          name?: string
          pricing?: Json
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          age_group: string | null
          barcode: string | null
          brand: string | null
          category: string | null
          clinic_id: string
          created_at: string | null
          currency: string | null
          description: string | null
          dosage_form: string | null
          generic_name: string | null
          id: string
          image_url: string | null
          ingredients: string | null
          is_active: boolean | null
          is_parapharmacy: boolean | null
          manufacturer: string | null
          name: string
          price: number | null
          requires_prescription: boolean | null
          skin_type: string | null
          strength: string | null
          subcategory: string | null
          usage_instructions: string | null
        }
        Insert: {
          age_group?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          clinic_id: string
          created_at?: string | null
          currency?: string | null
          description?: string | null
          dosage_form?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean | null
          is_parapharmacy?: boolean | null
          manufacturer?: string | null
          name: string
          price?: number | null
          requires_prescription?: boolean | null
          skin_type?: string | null
          strength?: string | null
          subcategory?: string | null
          usage_instructions?: string | null
        }
        Update: {
          age_group?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          clinic_id?: string
          created_at?: string | null
          currency?: string | null
          description?: string | null
          dosage_form?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean | null
          is_parapharmacy?: boolean | null
          manufacturer?: string | null
          name?: string
          price?: number | null
          requires_prescription?: boolean | null
          skin_type?: string | null
          strength?: string | null
          subcategory?: string | null
          usage_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_photos: {
        Row: {
          category: string | null
          clinic_id: string
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          photo_date: string
          photo_url: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          photo_date?: string
          photo_url: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          photo_date?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_photos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prosthetic_orders: {
        Row: {
          clinic_id: string
          completed_date: string | null
          created_at: string | null
          delivered_date: string | null
          dentist_clinic: string | null
          dentist_id: string | null
          dentist_name: string | null
          description: string | null
          due_date: string | null
          id: string
          is_paid: boolean
          material: string | null
          notes: string | null
          order_type: string
          patient_name: string | null
          price: number | null
          priority: string
          received_date: string
          shade: string | null
          special_instructions: string | null
          status: string
          tooth_numbers: number[] | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          completed_date?: string | null
          created_at?: string | null
          delivered_date?: string | null
          dentist_clinic?: string | null
          dentist_id?: string | null
          dentist_name?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_paid?: boolean
          material?: string | null
          notes?: string | null
          order_type: string
          patient_name?: string | null
          price?: number | null
          priority?: string
          received_date?: string
          shade?: string | null
          special_instructions?: string | null
          status?: string
          tooth_numbers?: number[] | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          completed_date?: string | null
          created_at?: string | null
          delivered_date?: string | null
          dentist_clinic?: string | null
          dentist_id?: string | null
          dentist_name?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_paid?: boolean
          material?: string | null
          notes?: string | null
          order_type?: string
          patient_name?: string | null
          price?: number | null
          priority?: string
          received_date?: string
          shade?: string | null
          special_instructions?: string | null
          status?: string
          tooth_numbers?: number[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prosthetic_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prosthetic_orders_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      psych_medications: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          dosage: string
          dosage_history: Json | null
          end_date: string | null
          frequency: string
          id: string
          medication_name: string
          notes: string | null
          patient_id: string
          reason: string | null
          side_effects: string | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          dosage: string
          dosage_history?: Json | null
          end_date?: string | null
          frequency: string
          id?: string
          medication_name: string
          notes?: string | null
          patient_id: string
          reason?: string | null
          side_effects?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          dosage?: string
          dosage_history?: Json | null
          end_date?: string | null
          frequency?: string
          id?: string
          medication_name?: string
          notes?: string | null
          patient_id?: string
          reason?: string | null
          side_effects?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "psych_medications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psych_medications_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psych_medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      psych_session_notes: {
        Row: {
          access_level: string | null
          clinic_id: string
          content: string | null
          created_at: string | null
          doctor_id: string
          id: string
          is_confidential: boolean | null
          mood_rating: number | null
          observations: string | null
          patient_id: string
          plan: string | null
          session_date: string
          session_number: number | null
          session_type: string | null
        }
        Insert: {
          access_level?: string | null
          clinic_id: string
          content?: string | null
          created_at?: string | null
          doctor_id: string
          id?: string
          is_confidential?: boolean | null
          mood_rating?: number | null
          observations?: string | null
          patient_id: string
          plan?: string | null
          session_date?: string
          session_number?: number | null
          session_type?: string | null
        }
        Update: {
          access_level?: string | null
          clinic_id?: string
          content?: string | null
          created_at?: string | null
          doctor_id?: string
          id?: string
          is_confidential?: boolean | null
          mood_rating?: number | null
          observations?: string | null
          patient_id?: string
          plan?: string | null
          session_date?: string
          session_number?: number | null
          session_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "psych_session_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psych_session_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psych_session_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          purchase_order_id: string
          quantity?: number
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          clinic_id: string
          created_at: string | null
          currency: string | null
          delivered_at: string | null
          expected_delivery: string | null
          id: string
          notes: string | null
          ordered_at: string | null
          received_at: string | null
          status: string | null
          supplier_id: string
          supplier_name: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          currency?: string | null
          delivered_at?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          received_at?: string | null
          status?: string | null
          supplier_id: string
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          currency?: string | null
          delivered_at?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          received_at?: string | null
          status?: string | null
          supplier_id?: string
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      radiology_images: {
        Row: {
          clinic_id: string
          content_type: string | null
          description: string | null
          dicom_metadata: Json | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          is_dicom: boolean | null
          modality: string | null
          order_id: string
          thumbnail_url: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          content_type?: string | null
          description?: string | null
          dicom_metadata?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          is_dicom?: boolean | null
          modality?: string | null
          order_id: string
          thumbnail_url?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          content_type?: string | null
          description?: string | null
          dicom_metadata?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          is_dicom?: boolean | null
          modality?: string | null
          order_id?: string
          thumbnail_url?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radiology_images_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_images_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "radiology_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      radiology_orders: {
        Row: {
          body_part: string | null
          clinic_id: string
          clinical_indication: string | null
          created_at: string | null
          findings: string | null
          id: string
          impression: string | null
          modality: string
          order_number: string
          ordering_doctor_id: string | null
          patient_id: string
          pdf_url: string | null
          performed_at: string | null
          priority: string | null
          radiologist_id: string | null
          report_template_id: string | null
          report_text: string | null
          reported_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          body_part?: string | null
          clinic_id: string
          clinical_indication?: string | null
          created_at?: string | null
          findings?: string | null
          id?: string
          impression?: string | null
          modality: string
          order_number: string
          ordering_doctor_id?: string | null
          patient_id: string
          pdf_url?: string | null
          performed_at?: string | null
          priority?: string | null
          radiologist_id?: string | null
          report_template_id?: string | null
          report_text?: string | null
          reported_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          body_part?: string | null
          clinic_id?: string
          clinical_indication?: string | null
          created_at?: string | null
          findings?: string | null
          id?: string
          impression?: string | null
          modality?: string
          order_number?: string
          ordering_doctor_id?: string | null
          patient_id?: string
          pdf_url?: string | null
          performed_at?: string | null
          priority?: string | null
          radiologist_id?: string | null
          report_template_id?: string | null
          report_text?: string | null
          reported_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radiology_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_orders_ordering_doctor_id_fkey"
            columns: ["ordering_doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_orders_radiologist_id_fkey"
            columns: ["radiologist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      radiology_report_templates: {
        Row: {
          body_part: string | null
          clinic_id: string
          created_at: string | null
          fields: Json | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          modality: string | null
          name: string
          template_text: string
          updated_at: string | null
        }
        Insert: {
          body_part?: string | null
          clinic_id: string
          created_at?: string | null
          fields?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          modality?: string | null
          name: string
          template_text: string
          updated_at?: string | null
        }
        Update: {
          body_part?: string | null
          clinic_id?: string
          created_at?: string | null
          fields?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          modality?: string | null
          name?: string
          template_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radiology_report_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      rehab_plans: {
        Row: {
          clinic_id: string
          condition: string
          created_at: string | null
          doctor_id: string
          id: string
          milestones: Json | null
          notes: string | null
          patient_id: string
          start_date: string
          status: string | null
          target_end_date: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          condition: string
          created_at?: string | null
          doctor_id: string
          id?: string
          milestones?: Json | null
          notes?: string | null
          patient_id: string
          start_date?: string
          status?: string | null
          target_end_date?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          condition?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
          milestones?: Json | null
          notes?: string | null
          patient_id?: string
          start_date?: string
          status?: string | null
          target_end_date?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rehab_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plans_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehab_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      respiratory_tests: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          id: string
          interpretation: string | null
          notes: string | null
          patient_id: string
          results: Json | null
          test_date: string
          test_type: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          id?: string
          interpretation?: string | null
          notes?: string | null
          patient_id: string
          results?: Json | null
          test_date?: string
          test_type: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
          interpretation?: string | null
          notes?: string | null
          patient_id?: string
          results?: Json | null
          test_date?: string
          test_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "respiratory_tests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respiratory_tests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respiratory_tests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          clinic_id: string
          comment: string | null
          created_at: string | null
          doctor_id: string | null
          id: string
          is_visible: boolean | null
          patient_id: string
          response: string | null
          stars: number
        }
        Insert: {
          clinic_id: string
          comment?: string | null
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          is_visible?: boolean | null
          patient_id: string
          response?: string | null
          stars: number
        }
        Update: {
          clinic_id?: string
          comment?: string | null
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          is_visible?: boolean | null
          patient_id?: string
          response?: string | null
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          clinic_id: string
          created_at: string | null
          department_id: string | null
          floor: string | null
          id: string
          is_active: boolean
          room_number: string
          room_type: string
          total_beds: number
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          department_id?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          room_number: string
          room_type: string
          total_beds?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          department_id?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          room_number?: string
          room_type?: string
          total_beds?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          clinic_id: string
          created_at: string | null
          currency: string
          date: string
          has_prescription: boolean | null
          id: string
          items: Json
          loyalty_points_earned: number | null
          patient_id: string | null
          patient_name: string | null
          payment_method: string
          time: string
          total: number
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          currency?: string
          date?: string
          has_prescription?: boolean | null
          id?: string
          items?: Json
          loyalty_points_earned?: number | null
          patient_id?: string | null
          patient_name?: string | null
          payment_method?: string
          time?: string
          total?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          currency?: string
          date?: string
          has_prescription?: boolean | null
          id?: string
          items?: Json
          loyalty_points_earned?: number | null
          patient_id?: string | null
          patient_name?: string | null
          payment_method?: string
          time?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          clinic_id: string
          created_at: string | null
          description: string | null
          duration_min: number | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          price: number | null
        }
        Insert: {
          category?: string | null
          clinic_id: string
          created_at?: string | null
          description?: string | null
          duration_min?: number | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
        }
        Update: {
          category?: string | null
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          duration_min?: number | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      skin_conditions: {
        Row: {
          body_region: string
          clinic_id: string
          condition_name: string
          created_at: string | null
          diagnosis_date: string
          doctor_id: string
          id: string
          notes: string | null
          patient_id: string
          severity: string | null
          status: string | null
          treatments: Json | null
          updated_at: string | null
        }
        Insert: {
          body_region: string
          clinic_id: string
          condition_name: string
          created_at?: string | null
          diagnosis_date?: string
          doctor_id: string
          id?: string
          notes?: string | null
          patient_id: string
          severity?: string | null
          status?: string | null
          treatments?: Json | null
          updated_at?: string | null
        }
        Update: {
          body_region?: string
          clinic_id?: string
          condition_name?: string
          created_at?: string | null
          diagnosis_date?: string
          doctor_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          severity?: string | null
          status?: string | null
          treatments?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skin_conditions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skin_conditions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skin_conditions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      skin_photos: {
        Row: {
          body_region: string
          clinic_id: string
          created_at: string | null
          description: string | null
          doctor_id: string
          id: string
          image_url: string | null
          patient_id: string
          photo_date: string
          tags: string[] | null
        }
        Insert: {
          body_region: string
          clinic_id: string
          created_at?: string | null
          description?: string | null
          doctor_id: string
          id?: string
          image_url?: string | null
          patient_id: string
          photo_date?: string
          tags?: string[] | null
        }
        Update: {
          body_region?: string
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          doctor_id?: string
          id?: string
          image_url?: string | null
          patient_id?: string
          photo_date?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "skin_photos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skin_photos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skin_photos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      speech_exercises: {
        Row: {
          category: string
          clinic_id: string
          created_at: string
          description: string
          difficulty: string
          duration_minutes: number
          id: string
          instructions: string
          materials_needed: string | null
          name: string
          target_sounds: Json
        }
        Insert: {
          category: string
          clinic_id: string
          created_at?: string
          description?: string
          difficulty?: string
          duration_minutes?: number
          id?: string
          instructions?: string
          materials_needed?: string | null
          name: string
          target_sounds?: Json
        }
        Update: {
          category?: string
          clinic_id?: string
          created_at?: string
          description?: string
          difficulty?: string
          duration_minutes?: number
          id?: string
          instructions?: string
          materials_needed?: string | null
          name?: string
          target_sounds?: Json
        }
        Relationships: [
          {
            foreignKeyName: "speech_exercises_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      speech_progress_reports: {
        Row: {
          areas_of_concern: Json
          areas_of_improvement: Json
          clinic_id: string
          created_at: string
          goals_summary: string
          id: string
          next_steps: string
          overall_progress: string
          patient_id: string
          period_end: string
          period_start: string
          progress_summary: string
          recommendations: string
          report_date: string
          therapist_id: string
        }
        Insert: {
          areas_of_concern?: Json
          areas_of_improvement?: Json
          clinic_id: string
          created_at?: string
          goals_summary?: string
          id?: string
          next_steps?: string
          overall_progress?: string
          patient_id: string
          period_end: string
          period_start: string
          progress_summary?: string
          recommendations?: string
          report_date?: string
          therapist_id: string
        }
        Update: {
          areas_of_concern?: Json
          areas_of_improvement?: Json
          clinic_id?: string
          created_at?: string
          goals_summary?: string
          id?: string
          next_steps?: string
          overall_progress?: string
          patient_id?: string
          period_end?: string
          period_start?: string
          progress_summary?: string
          recommendations?: string
          report_date?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speech_progress_reports_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speech_progress_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speech_progress_reports_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      speech_sessions: {
        Row: {
          accuracy_pct: number | null
          attended: boolean
          clinic_id: string
          created_at: string
          duration_minutes: number
          exercises_assigned: Json
          exercises_completed: Json
          home_practice: string | null
          id: string
          notes: string | null
          patient_id: string
          session_date: string
          therapist_id: string
        }
        Insert: {
          accuracy_pct?: number | null
          attended?: boolean
          clinic_id: string
          created_at?: string
          duration_minutes?: number
          exercises_assigned?: Json
          exercises_completed?: Json
          home_practice?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          session_date?: string
          therapist_id: string
        }
        Update: {
          accuracy_pct?: number | null
          attended?: boolean
          clinic_id?: string
          created_at?: string
          duration_minutes?: number
          exercises_assigned?: Json
          exercises_completed?: Json
          home_practice?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          session_date?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speech_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speech_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speech_sessions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      spirometry_records: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          fev1: number | null
          fev1_fvc_ratio: number | null
          fvc: number | null
          id: string
          interpretation: string | null
          notes: string | null
          patient_id: string
          pef: number | null
          test_date: string
          test_quality: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          fev1?: number | null
          fev1_fvc_ratio?: number | null
          fvc?: number | null
          id?: string
          interpretation?: string | null
          notes?: string | null
          patient_id: string
          pef?: number | null
          test_date?: string
          test_quality?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          fev1?: number | null
          fev1_fvc_ratio?: number | null
          fvc?: number | null
          id?: string
          interpretation?: string | null
          notes?: string | null
          patient_id?: string
          pef?: number | null
          test_date?: string
          test_quality?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spirometry_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spirometry_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spirometry_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sterilization_log: {
        Row: {
          batch_number: string | null
          clinic_id: string
          cycle_number: number | null
          id: string
          method: string | null
          next_due: string | null
          notes: string | null
          sterilized_at: string
          sterilized_by: string | null
          tool_name: string
        }
        Insert: {
          batch_number?: string | null
          clinic_id: string
          cycle_number?: number | null
          id?: string
          method?: string | null
          next_due?: string | null
          notes?: string | null
          sterilized_at?: string
          sterilized_by?: string | null
          tool_name: string
        }
        Update: {
          batch_number?: string | null
          clinic_id?: string
          cycle_number?: number | null
          id?: string
          method?: string | null
          next_due?: string | null
          notes?: string | null
          sterilized_at?: string
          sterilized_by?: string | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sterilization_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          batch_number: string | null
          clinic_id: string
          expiry_date: string | null
          id: string
          min_threshold: number | null
          product_id: string
          quantity: number
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          batch_number?: string | null
          clinic_id: string
          expiry_date?: string | null
          id?: string
          min_threshold?: number | null
          product_id: string
          quantity?: number
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_number?: string | null
          clinic_id?: string
          expiry_date?: string | null
          id?: string
          min_threshold?: number | null
          product_id?: string
          quantity?: number
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          download_url: string | null
          id: string
          paid_date: string | null
          status: string
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          download_url?: string | null
          id?: string
          paid_date?: string | null
          status?: string
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          download_url?: string | null
          id?: string
          paid_date?: string | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          auto_renew: boolean | null
          billing_cycle: string
          cancelled_at: string | null
          clinic_id: string
          clinic_name: string | null
          created_at: string | null
          currency: string
          current_period_end: string
          current_period_start: string
          id: string
          payment_method: string | null
          status: string
          system_type: string
          tier_name: string | null
          tier_slug: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          auto_renew?: boolean | null
          billing_cycle?: string
          cancelled_at?: string | null
          clinic_id: string
          clinic_name?: string | null
          created_at?: string | null
          currency?: string
          current_period_end: string
          current_period_start: string
          id?: string
          payment_method?: string | null
          status?: string
          system_type: string
          tier_name?: string | null
          tier_slug: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          auto_renew?: boolean | null
          billing_cycle?: string
          cancelled_at?: string | null
          clinic_id?: string
          clinic_name?: string | null
          created_at?: string | null
          currency?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          payment_method?: string | null
          status?: string
          system_type?: string
          tier_name?: string | null
          tier_slug?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          categories: string[] | null
          city: string | null
          clinic_id: string
          contact_person: string | null
          created_at: string | null
          delivery_days: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms: string | null
          phone: string | null
          products: Json | null
          rating: number | null
        }
        Insert: {
          address?: string | null
          categories?: string[] | null
          city?: string | null
          clinic_id: string
          contact_person?: string | null
          created_at?: string | null
          delivery_days?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          products?: Json | null
          rating?: number | null
        }
        Update: {
          address?: string | null
          categories?: string[] | null
          city?: string | null
          clinic_id?: string
          contact_person?: string | null
          created_at?: string | null
          delivery_days?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          products?: Json | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      therapy_plans: {
        Row: {
          clinic_id: string
          created_at: string
          diagnosis: string | null
          goals: Json
          id: string
          notes: string | null
          patient_id: string
          review_date: string | null
          start_date: string
          status: string
          therapist_id: string
          treatment_approach: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          diagnosis?: string | null
          goals?: Json
          id?: string
          notes?: string | null
          patient_id: string
          review_date?: string | null
          start_date?: string
          status?: string
          therapist_id: string
          treatment_approach?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          diagnosis?: string | null
          goals?: Json
          id?: string
          notes?: string | null
          patient_id?: string
          review_date?: string | null
          start_date?: string
          status?: string
          therapist_id?: string
          treatment_approach?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_plans_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      therapy_session_notes: {
        Row: {
          clinic_id: string
          created_at: string
          duration_minutes: number
          homework: string | null
          id: string
          interventions: string | null
          is_confidential: boolean
          mood_rating: number | null
          next_session_date: string | null
          observations: string | null
          patient_id: string
          presenting_issues: string | null
          risk_assessment: string | null
          session_date: string
          session_number: number
          session_type: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          duration_minutes?: number
          homework?: string | null
          id?: string
          interventions?: string | null
          is_confidential?: boolean
          mood_rating?: number | null
          next_session_date?: string | null
          observations?: string | null
          patient_id: string
          presenting_issues?: string | null
          risk_assessment?: string | null
          session_date?: string
          session_number?: number
          session_type?: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          duration_minutes?: number
          homework?: string | null
          id?: string
          interventions?: string | null
          is_confidential?: boolean
          mood_rating?: number | null
          next_session_date?: string | null
          observations?: string | null
          patient_id?: string
          presenting_issues?: string | null
          risk_assessment?: string | null
          session_date?: string
          session_number?: number
          session_type?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_session_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_session_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_session_notes_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      time_slots: {
        Row: {
          buffer_min: number | null
          buffer_minutes: number | null
          clinic_id: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id: string
          is_active: boolean | null
          is_available: boolean | null
          max_capacity: number | null
          start_time: string
        }
        Insert: {
          buffer_min?: number | null
          buffer_minutes?: number | null
          clinic_id: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          max_capacity?: number | null
          start_time: string
        }
        Update: {
          buffer_min?: number | null
          buffer_minutes?: number | null
          clinic_id?: string
          day_of_week?: number
          doctor_id?: string
          end_time?: string
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          max_capacity?: number | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_slots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_packages: {
        Row: {
          clinic_id: string
          created_at: string | null
          description: string | null
          discount_percent: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          services: Json
          total_sessions: number
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          services?: Json
          total_sessions?: number
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          services?: Json
          total_sessions?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_packages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          doctor_id: string
          id: string
          patient_id: string
          status: string | null
          steps: Json
          title: string | null
          total_cost: number | null
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          doctor_id: string
          id?: string
          patient_id: string
          status?: string | null
          steps?: Json
          title?: string | null
          total_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          doctor_id?: string
          id?: string
          patient_id?: string
          status?: string | null
          steps?: Json
          title?: string | null
          total_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ultrasound_records: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          findings: string | null
          gestational_days: number | null
          gestational_weeks: number | null
          id: string
          image_urls: Json | null
          measurements: Json | null
          notes: string | null
          patient_id: string
          pregnancy_id: string
          scan_date: string
          trimester: number
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          findings?: string | null
          gestational_days?: number | null
          gestational_weeks?: number | null
          id?: string
          image_urls?: Json | null
          measurements?: Json | null
          notes?: string | null
          patient_id: string
          pregnancy_id: string
          scan_date?: string
          trimester: number
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          findings?: string | null
          gestational_days?: number | null
          gestational_weeks?: number | null
          id?: string
          image_urls?: Json | null
          measurements?: Json | null
          notes?: string | null
          patient_id?: string
          pregnancy_id?: string
          scan_date?: string
          trimester?: number
        }
        Relationships: [
          {
            foreignKeyName: "ultrasound_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultrasound_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultrasound_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultrasound_records_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "pregnancies"
            referencedColumns: ["id"]
          },
        ]
      }
      urology_exams: {
        Row: {
          clinic_id: string
          created_at: string | null
          diagnosis: string | null
          doctor_id: string
          exam_date: string
          findings: Json | null
          id: string
          lab_results: Json | null
          patient_id: string
          plan: string | null
          template_type: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          diagnosis?: string | null
          doctor_id: string
          exam_date?: string
          findings?: Json | null
          id?: string
          lab_results?: Json | null
          patient_id: string
          plan?: string | null
          template_type?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string
          exam_date?: string
          findings?: Json | null
          id?: string
          lab_results?: Json | null
          patient_id?: string
          plan?: string | null
          template_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "urology_exams_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "urology_exams_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "urology_exams_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          clinic_id: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          phone?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccinations: {
        Row: {
          administered_date: string | null
          clinic_id: string
          created_at: string | null
          doctor_id: string | null
          dose_number: number
          id: string
          lot_number: string | null
          notes: string | null
          patient_id: string
          scheduled_date: string
          site: string | null
          status: string
          vaccine_name: string
        }
        Insert: {
          administered_date?: string | null
          clinic_id: string
          created_at?: string | null
          doctor_id?: string | null
          dose_number?: number
          id?: string
          lot_number?: string | null
          notes?: string | null
          patient_id: string
          scheduled_date: string
          site?: string | null
          status?: string
          vaccine_name: string
        }
        Update: {
          administered_date?: string | null
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string | null
          dose_number?: number
          id?: string
          lot_number?: string | null
          notes?: string | null
          patient_id?: string
          scheduled_date?: string
          site?: string | null
          status?: string
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vision_tests: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          id: string
          notes: string | null
          od_acuity: string | null
          od_add: number | null
          od_axis: number | null
          od_cylinder: number | null
          od_sphere: number | null
          os_acuity: string | null
          os_add: number | null
          os_axis: number | null
          os_cylinder: number | null
          os_sphere: number | null
          patient_id: string
          pd_mm: number | null
          test_date: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          id?: string
          notes?: string | null
          od_acuity?: string | null
          od_add?: number | null
          od_axis?: number | null
          od_cylinder?: number | null
          od_sphere?: number | null
          os_acuity?: string | null
          os_add?: number | null
          os_axis?: number | null
          os_cylinder?: number | null
          os_sphere?: number | null
          patient_id: string
          pd_mm?: number | null
          test_date?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
          notes?: string | null
          od_acuity?: string | null
          od_add?: number | null
          od_axis?: number | null
          od_cylinder?: number | null
          od_sphere?: number | null
          os_acuity?: string | null
          os_add?: number | null
          os_axis?: number | null
          os_cylinder?: number | null
          os_sphere?: number | null
          patient_id?: string
          pd_mm?: number | null
          test_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "vision_tests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vision_tests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vision_tests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_list: {
        Row: {
          clinic_id: string
          created_at: string | null
          doctor_id: string
          id: string
          notified_at: string | null
          patient_id: string
          preferred_date: string | null
          preferred_time: string | null
          service_id: string | null
          status: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doctor_id: string
          id?: string
          notified_at?: string | null
          patient_id: string
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          status?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doctor_id?: string
          id?: string
          notified_at?: string | null
          patient_id?: string
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      xray_records: {
        Row: {
          annotations: Json | null
          body_part: string
          clinic_id: string
          created_at: string | null
          diagnosis: string | null
          doctor_id: string
          findings: string | null
          id: string
          image_url: string | null
          patient_id: string
          record_date: string
        }
        Insert: {
          annotations?: Json | null
          body_part: string
          clinic_id: string
          created_at?: string | null
          diagnosis?: string | null
          doctor_id: string
          findings?: string | null
          id?: string
          image_url?: string | null
          patient_id: string
          record_date?: string
        }
        Update: {
          annotations?: Json | null
          body_part?: string
          clinic_id?: string
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string
          findings?: string | null
          id?: string
          image_url?: string | null
          patient_id?: string
          record_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "xray_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xray_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xray_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_user_id: { Args: never; Returns: string }
      get_user_clinic_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      is_clinic_admin: { Args: { check_clinic_id: string }; Returns: boolean }
      is_clinic_staff: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// ---- Custom type aliases (not generated by Supabase CLI) ----

export type UserRole =
  | "super_admin"
  | "clinic_admin"
  | "receptionist"
  | "doctor"
  | "patient";

export type ClinicType = "doctor" | "dentist" | "pharmacy";

export type ClinicTypeCategory =
  | "medical"
  | "para_medical"
  | "diagnostic"
  | "pharmacy_retail"
  | "clinics_centers";

export type ClinicTier = "vitrine" | "cabinet" | "pro" | "premium" | "saas";

export type ClinicStatus = "active" | "inactive" | "suspended";

export type AppointmentStatus =
  | "pending"
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled"
  | "rescheduled";

export type BookingSource = "online" | "phone" | "walk_in" | "whatsapp";

export type PaymentMethod = "cash" | "card" | "transfer" | "online" | "insurance";

export type PaymentStatus = "pending" | "completed" | "refunded" | "failed";

export type NotificationChannel = "whatsapp" | "email" | "sms" | "in_app";

export type DocumentType =
  | "prescription"
  | "lab_result"
  | "xray"
  | "insurance"
  | "invoice"
  | "photo"
  | "other";

export type WaitingListStatus = "waiting" | "notified" | "booked" | "expired";

export type ToothStatus =
  | "healthy"
  | "decayed"
  | "filled"
  | "missing"
  | "crown"
  | "implant"
  | "root_canal"
  | "extraction_needed";

export type TreatmentPlanStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type LabOrderStatus =
  | "pending"
  | "sent"
  | "in_progress"
  | "ready"
  | "delivered";

export type InstallmentStatus = "pending" | "paid" | "overdue";

export type PrescriptionRequestStatus =
  | "pending"
  | "reviewing"
  | "ready"
  | "partial"
  | "delivered"
  | "cancelled";

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "received"
  | "cancelled";

export type RecurrencePattern = "weekly" | "biweekly" | "monthly";

export type LabTestOrderStatus =
  | "pending"
  | "sample_collected"
  | "in_progress"
  | "completed"
  | "validated"
  | "cancelled";

export type LabTestPriority = "normal" | "urgent" | "stat";

export type RadiologyModality =
  | "xray"
  | "ct"
  | "mri"
  | "ultrasound"
  | "mammography"
  | "pet"
  | "fluoroscopy"
  | "other";

export type RadiologyOrderStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "images_ready"
  | "reported"
  | "validated"
  | "cancelled";

export type ResultFlag = "normal" | "high" | "low" | "critical_high" | "critical_low";

export type EquipmentCondition = "new" | "good" | "fair" | "needs_repair" | "decommissioned";

export type RentalStatus = "reserved" | "active" | "returned" | "overdue" | "cancelled";

export type RentalPaymentStatus = "pending" | "partial" | "paid" | "refunded";

export type MaintenanceType = "routine" | "repair" | "calibration" | "inspection" | "cleaning";

export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multiselect"
  | "textarea"
  | "file";

export type CustomFieldEntityType =
  | "patient"
  | "appointment"
  | "consultation"
  | "prescription"
  | "invoice";

// -- IVF / Fertility Center --

export type IVFCycleType = "ivf" | "icsi" | "iui" | "fet" | "egg_freezing" | "other";

export type IVFCycleStatus = "planned" | "stimulation" | "retrieval" | "fertilization" | "transfer" | "tww" | "completed" | "cancelled";

export type IVFOutcome = "positive" | "negative" | "biochemical" | "miscarriage" | "ongoing" | "pending";

export type IVFProtocolType = "long" | "short" | "antagonist" | "natural" | "mini_ivf" | "custom";

export type IVFTimelineEventType = "medication_start" | "scan" | "blood_test" | "trigger" | "retrieval" | "fertilization_report" | "transfer" | "beta_test" | "follow_up" | "other";

// -- Dialysis Center --

export type DialysisMachineStatus = "available" | "in_use" | "maintenance" | "out_of_service";

export type DialysisSessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";

export type DialysisRecurrencePattern = "mon_wed_fri" | "tue_thu_sat" | "custom";

export type DialysisAccessType = "fistula" | "graft" | "catheter";

// -- Dental Lab --

export type ProstheticOrderType = "crown" | "bridge" | "denture" | "implant_abutment" | "veneer" | "inlay_onlay" | "orthodontic" | "other";

export type ProstheticOrderStatus = "received" | "in_progress" | "quality_check" | "ready" | "delivered" | "returned";

export type ProstheticPriority = "normal" | "urgent" | "rush";

export type DeliveryCondition = "good" | "damaged" | "incomplete";

export type LabInvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
