"use client";
import { useRouter } from "next/navigation";
import { ACTIVE_SALON_COOKIE } from "@/lib/salon/cookie";

export function SalonSwitcher({
  memberships,
  activeId,
}: {
  memberships: { salonId: string; salonName: string }[];
  activeId: string;
}) {
  const router = useRouter();
  if (memberships.length < 2) return null;
  return (
    <select
      aria-label="Salão ativo"
      value={activeId}
      className="min-h-11 max-w-44 rounded-md border border-input bg-card px-2 text-sm"
      onChange={(e) => {
        document.cookie = `${ACTIVE_SALON_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {memberships.map((m) => (
        <option key={m.salonId} value={m.salonId}>{m.salonName}</option>
      ))}
    </select>
  );
}
