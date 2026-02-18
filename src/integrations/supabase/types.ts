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
      agent_outputs: {
        Row: {
          agent_name: string
          created_at: string
          id: string
          is_approved: boolean
          output_data: Json
          output_type: string
          project_id: string
          title: string
          version: number
        }
        Insert: {
          agent_name: string
          created_at?: string
          id?: string
          is_approved?: boolean
          output_data?: Json
          output_type?: string
          project_id: string
          title?: string
          version?: number
        }
        Update: {
          agent_name?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          output_data?: Json
          output_type?: string
          project_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_outputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompts: {
        Row: {
          agent_code: string
          created_at: string
          id: string
          is_active: boolean
          system_prompt: string
          version: number
        }
        Insert: {
          agent_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          system_prompt: string
          version?: number
        }
        Update: {
          agent_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          system_prompt?: string
          version?: number
        }
        Relationships: []
      }
      agent_tasks: {
        Row: {
          agent_name: string
          completed_at: string | null
          created_at: string
          id: string
          project_id: string
          status: string
        }
        Insert: {
          agent_name: string
          completed_at?: string | null
          created_at?: string
          id?: string
          project_id: string
          status?: string
        }
        Update: {
          agent_name?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agent_name: string
          content: string
          created_at: string
          id: string
          project_id: string
          role: string
        }
        Insert: {
          agent_name: string
          content: string
          created_at?: string
          id?: string
          project_id: string
          role: string
        }
        Update: {
          agent_name?: string
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_code: string
          cost_usd: number
          created_at: string
          id: string
          messages: Json
          project_id: string
          tokens_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_code: string
          cost_usd?: number
          created_at?: string
          id?: string
          messages?: Json
          project_id: string
          tokens_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_code?: string
          cost_usd?: number
          created_at?: string
          id?: string
          messages?: Json
          project_id?: string
          tokens_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          name: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string
          name: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          name?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          agent_code: string
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          agent_code: string
          category?: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          agent_code?: string
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans_config: {
        Row: {
          created_at: string
          creatives_limit: number
          features: Json
          id: string
          image_model: string
          interactions_limit: number
          is_active: boolean
          llm_model: string
          plan_code: string
          plan_name: string
          price_brl: number
          projects_limit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creatives_limit?: number
          features?: Json
          id?: string
          image_model?: string
          interactions_limit?: number
          is_active?: boolean
          llm_model?: string
          plan_code: string
          plan_name: string
          price_brl?: number
          projects_limit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creatives_limit?: number
          features?: Json
          id?: string
          image_model?: string
          interactions_limit?: number
          is_active?: boolean
          llm_model?: string
          plan_code?: string
          plan_name?: string
          price_brl?: number
          projects_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          creatives_limit: number
          creatives_used: number
          id: string
          interactions_limit: number
          interactions_used: number
          name: string
          onboarding_completed: boolean
          plan: string
          plan_status: string
          projects_limit: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creatives_limit?: number
          creatives_used?: number
          id?: string
          interactions_limit?: number
          interactions_used?: number
          name?: string
          onboarding_completed?: boolean
          plan?: string
          plan_status?: string
          projects_limit?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creatives_limit?: number
          creatives_used?: number
          id?: string
          interactions_limit?: number
          interactions_used?: number
          name?: string
          onboarding_completed?: boolean
          plan?: string
          plan_status?: string
          projects_limit?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          faturamento: string | null
          has_product: boolean | null
          id: string
          name: string
          nicho: string | null
          objetivo: string | null
          product_description: string | null
          progress: Json
          publico_alvo: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          faturamento?: string | null
          has_product?: boolean | null
          id?: string
          name?: string
          nicho?: string | null
          objetivo?: string | null
          product_description?: string | null
          progress?: Json
          publico_alvo?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          faturamento?: string | null
          has_product?: boolean | null
          id?: string
          name?: string
          nicho?: string | null
          objetivo?: string | null
          product_description?: string | null
          progress?: Json
          publico_alvo?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          action: string
          agent_code: string
          cost_usd: number
          created_at: string
          id: string
          model_used: string | null
          project_id: string | null
          tokens_input: number
          tokens_output: number
          user_id: string
        }
        Insert: {
          action?: string
          agent_code: string
          cost_usd?: number
          created_at?: string
          id?: string
          model_used?: string | null
          project_id?: string | null
          tokens_input?: number
          tokens_output?: number
          user_id: string
        }
        Update: {
          action?: string
          agent_code?: string
          cost_usd?: number
          created_at?: string
          id?: string
          model_used?: string | null
          project_id?: string | null
          tokens_input?: number
          tokens_output?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
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
      increment_profile_usage: {
        Args: { _field: string; _user_id: string }
        Returns: undefined
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
