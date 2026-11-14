"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Recarrega os dados do servidor quando um atendimento do salão muda (Supabase Realtime). */
export function RealtimeRefresh({ salonId }: { salonId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    (async () => {
      // O cliente do navegador lê a sessão dos cookies sob demanda; sem passar o token
      // ao Realtime antes de assinar, o canal entra como anônimo e a RLS barra os eventos.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`appointments:${salonId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "appointments", filter: `salon_id=eq.${salonId}` },
          () => {
            clearTimeout(timer);
            timer = setTimeout(() => router.refresh(), 300);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [salonId, router]);

  return null;
}
