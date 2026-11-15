import {
  BarChart3,
  Boxes,
  CalendarDays,
  Contact,
  LayoutDashboard,
  Scissors,
  Settings,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { SalonRole } from "@/lib/supabase/database.types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: SalonRole[];
  primary: boolean;
};

const ALL: SalonRole[] = ["admin", "reception", "professional"];

const ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, roles: ALL, primary: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, roles: ALL, primary: true },
  { href: "/caixa", label: "Caixa", icon: Wallet, roles: ["admin", "reception"], primary: true },
  { href: "/estoque", label: "Estoque", icon: Boxes, roles: ALL, primary: true },
  { href: "/financeiro", label: "Financeiro", icon: BarChart3, roles: ["admin", "professional"], primary: true },
  { href: "/clientes", label: "Clientes", icon: Contact, roles: ALL, primary: false },
  { href: "/servicos", label: "Serviços", icon: Scissors, roles: ALL, primary: false },
  { href: "/profissionais", label: "Profissionais", icon: UserRound, roles: ALL, primary: false },
  { href: "/equipe", label: "Equipe", icon: Users, roles: ["admin"], primary: false },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"], primary: false },
];

export function getNavItems(role: SalonRole): NavItem[] {
  return ITEMS.filter((item) => item.roles.includes(role)).map((item) =>
    item.href === "/financeiro" && role === "professional" ? { ...item, label: "Meus ganhos" } : item,
  );
}

/** Rodapé mobile: até 4 itens principais; o restante vai para "Mais". */
export function getBottomNav(role: SalonRole): { main: NavItem[]; more: NavItem[] } {
  const items = getNavItems(role);
  const primary = items.filter((i) => i.primary);
  const main = primary.slice(0, 4);
  const more = items.filter((i) => !main.includes(i));
  return { main, more };
}

export const ROLE_LABELS: Record<SalonRole, string> = {
  admin: "Administrador",
  reception: "Recepção",
  professional: "Profissional",
};
