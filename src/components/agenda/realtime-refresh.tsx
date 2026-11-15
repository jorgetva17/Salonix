"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Escuta mudanças em `appointments` do salão e atualiza a tela (fila e agenda ao vivo). */
export function RealtimeRefresh({ salonId }: { salonId: string }) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`appointments:${salonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `salon_id=eq.${salonId}` },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 250);
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [salonId, router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-label={live ? "Atualização ao vivo ativa" : "Conectando ao vivo"}>
      <span className={`size-2 rounded-full ${live ? "bg-green-500" : "bg-muted-foreground/40"}`} aria-hidden />
      {live ? "Ao vivo" : "Conectando…"}
    </span>
  );
}
