/** Mensagens das RPCs de atendimento que o app mostra exatamente como vieram. */
const RPC_MESSAGES = new Set([
  "Horário indisponível para este profissional.",
  "Fora da jornada do profissional.",
  "Profissional bloqueado neste horário.",
  "Atendimento não pode mudar deste status.",
  "Fila vazia para este profissional.",
  "Profissional já está em atendimento.",
  "Sem permissão.",
]);

export function rpcError(message: string | undefined, fallback: string): string {
  return message && RPC_MESSAGES.has(message) ? message : fallback;
}
