
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
            "appointment_events": {
                  Row: {
                    "actor": string | null,"appointment_id": string,"created_at": string,"data": NonNullable<Json>,"event": string,"id": string,"salon_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"appointment_id": string,"created_at"?: string,"data"?: NonNullable<Json>,"event": string,"id"?: string,"salon_id": string
                  }
                  Update: {
                    "actor"?: string | null,"appointment_id"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"event"?: string,"id"?: string,"salon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_events_appointment_id_salon_id_fkey"
      columns: ["appointment_id","salon_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "appointment_events_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_items": {
                  Row: {
                    "appointment_id": string,"created_at": string,"duration_minutes": number,"id": string,"inventory_item_id": string | null,"item_type": string,"net_cents": number | null,"professional_id": string | null,"quantity": number,"salon_id": string,"service_id": string | null,"unit_price_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"created_at"?: string,"duration_minutes": number,"id"?: string,"inventory_item_id"?: string | null,"item_type": string,"net_cents"?: number | null,"professional_id"?: string | null,"quantity"?: number,"salon_id": string,"service_id"?: string | null,"unit_price_cents": number
                  }
                  Update: {
                    "appointment_id"?: string,"created_at"?: string,"duration_minutes"?: number,"id"?: string,"inventory_item_id"?: string | null,"item_type"?: string,"net_cents"?: number | null,"professional_id"?: string | null,"quantity"?: number,"salon_id"?: string,"service_id"?: string | null,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_items_appointment_id_salon_id_fkey"
      columns: ["appointment_id","salon_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "appointment_items_inventory_item_id_salon_id_fkey"
      columns: ["inventory_item_id","salon_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "appointment_items_professional_id_salon_id_fkey"
      columns: ["professional_id","salon_id"]
isOneToOne: false
      referencedRelation: "professionals"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "appointment_items_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_items_service_id_salon_id_fkey"
      columns: ["service_id","salon_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","salon_id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "arrived_at": string | null,"created_at": string,"created_by": string | null,"customer_id": string | null,"discount_cents": number,"duration_minutes": number,"ends_at": string | null,"id": string,"kind": string,"notes": string | null,"paid_at": string | null,"professional_id": string | null,"refunded_at": string | null,"salon_id": string,"starts_at": string | null,"status": string,"total_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arrived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"discount_cents"?: number,"duration_minutes": number,"ends_at"?: string | null,"id"?: string,"kind": string,"notes"?: string | null,"paid_at"?: string | null,"professional_id"?: string | null,"refunded_at"?: string | null,"salon_id": string,"starts_at"?: string | null,"status": string,"total_cents": number,"updated_at"?: string
                  }
                  Update: {
                    "arrived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"discount_cents"?: number,"duration_minutes"?: number,"ends_at"?: string | null,"id"?: string,"kind"?: string,"notes"?: string | null,"paid_at"?: string | null,"professional_id"?: string | null,"refunded_at"?: string | null,"salon_id"?: string,"starts_at"?: string | null,"status"?: string,"total_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_customer_id_salon_id_fkey"
      columns: ["customer_id","salon_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "appointments_professional_id_salon_id_fkey"
      columns: ["professional_id","salon_id"]
isOneToOne: false
      referencedRelation: "professionals"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "appointments_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_sessions": {
                  Row: {
                    "closed_at": string | null,"closed_by": string | null,"counted": Json | null,"created_at": string,"difference_cents": number | null,"expected": Json | null,"id": string,"opened_at": string,"opened_by": string | null,"opening_cents": number,"salon_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"counted"?: Json | null,"created_at"?: string,"difference_cents"?: number | null,"expected"?: Json | null,"id"?: string,"opened_at"?: string,"opened_by"?: string | null,"opening_cents": number,"salon_id": string,"updated_at"?: string
                  }
                  Update: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"counted"?: Json | null,"created_at"?: string,"difference_cents"?: number | null,"expected"?: Json | null,"id"?: string,"opened_at"?: string,"opened_by"?: string | null,"opening_cents"?: number,"salon_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_sessions_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"commission_rates": {
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
                },"commissions": {
                  Row: {
                    "amount_cents": number,"appointment_id": string,"appointment_item_id": string,"base_cents": number,"created_at": string,"id": string,"paid_at": string | null,"percent": number,"professional_id": string,"reference_month": string,"reverses_id": string | null,"salon_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"appointment_id": string,"appointment_item_id": string,"base_cents": number,"created_at"?: string,"id"?: string,"paid_at"?: string | null,"percent": number,"professional_id": string,"reference_month": string,"reverses_id"?: string | null,"salon_id": string,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"appointment_id"?: string,"appointment_item_id"?: string,"base_cents"?: number,"created_at"?: string,"id"?: string,"paid_at"?: string | null,"percent"?: number,"professional_id"?: string,"reference_month"?: string,"reverses_id"?: string | null,"salon_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "commissions_appointment_id_salon_id_fkey"
      columns: ["appointment_id","salon_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "commissions_appointment_item_id_fkey"
      columns: ["appointment_item_id"]
isOneToOne: false
      referencedRelation: "appointment_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commissions_professional_id_salon_id_fkey"
      columns: ["professional_id","salon_id"]
isOneToOne: false
      referencedRelation: "professionals"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "commissions_reverses_id_salon_id_fkey"
      columns: ["reverses_id","salon_id"]
isOneToOne: false
      referencedRelation: "commissions"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "commissions_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"name_search": string | null,"notes": string | null,"phone": string | null,"salon_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"name_search"?: never,"notes"?: string | null,"phone"?: string | null,"salon_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"name_search"?: never,"notes"?: string | null,"phone"?: string | null,"salon_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"equipment": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"notes": string | null,"professional_id": string | null,"salon_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"notes"?: string | null,"professional_id"?: string | null,"salon_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"professional_id"?: string | null,"salon_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipment_professional_id_salon_id_fkey"
      columns: ["professional_id","salon_id"]
isOneToOne: false
      referencedRelation: "professionals"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "equipment_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"equipment_maintenance": {
                  Row: {
                    "cost_cents": number,"created_at": string,"created_by": string | null,"description": string,"equipment_id": string,"id": string,"next_due": string | null,"performed_on": string,"salon_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_cents"?: number,"created_at"?: string,"created_by"?: string | null,"description": string,"equipment_id": string,"id"?: string,"next_due"?: string | null,"performed_on": string,"salon_id": string
                  }
                  Update: {
                    "cost_cents"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string,"equipment_id"?: string,"id"?: string,"next_due"?: string | null,"performed_on"?: string,"salon_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipment_maintenance_equipment_id_salon_id_fkey"
      columns: ["equipment_id","salon_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "equipment_maintenance_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
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
                },"inventory_items": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"min_quantity": number,"name": string,"quantity": number,"sale_price_cents": number | null,"salon_id": string,"unit": string,"unit_cost_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"min_quantity"?: number,"name": string,"quantity"?: number,"sale_price_cents"?: number | null,"salon_id": string,"unit": string,"unit_cost_cents"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"min_quantity"?: number,"name"?: string,"quantity"?: number,"sale_price_cents"?: number | null,"salon_id"?: string,"unit"?: string,"unit_cost_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
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
                },"service_consumables": {
                  Row: {
                    "created_at": string,"id": string,"inventory_item_id": string,"quantity": number,"salon_id": string,"service_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"inventory_item_id": string,"quantity": number,"salon_id": string,"service_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"inventory_item_id"?: string,"quantity"?: number,"salon_id"?: string,"service_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_consumables_inventory_item_id_salon_id_fkey"
      columns: ["inventory_item_id","salon_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "service_consumables_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_consumables_service_id_salon_id_fkey"
      columns: ["service_id","salon_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","salon_id"]
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
                },"stock_movements": {
                  Row: {
                    "appointment_id": string | null,"appointment_item_id": string | null,"created_at": string,"created_by": string | null,"id": string,"inventory_item_id": string,"quantity": number,"reason": string | null,"reverses_id": string | null,"salon_id": string,"type": string,"unit_cost_cents": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"appointment_item_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inventory_item_id": string,"quantity": number,"reason"?: string | null,"reverses_id"?: string | null,"salon_id": string,"type": string,"unit_cost_cents"?: number | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"appointment_item_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inventory_item_id"?: string,"quantity"?: number,"reason"?: string | null,"reverses_id"?: string | null,"salon_id"?: string,"type"?: string,"unit_cost_cents"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_appointment_id_salon_id_fkey"
      columns: ["appointment_id","salon_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "stock_movements_inventory_item_id_salon_id_fkey"
      columns: ["inventory_item_id","salon_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "stock_movements_reverses_id_salon_id_fkey"
      columns: ["reverses_id","salon_id"]
isOneToOne: false
      referencedRelation: "stock_movements"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "stock_movements_salon_id_fkey"
      columns: ["salon_id"]
isOneToOne: false
      referencedRelation: "salons"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "amount_cents": number,"appointment_id": string | null,"cash_session_id": string | null,"category": string,"created_at": string,"created_by": string | null,"description": string | null,"due_date": string | null,"id": string,"method": string | null,"paid_at": string | null,"reverses_id": string | null,"salon_id": string,"status": string,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"appointment_id"?: string | null,"cash_session_id"?: string | null,"category": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"method"?: string | null,"paid_at"?: string | null,"reverses_id"?: string | null,"salon_id": string,"status": string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"appointment_id"?: string | null,"cash_session_id"?: string | null,"category"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"method"?: string | null,"paid_at"?: string | null,"reverses_id"?: string | null,"salon_id"?: string,"status"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_appointment_id_salon_id_fkey"
      columns: ["appointment_id","salon_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "transactions_cash_session_id_salon_id_fkey"
      columns: ["cash_session_id","salon_id"]
isOneToOne: false
      referencedRelation: "cash_sessions"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "transactions_reverses_id_salon_id_fkey"
      columns: ["reverses_id","salon_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id","salon_id"]
    },{
      foreignKeyName: "transactions_salon_id_fkey"
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
"add_appointment_item":
{ Args: { "p_appointment_id": string,"p_professional_id"?: string,"p_service_id": string }; Returns: {
              "appointment_id": string,
"created_at": string,
"duration_minutes": number,
"id": string,
"inventory_item_id": string | null,
"item_type": string,
"net_cents": number | null,
"professional_id": string | null,
"quantity": number,
"salon_id": string,
"service_id": string | null,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "appointment_items"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_product_item":
{ Args: { "p_appointment_id": string,"p_inventory_item_id": string,"p_quantity"?: number }; Returns: {
              "appointment_id": string,
"created_at": string,
"duration_minutes": number,
"id": string,
"inventory_item_id": string | null,
"item_type": string,
"net_cents": number | null,
"professional_id": string | null,
"quantity": number,
"salon_id": string,
"service_id": string | null,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "appointment_items"
        isOneToOne: true
        isSetofReturn: false
      } },
"allocate_discount":
{ Args: { "p_amounts": (number)[],"p_discount": number }; Returns: (number)[]
                           },
"apply_stock_for_appointment":
{ Args: { "p_appointment_id": string }; Returns: undefined
                           },
"assert_slot_available":
{ Args: { "p_ends_at": string,"p_professional_id": string,"p_starts_at": string,"p_timezone": string }; Returns: undefined
                           },
"call_next_walk_in":
{ Args: { "p_professional_id": string,"p_salon_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_act_on_appointment":
{ Args: { "p_professional_id": string,"p_salon_id": string }; Returns: boolean
                           },
"can_see_appointment":
{ Args: { "p_kind": string,"p_professional_id": string,"p_salon_id": string,"p_status": string }; Returns: boolean
                           },
"cancel_appointment":
{ Args: { "p_appointment_id": string,"p_reason"?: string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_bill":
{ Args: { "p_transaction_id": string }; Returns: {
              "amount_cents": number,
"appointment_id": string | null,
"cash_session_id": string | null,
"category": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"due_date": string | null,
"id": string,
"method": string | null,
"paid_at": string | null,
"reverses_id": string | null,
"salon_id": string,
"status": string,
"type": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_counter_sale":
{ Args: { "p_appointment_id": string,"p_reason"?: string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"cash_session_expected":
{ Args: { "p_session_id": string }; Returns: Json
                           },
"cash_session_summary":
{ Args: { "p_salon_id": string }; Returns: Json
                           },
"close_cash_session":
{ Args: { "p_counted": Json,"p_session_id": string }; Returns: {
              "closed_at": string | null,
"closed_by": string | null,
"counted": Json | null,
"created_at": string,
"difference_cents": number | null,
"expected": Json | null,
"id": string,
"opened_at": string,
"opened_by": string | null,
"opening_cents": number,
"salon_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "cash_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"commission_percent_for":
{ Args: { "p_professional_id": string,"p_service_id": string }; Returns: number
                           },
"complete_appointment":
{ Args: { "p_appointment_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"confirm_pix":
{ Args: { "p_transaction_id": string }; Returns: {
              "amount_cents": number,
"appointment_id": string | null,
"cash_session_id": string | null,
"category": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"due_date": string | null,
"id": string,
"method": string | null,
"paid_at": string | null,
"reverses_id": string | null,
"salon_id": string,
"status": string,
"type": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_appointment":
{ Args: { "p_customer_id": string,"p_notes"?: string,"p_professional_id": string,"p_salon_id": string,"p_service_ids": (string)[],"p_starts_local": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_bill":
{ Args: { "p_amount_cents": number,"p_category": string,"p_description": string,"p_due_date": string,"p_paid_method"?: string,"p_salon_id": string }; Returns: {
              "amount_cents": number,
"appointment_id": string | null,
"cash_session_id": string | null,
"category": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"due_date": string | null,
"id": string,
"method": string | null,
"paid_at": string | null,
"reverses_id": string | null,
"salon_id": string,
"status": string,
"type": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_counter_sale":
{ Args: { "p_customer_id": string,"p_items": Json,"p_salon_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"enqueue_walk_in":
{ Args: { "p_customer_id": string,"p_professional_id"?: string,"p_salon_id": string,"p_service_ids": (string)[] }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"finance_report":
{ Args: { "p_from": string,"p_salon_id": string,"p_to": string }; Returns: Json
                           },
"has_salon_role":
{ Args: { "p_roles": (Database["public"]['Enums']["salon_role"])[],"p_salon_id": string }; Returns: boolean
                           },
"insert_product_item":
{ Args: { "p_appt": Omit<Database["public"]['Tables']["appointments"]['Row'], Database["public"]['Tables']["appointments"]['ComputedFields']>,"p_inventory_item_id": string,"p_quantity": number }; Returns: {
              "appointment_id": string,
"created_at": string,
"duration_minutes": number,
"id": string,
"inventory_item_id": string | null,
"item_type": string,
"net_cents": number | null,
"professional_id": string | null,
"quantity": number,
"salon_id": string,
"service_id": string | null,
"unit_price_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "appointment_items"
        isOneToOne: true
        isSetofReturn: false
      } },
"insert_service_items":
{ Args: { "p_appointment_id": string,"p_salon_id": string,"p_service_ids": (string)[] }; Returns: undefined
                           },
"is_bill_category":
{ Args: { "p_category": string }; Returns: boolean
                           },
"is_salon_member":
{ Args: { "p_salon_id": string }; Returns: boolean
                           },
"link_professional_user":
{ Args: { "p_professional_id": string,"p_user_id": string }; Returns: undefined
                           },
"lock_adjustable_appointment":
{ Args: { "p_appointment_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"lock_appointment":
{ Args: { "p_appointment_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"lock_pending_bill":
{ Args: { "p_transaction_id": string }; Returns: {
              "amount_cents": number,
"appointment_id": string | null,
"cash_session_id": string | null,
"category": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"due_date": string | null,
"id": string,
"method": string | null,
"paid_at": string | null,
"reverses_id": string | null,
"salon_id": string,
"status": string,
"type": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"mark_no_show":
{ Args: { "p_appointment_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"my_pending_invites":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"id": string,"role": Database["public"]['Enums']["salon_role"],"salon_id": string,"salon_name": string
            }[]
                           },
"my_professional_id":
{ Args: { "p_salon_id": string }; Returns: string
                           },
"open_cash_session":
{ Args: { "p_opening_cents": number,"p_salon_id": string }; Returns: {
              "closed_at": string | null,
"closed_by": string | null,
"counted": Json | null,
"created_at": string,
"difference_cents": number | null,
"expected": Json | null,
"id": string,
"opened_at": string,
"opened_by": string | null,
"opening_cents": number,
"salon_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "cash_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"open_cash_session_id":
{ Args: { "p_salon_id": string }; Returns: string
                           },
"pay_bill":
{ Args: { "p_method": string,"p_transaction_id": string }; Returns: {
              "amount_cents": number,
"appointment_id": string | null,
"cash_session_id": string | null,
"category": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"due_date": string | null,
"id": string,
"method": string | null,
"paid_at": string | null,
"reverses_id": string | null,
"salon_id": string,
"status": string,
"type": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"pay_commissions":
{ Args: { "p_expense_method"?: string,"p_month": string,"p_professional_id": string,"p_salon_id": string }; Returns: number
                           },
"recalc_appointment_total":
{ Args: { "p_appointment_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"receive_payment":
{ Args: { "p_appointment_id": string,"p_discount_cents"?: number,"p_payments": Json }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_stock_movement":
{ Args: { "p_item_id": string,"p_quantity": number,"p_reason"?: string,"p_type": string,"p_unit_cost_cents"?: number }; Returns: {
              "appointment_id": string | null,
"appointment_item_id": string | null,
"created_at": string,
"created_by": string | null,
"id": string,
"inventory_item_id": string,
"quantity": number,
"reason": string | null,
"reverses_id": string | null,
"salon_id": string,
"type": string,
"unit_cost_cents": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "stock_movements"
        isOneToOne: true
        isSetofReturn: false
      } },
"refund_appointment":
{ Args: { "p_appointment_id": string,"p_reason": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_appointment_item":
{ Args: { "p_item_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"reschedule_appointment":
{ Args: { "p_appointment_id": string,"p_professional_id": string,"p_starts_local": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"revert_appointment_start":
{ Args: { "p_appointment_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"salon_month":
{ Args: { "p_salon_id": string }; Returns: string
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
"search_normalize":
{ Args: { "p_text": string }; Returns: string
                           },
"services_totals":
{ Args: { "p_salon_id": string,"p_service_ids": (string)[] }; Returns: Record<string, unknown>
                           },
"set_item_net_cents":
{ Args: { "p_appointment_id": string,"p_discount_cents": number }; Returns: undefined
                           },
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
"settle_bill":
{ Args: { "p_bill": Omit<Database["public"]['Tables']["transactions"]['Row'], Database["public"]['Tables']["transactions"]['ComputedFields']>,"p_method": string }; Returns: {
              "amount_cents": number,
"appointment_id": string | null,
"cash_session_id": string | null,
"category": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"due_date": string | null,
"id": string,
"method": string | null,
"paid_at": string | null,
"reverses_id": string | null,
"salon_id": string,
"status": string,
"type": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "transactions"
        isOneToOne: true
        isSetofReturn: false
      } },
"shares_salon_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"slugify":
{ Args: { "p_text": string }; Returns: string
                           },
"start_appointment":
{ Args: { "p_appointment_id": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"transition_appointment":
{ Args: { "p_appointment_id": string,"p_data"?: Json,"p_event": string,"p_from": (string)[],"p_reception_only": boolean,"p_to": string }; Returns: {
              "arrived_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"discount_cents": number,
"duration_minutes": number,
"ends_at": string | null,
"id": string,
"kind": string,
"notes": string | null,
"paid_at": string | null,
"professional_id": string | null,
"refunded_at": string | null,
"salon_id": string,
"starts_at": string | null,
"status": string,
"total_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } }
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
