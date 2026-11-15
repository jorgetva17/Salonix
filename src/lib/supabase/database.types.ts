/**
 * Tipos do banco. Regerar com `npm run db:types` quando o Supabase local estiver
 * rodando. (Versão inicial escrita à mão a partir das migrations da Fase 1.)
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SalonRole = "admin" | "reception" | "professional";

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
        };
        Insert: { salon_id: string; email: string; role: SalonRole; invited_by?: string | null; status?: "pending" | "accepted" | "revoked" };
        Update: Partial<Database["public"]["Tables"]["salon_invites"]["Row"]>;
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
      is_salon_member: { Args: { p_salon_id: string }; Returns: boolean };
      has_salon_role: { Args: { p_salon_id: string; p_roles: SalonRole[] }; Returns: boolean };
    };
    Enums: { salon_role: SalonRole };
    CompositeTypes: Record<string, never>;
  };
};
