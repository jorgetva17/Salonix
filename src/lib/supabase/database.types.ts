/**
 * Tipos do banco. Regerar com `npm run db:types` quando o Supabase local estiver
 * rodando. (Versão inicial escrita à mão a partir das migrations da Fase 1.)
 */
export type CashAmounts = { cash: number; debit: number; credit: number; pix: number; pending_pix?: number };
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SalonRole = "admin" | "reception" | "professional";
export type PaymentMethod = "cash" | "debit" | "credit" | "pix";
export type AppointmentKind = "scheduled" | "walk_in";
export type AppointmentStatus = "scheduled" | "waiting" | "in_progress" | "awaiting_payment" | "paid" | "cancelled" | "no_show";
export type AppointmentRow = {
  id: string;
  salon_id: string;
  customer_id: string | null;
  guest_name: string | null;
  professional_id: string | null;
  kind: AppointmentKind;
  status: AppointmentStatus;
  starts_at: string | null;
  ends_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  notes: string;
  discount_cents: number;
  total_cents: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      salons: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          phone: string | null;
          logo_light_path: string | null;
          logo_dark_path: string | null;
        } & Timestamps;
        Insert: { name: string; slug: string; timezone?: string; phone?: string | null };
        Update: Partial<Database["public"]["Tables"]["salons"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          theme: "light" | "dark" | "system";
        } & Timestamps;
        Insert: { id: string; full_name?: string; phone?: string | null; theme?: "light" | "dark" | "system" };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      salon_members: {
        Row: {
          id: string;
          salon_id: string;
          user_id: string;
          role: SalonRole;
          active: boolean;
        } & Timestamps;
        Insert: { salon_id: string; user_id: string; role: SalonRole; active?: boolean };
        Update: Partial<Database["public"]["Tables"]["salon_members"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "salon_members_salon_id_fkey";
            columns: ["salon_id"];
            isOneToOne: false;
            referencedRelation: "salons";
            referencedColumns: ["id"];
          },
        ];
      };
      salon_invites: {
        Row: {
          id: string;
          salon_id: string;
          email: string;
          role: SalonRole;
          invited_by: string | null;
          status: "pending" | "accepted" | "revoked";
          created_at: string;
          accepted_at: string | null;
          professional_id: string | null;
        };
        Insert: { salon_id: string; email: string; role: SalonRole; invited_by?: string | null; professional_id?: string | null; status?: "pending" | "accepted" | "revoked" };
        Update: Partial<Database["public"]["Tables"]["salon_invites"]["Row"]>;
        Relationships: [];
      };
      services: {
        Row: { id: string; salon_id: string; name: string; duration_minutes: number; price_cents: number; active: boolean } & Timestamps;
        Insert: { salon_id: string; name: string; duration_minutes: number; price_cents: number; active?: boolean };
        Update: Partial<Database["public"]["Tables"]["services"]["Row"]>;
        Relationships: [];
      };
      professionals: {
        Row: { id: string; salon_id: string; user_id: string | null; name: string; color: string; active: boolean } & Timestamps;
        Insert: { salon_id: string; name: string; color?: string; active?: boolean; user_id?: string | null };
        Update: Partial<Database["public"]["Tables"]["professionals"]["Row"]>;
        Relationships: [];
      };
      professional_default_commissions: {
        Row: { professional_id: string; salon_id: string; commission_percent: number } & Timestamps;
        Insert: { professional_id: string; salon_id: string; commission_percent: number };
        Update: Partial<Database["public"]["Tables"]["professional_default_commissions"]["Row"]>;
        Relationships: [];
      };
      professional_schedules: {
        Row: { id: string; salon_id: string; professional_id: string; weekday: number; start_time: string; end_time: string } & Timestamps;
        Insert: { salon_id: string; professional_id: string; weekday: number; start_time: string; end_time: string };
        Update: Partial<Database["public"]["Tables"]["professional_schedules"]["Row"]>;
        Relationships: [];
      };
      schedule_blocks: {
        Row: { id: string; salon_id: string; professional_id: string; starts_at: string; ends_at: string; reason: string } & Timestamps;
        Insert: { salon_id: string; professional_id: string; starts_at: string; ends_at: string; reason?: string };
        Update: Partial<Database["public"]["Tables"]["schedule_blocks"]["Row"]>;
        Relationships: [];
      };
      professional_service_commissions: {
        Row: { id: string; salon_id: string; professional_id: string; service_id: string; commission_percent: number } & Timestamps;
        Insert: { salon_id: string; professional_id: string; service_id: string; commission_percent: number };
        Update: Partial<Database["public"]["Tables"]["professional_service_commissions"]["Row"]>;
        Relationships: [];
      };
      customers: {
        Row: { id: string; salon_id: string; name: string; phone: string | null; notes: string } & Timestamps;
        Insert: { salon_id: string; name: string; phone?: string | null; notes?: string };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
        Relationships: [];
      };
      appointments: {
        Row: AppointmentRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      appointment_items: {
        Row: {
          id: string;
          salon_id: string;
          appointment_id: string;
          item_type: "service" | "product";
          service_id: string | null;
          inventory_item_id: string | null;
          description: string;
          quantity: number;
          unit_price_cents: number;
          duration_minutes: number;
          professional_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      appointment_events: {
        Row: { id: string; salon_id: string; appointment_id: string; event_type: string; actor_id: string | null; data: Json; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      cash_sessions: {
        Row: {
          id: string;
          salon_id: string;
          opened_by: string | null;
          opened_at: string;
          opening_cents: number;
          closed_by: string | null;
          closed_at: string | null;
          expected: CashAmounts | null;
          counted: CashAmounts | null;
          difference_cents: number | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          salon_id: string;
          type: "income" | "expense";
          category: string;
          description: string;
          amount_cents: number;
          payment_method: PaymentMethod | null;
          status: "pending" | "paid" | "reversed";
          due_date: string | null;
          paid_at: string | null;
          appointment_id: string | null;
          cash_session_id: string | null;
          reverses_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      commissions: {
        Row: {
          id: string;
          salon_id: string;
          appointment_id: string;
          item_id: string | null;
          professional_id: string;
          base_cents: number;
          percent: number;
          amount_cents: number;
          reference_month: string;
          status: "blocked" | "available" | "paid" | "reversed";
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      feature_flags: {
        Row: { salon_id: string; card_reconciliation: boolean; pix_webhook: boolean };
        Insert: { salon_id: string; card_reconciliation?: boolean; pix_webhook?: boolean };
        Update: Partial<Database["public"]["Tables"]["feature_flags"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_salon: {
        Args: { p_name: string; p_phone?: string | null };
        Returns: Database["public"]["Tables"]["salons"]["Row"];
      };
      accept_invite: {
        Args: { p_invite_id: string };
        Returns: Database["public"]["Tables"]["salon_members"]["Row"];
      };
      decline_invite: { Args: { p_invite_id: string }; Returns: undefined };
      my_pending_invites: {
        Args: Record<string, never>;
        Returns: { id: string; salon_id: string; salon_name: string; role: SalonRole; created_at: string }[];
      };
      create_appointment: {
        Args: { p_salon_id: string; p_customer_id: string | null; p_guest_name: string | null; p_professional_id: string; p_starts_at: string; p_service_ids: string[]; p_notes?: string };
        Returns: AppointmentRow;
      };
      enqueue_walk_in: {
        Args: { p_salon_id: string; p_customer_id: string | null; p_guest_name: string | null; p_professional_id: string | null; p_service_ids: string[] };
        Returns: AppointmentRow;
      };
      reschedule_appointment: { Args: { p_appointment_id: string; p_starts_at: string; p_professional_id?: string | null }; Returns: AppointmentRow };
      cancel_appointment: { Args: { p_appointment_id: string; p_reason?: string }; Returns: AppointmentRow };
      mark_no_show: { Args: { p_appointment_id: string }; Returns: AppointmentRow };
      start_appointment: { Args: { p_appointment_id: string }; Returns: AppointmentRow };
      call_next: { Args: { p_salon_id: string; p_professional_id: string }; Returns: AppointmentRow | null };
      my_professional_id: { Args: { p_salon_id: string }; Returns: string | null };
      add_appointment_item: { Args: { p_appointment_id: string; p_service_id: string }; Returns: AppointmentRow };
      remove_appointment_item: { Args: { p_item_id: string }; Returns: AppointmentRow };
      complete_appointment: { Args: { p_appointment_id: string }; Returns: AppointmentRow };
      open_cash_session: { Args: { p_salon_id: string; p_opening_cents: number }; Returns: Database["public"]["Tables"]["cash_sessions"]["Row"] };
      cash_session_summary: { Args: { p_session_id: string }; Returns: CashAmounts };
      close_cash_session: { Args: { p_session_id: string; p_counted: Json }; Returns: Database["public"]["Tables"]["cash_sessions"]["Row"] };
      receive_payment: { Args: { p_appointment_id: string; p_payments: Json; p_discount_cents?: number }; Returns: AppointmentRow };
      confirm_pix: { Args: { p_transaction_id: string }; Returns: Database["public"]["Tables"]["transactions"]["Row"] };
      reverse_appointment: { Args: { p_appointment_id: string; p_reason?: string }; Returns: AppointmentRow };
      pay_commissions: { Args: { p_salon_id: string; p_professional_id: string; p_month: string; p_create_expense?: boolean }; Returns: { paid_cents: number; count: number } };
      is_salon_member: { Args: { p_salon_id: string }; Returns: boolean };
      has_salon_role: { Args: { p_salon_id: string; p_roles: SalonRole[] }; Returns: boolean };
    };
    Enums: { salon_role: SalonRole; appointment_kind: AppointmentKind; appointment_status: AppointmentStatus };
    CompositeTypes: Record<string, never>;
  };
};
