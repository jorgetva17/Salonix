export type QueueEntry = { id: string; arrivedAt: string; durationMinutes: number; professionalId: string | null };

/** Profissional trabalhando agora; busyUntil = fim estimado do atendimento em curso (nulo = livre). */
export type Server = { professionalId: string; busyUntil: string | null };

/**
 * Espera estimada (minutos) de cada pessoa da fila. Simula os profissionais que
 * trabalham agora atendendo em ordem de chegada: com preferência, espera aquele
 * profissional; sem, vai para o primeiro que ficar livre. Com um só profissional
 * é a soma das durações à frente. Nulo quando ninguém pode atender.
 */
export function estimateWaits(queue: QueueEntry[], servers: Server[], now: string): Map<string, number | null> {
  const nowMs = Date.parse(now);
  const freeAt = new Map(servers.map((s) => [s.professionalId, Math.max(nowMs, s.busyUntil ? Date.parse(s.busyUntil) : 0)]));
  const waits = new Map<string, number | null>();

  for (const entry of [...queue].sort((a, b) => Date.parse(a.arrivedAt) - Date.parse(b.arrivedAt))) {
    let serverId: string | undefined;
    if (entry.professionalId) {
      serverId = freeAt.has(entry.professionalId) ? entry.professionalId : undefined;
    } else {
      for (const [id, at] of freeAt) if (serverId === undefined || at < freeAt.get(serverId)!) serverId = id;
    }
    if (serverId === undefined) {
      waits.set(entry.id, null);
      continue;
    }
    const start = freeAt.get(serverId)!;
    waits.set(entry.id, Math.ceil((start - nowMs) / 60_000));
    freeAt.set(serverId, start + entry.durationMinutes * 60_000);
  }
  return waits;
}
