import {
  CalendarDays,
  Wallet,
  LayoutDashboard,
  Package,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { SalonRole } from "@/lib/salon/membership";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: SalonRole[];
  /** Aparece direto no rodapé do celular; os demais ficam em "Mais". */
  primary: boolean;
};

const ALL: SalonRole[] = ["admin", "reception", "professional"];

const ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, roles: ALL, primary: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, roles: ALL, primary: true },
  { href: "/caixa", label: "Caixa", icon: Wallet, roles: ["admin", "reception"], primary: true },
  { href: "/estoque", label: "Estoque", icon: Package, roles: ALL, primary: false },
  { href: "/financeiro", label: "Financeiro", icon: TrendingUp, roles: ["admin", "professional"], primary: true },
  { href: "/equipe", label: "Equipe", icon: Users, roles: ["admin"], primary: false },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"], primary: false },
];

export function getNavItems(role: SalonRole): NavItem[] {
  return ITEMS.filter((item) => item.roles.includes(role)).map((item) =>
    role === "professional" && item.href === "/financeiro" ? { ...item, label: "Meus ganhos" } : item,
  );
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
