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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      hyro_license_permissions: {
        Row: {
          created_at: string
          license_id: string
          perms: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          license_id: string
          perms?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          license_id?: string
          perms?: Json
          updated_at?: string
        }
        Relationships: []
      }
      hyro_partner_plans_config: {
        Row: {
          id: number
          plans: Json
          updated_at: string
        }
        Insert: {
          id?: number
          plans?: Json
          updated_at?: string
        }
        Update: {
          id?: number
          plans?: Json
          updated_at?: string
        }
        Relationships: []
      }
      hyro_payment_integrations: {
        Row: {
          access_token: string
          account_info: Json
          active: boolean
          created_at: string
          id: string
          mode: string
          provider: string
          public_key: string | null
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          access_token: string
          account_info?: Json
          active?: boolean
          created_at?: string
          id?: string
          mode?: string
          provider: string
          public_key?: string | null
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string
          account_info?: Json
          active?: boolean
          created_at?: string
          id?: string
          mode?: string
          provider?: string
          public_key?: string | null
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      hyro_payment_orders: {
        Row: {
          amount_cents: number
          client_user_id: string
          created_at: string
          currency: string
          expires_at: string | null
          external_reference: string | null
          id: string
          license_id: string
          paid_at: string | null
          payer_cpf: string | null
          payer_email: string | null
          payer_name: string | null
          provider: string
          provider_payment_id: string | null
          qr_code: string | null
          qr_code_base64: string | null
          raw_payload: Json | null
          renewal_days: number
          reseller_user_id: string
          status: string
          ticket_url: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          client_user_id: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_reference?: string | null
          id?: string
          license_id: string
          paid_at?: string | null
          payer_cpf?: string | null
          payer_email?: string | null
          payer_name?: string | null
          provider?: string
          provider_payment_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          raw_payload?: Json | null
          renewal_days: number
          reseller_user_id: string
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          client_user_id?: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          external_reference?: string | null
          id?: string
          license_id?: string
          paid_at?: string | null
          payer_cpf?: string | null
          payer_email?: string | null
          payer_name?: string | null
          provider?: string
          provider_payment_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          raw_payload?: Json | null
          renewal_days?: number
          reseller_user_id?: string
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hyro_redemption_links: {
        Row: {
          claimed_at: string | null
          claimed_user_id: string | null
          created_at: string
          created_by: string
          kind: string
          license_id: string | null
          locked_ip: string | null
          reseller_owner_id: string | null
          reseller_slots: number | null
          slug: string
          target_email: string
          target_name: string | null
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_user_id?: string | null
          created_at?: string
          created_by?: string
          kind?: string
          license_id?: string | null
          locked_ip?: string | null
          reseller_owner_id?: string | null
          reseller_slots?: number | null
          slug: string
          target_email: string
          target_name?: string | null
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_user_id?: string | null
          created_at?: string
          created_by?: string
          kind?: string
          license_id?: string | null
          locked_ip?: string | null
          reseller_owner_id?: string | null
          reseller_slots?: number | null
          slug?: string
          target_email?: string
          target_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hyro_reseller_activity: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          event: string
          id: string
          ip: string | null
          metadata: Json
          path: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event: string
          id?: string
          ip?: string | null
          metadata?: Json
          path?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event?: string
          id?: string
          ip?: string | null
          metadata?: Json
          path?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      hyro_reseller_presence: {
        Row: {
          actor_email: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          ip: string | null
          last_seen: string
          path: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          actor_email: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          ip?: string | null
          last_seen?: string
          path?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          actor_email?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          ip?: string | null
          last_seen?: string
          path?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      hyro_reseller_pricing: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          id: string
          renewal_days: number
          renewal_price_cents: number
          reseller_user_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          id?: string
          renewal_days?: number
          renewal_price_cents?: number
          reseller_user_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          id?: string
          renewal_days?: number
          renewal_price_cents?: number
          reseller_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hyro_telegram_allowed_users: {
        Row: {
          created_at: string
          is_super: boolean
          note: string | null
          telegram_id: string
        }
        Insert: {
          created_at?: string
          is_super?: boolean
          note?: string | null
          telegram_id: string
        }
        Update: {
          created_at?: string
          is_super?: boolean
          note?: string | null
          telegram_id?: string
        }
        Relationships: []
      }
      hyro_telegram_bot_state: {
        Row: {
          state: Json
          telegram_id: string
          updated_at: string
        }
        Insert: {
          state?: Json
          telegram_id: string
          updated_at?: string
        }
        Update: {
          state?: Json
          telegram_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hyro_telegram_config: {
        Row: {
          id: number
          last_error: string | null
          updated_at: string
          webhook_set_at: string | null
          webhook_url: string | null
        }
        Insert: {
          id?: number
          last_error?: string | null
          updated_at?: string
          webhook_set_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          id?: number
          last_error?: string | null
          updated_at?: string
          webhook_set_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      hyro_tutorials: {
        Row: {
          created_at: string
          description: string
          duration: string | null
          id: string
          sort_order: number
          thumbnail_path: string | null
          title: string
          updated_at: string
          video_mime: string | null
          video_path: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          duration?: string | null
          id: string
          sort_order?: number
          thumbnail_path?: string | null
          title: string
          updated_at?: string
          video_mime?: string | null
          video_path?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          duration?: string | null
          id?: string
          sort_order?: number
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          video_mime?: string | null
          video_path?: string | null
        }
        Relationships: []
      }
      hyro_user_flags: {
        Row: {
          first_ip: string | null
          tutorial_seen: boolean
          updated_at: string
          user_email: string
          welcome_seen: boolean
        }
        Insert: {
          first_ip?: string | null
          tutorial_seen?: boolean
          updated_at?: string
          user_email: string
          welcome_seen?: boolean
        }
        Update: {
          first_ip?: string | null
          tutorial_seen?: boolean
          updated_at?: string
          user_email?: string
          welcome_seen?: boolean
        }
        Relationships: []
      }
      hyro_user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
