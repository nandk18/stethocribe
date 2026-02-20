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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clinical_notes: {
        Row: {
          audio_url: string | null
          created_at: string | null
          doctor_id: string
          id: string
          language_detected: string | null
          raw_transcript: string | null
          soap_notes: Json | null
          visit_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          doctor_id: string
          id?: string
          language_detected?: string | null
          raw_transcript?: string | null
          soap_notes?: Json | null
          visit_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          doctor_id?: string
          id?: string
          language_detected?: string | null
          raw_transcript?: string | null
          soap_notes?: Json | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          letterhead_url: string | null
          logo_url: string | null
          name: string
          onboarding_complete: boolean | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          letterhead_url?: string | null
          logo_url?: string | null
          name: string
          onboarding_complete?: boolean | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          letterhead_url?: string | null
          logo_url?: string | null
          name?: string
          onboarding_complete?: boolean | null
          phone?: string | null
        }
        Relationships: []
      }
      doctors: {
        Row: {
          availability: string | null
          clinic_id: string
          created_at: string | null
          id: string
          name: string
          qualification: string | null
          registration_number: string | null
          signature_url: string | null
          specialty: string | null
          user_id: string
        }
        Insert: {
          availability?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          name: string
          qualification?: string | null
          registration_number?: string | null
          signature_url?: string | null
          specialty?: string | null
          user_id: string
        }
        Update: {
          availability?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          name?: string
          qualification?: string | null
          registration_number?: string | null
          signature_url?: string | null
          specialty?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      document_shares: {
        Row: {
          id: string
          prescription_id: string
          recipient: string | null
          shared_at: string | null
          shared_via: string
        }
        Insert: {
          id?: string
          prescription_id: string
          recipient?: string | null
          shared_at?: string | null
          shared_via: string
        }
        Update: {
          id?: string
          prescription_id?: string
          recipient?: string | null
          shared_at?: string | null
          shared_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          allergies: Json | null
          blood_group: string | null
          chronic_conditions: Json | null
          clinic_id: string
          created_at: string | null
          dob: string | null
          email: string | null
          gender: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          allergies?: Json | null
          blood_group?: string | null
          chronic_conditions?: Json | null
          clinic_id: string
          created_at?: string | null
          dob?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          allergies?: Json | null
          blood_group?: string | null
          chronic_conditions?: Json | null
          clinic_id?: string
          created_at?: string | null
          dob?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string | null
          doctor_id: string
          follow_up_date: string | null
          id: string
          investigations: Json | null
          medications: Json | null
          notes: string | null
          pdf_url: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string | null
          doctor_id: string
          follow_up_date?: string | null
          id?: string
          investigations?: Json | null
          medications?: Json | null
          notes?: string | null
          pdf_url?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string | null
          doctor_id?: string
          follow_up_date?: string | null
          id?: string
          investigations?: Json | null
          medications?: Json | null
          notes?: string | null
          pdf_url?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          chief_complaint: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          doctor_id: string | null
          id: string
          patient_id: string
          status: string | null
          token_number: number
          visit_date: string | null
          vitals: Json | null
        }
        Insert: {
          chief_complaint?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          patient_id: string
          status?: string | null
          token_number: number
          visit_date?: string | null
          vitals?: Json | null
        }
        Update: {
          chief_complaint?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          doctor_id?: string | null
          id?: string
          patient_id?: string
          status?: string | null
          token_number?: number
          visit_date?: string | null
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_clinic_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "doctor" | "receptionist"
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
    Enums: {
      app_role: ["admin", "doctor", "receptionist"],
    },
  },
} as const
