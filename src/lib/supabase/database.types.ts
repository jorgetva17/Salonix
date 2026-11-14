
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "commission_rates": {
                  Row: {
                    "created_at": string,"id": string,"percent": number,"professional_id": string,"salon_id": string,"service_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"percent": number,"professional_id": string,"salon_id": string,"service_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"percent"?: number,"professional_id"?: string,"salon_id"?: string,"service_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "commission_rates_professional_id_salon_id_fkey"
      columns: ["professional_id","salon_id"]
isOneToOne: false
      referencedRelation: "professionals"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "commission_rates_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commission_rates_service_id_salon_id_fkey"
      columns: ["service_id","salon_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","salon_id"]
    }
                  ]
                },"feature_flags": {
                  Row: {
                    "card_reconciliation": boolean,"pix_webhook": boolean,"salon_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_reconciliation"?: boolean,"pix_webhook"?: boolean,"salon_id": string,"updated_at"?: string
                  }
                  Update: {
                    "card_reconciliation"?: boolean,"pix_webhook"?: boolean,"salon_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feature_flags_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: true
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"professional_schedules": {
                  Row: {
                    "created_at": string,"ends_at": string,"id": string,"professional_id": string,"salon_id": string,"starts_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at": string,"id"?: string,"professional_id": string,"salon_id": string,"starts_at": string,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string,"id"?: string,"professional_id"?: string,"salon_id"?: string,"starts_at"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "professional_schedules_professional_id_salon_id_fkey"
      columns: ["professional_id","salon_id"]
isOneToOne: false
      referencedRelation: "professionals"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "professional_schedules_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"professionals": {
                  Row: {
                    "active": boolean,"color": string,"created_at": string,"id": string,"name": string,"salon_id": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"color": string,"created_at"?: string,"id"?: string,"name": string,"salon_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"color"?: string,"created_at"?: string,"id"?: string,"name"?: string,"salon_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "professionals_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"phone": string | null,"theme": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string,"id": string,"phone"?: string | null,"theme"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"theme"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"salon_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["salon_role"],"salon_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"role": Database["public"]['Enums']["salon_role"],"salon_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["salon_role"],"salon_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "salon_invites_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"salon_members": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"role": Database["public"]['Enums']["salon_role"],"salon_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"role": Database["public"]['Enums']["salon_role"],"salon_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["salon_role"],"salon_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "salon_members_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"salons": {
                  Row: {
                    "created_at": string,"id": string,"logo_dark_path": string | null,"logo_light_path": string | null,"name": string,"phone": string | null,"slug": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"logo_dark_path"?: string | null,"logo_light_path"?: string | null,"name": string,"phone"?: string | null,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"logo_dark_path"?: string | null,"logo_light_path"?: string | null,"name"?: string,"phone"?: string | null,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"schedule_blocks": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string,"id": string,"kind": string,"note": string | null,"professional_id": string,"salon_id": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"kind": string,"note"?: string | null,"professional_id": string,"salon_id": string,"starts_at": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"kind"?: string,"note"?: string | null,"professional_id"?: string,"salon_id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedule_blocks_professional_id_salon_id_fkey"
      columns: ["professional_id","salon_id"]
isOneToOne: false
      referencedRelation: "professionals"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "schedule_blocks_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "active": boolean,"created_at": string,"duration_minutes": number,"id": string,"name": string,"price_cents": number,"salon_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"duration_minutes": number,"id"?: string,"name": string,"price_cents": number,"salon_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"duration_minutes"?: number,"id"?: string,"name"?: string,"price_cents"?: number,"salon_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_invite_id": string }; Returns: {
              "active": boolean,
"created_at": string,
"id": string,
"role": Database["public"]['Enums']["salon_role"],
"salon_id": string,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "salon_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"commission_percent_for":
{ Args: { "p_professional_id": string,"p_service_id": string }; Returns: number
                           },
"create_salon":
{ Args: { "p_name": string,"p_phone"?: string }; Returns: {
              "created_at": string,
"id": string,
"logo_dark_path": string | null,
"logo_light_path": string | null,
"name": string,
"phone": string | null,
"slug": string,
"timezone": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "salons"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_schedule_block":
{ Args: { "p_ends_local": string,"p_kind": string,"p_note"?: string,"p_professional_id": string,"p_starts_local": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"ends_at": string,
"id": string,
"kind": string,
"note": string | null,
"professional_id": string,
"salon_id": string,
"starts_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "schedule_blocks"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_confirmed_email":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"decline_invite":
{ Args: { "p_invite_id": string }; Returns: undefined
                           },
"has_salon_role":
{ Args: { "p_roles": (Database["public"]['Enums']["salon_role"])[],"p_salon_id": string }; Returns: boolean
                           },
"is_salon_member":
{ Args: { "p_salon_id": string }; Returns: boolean
                           },
"link_professional_user":
{ Args: { "p_professional_id": string,"p_user_id": string }; Returns: undefined
                           },
"my_pending_invites":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"id": string,"role": Database["public"]['Enums']["salon_role"],"salon_id": string,"salon_name": string
            }[]
                           },
"save_professional":
{ Args: { "p_active"?: boolean,"p_color": string,"p_commission_percent": number,"p_id"?: string,"p_name": string,"p_salon_id": string }; Returns: {
              "active": boolean,
"color": string,
"created_at": string,
"id": string,
"name": string,
"salon_id": string,
"updated_at": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "professionals"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_professional_schedule":
{ Args: { "p_professional_id": string,"p_slots": Json }; Returns: {
              "created_at": string,
"ends_at": string,
"id": string,
"professional_id": string,
"salon_id": string,
"starts_at": string,
"weekday": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "professional_schedules"
        isOneToOne: false
        isSetofReturn: true
      } },
"shares_salon_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"slugify":
{ Args: { "p_text": string }; Returns: string
                           }
          }
          Enums: {
            "salon_role": "admin"|"reception"|"professional"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "salon_role": ["admin", "reception", "professional"]
          }
        }
} as const
