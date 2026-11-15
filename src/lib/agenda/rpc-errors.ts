/** Mensagens das RPCs de atendimento que o app mostra exatamente como vieram. */
const RPC_MESSAGES = new Set([
  "Horário indisponível para este profissional.",
  "Fora da jornada do profissional.",
  "Profissional bloqueado neste horário.",
  "Atendimento não pode mudar deste status.",
  "Fila vazia para este profissional.",
  "Profissional já está em atendimento.",
  "Sem permissão.",
  "Atendimento precisa de pelo menos um serviço.",
  "Abra o caixa antes de receber.",
  "Já existe um caixa aberto.",
  "Caixa já fechado.",
  "Valor pago não confere com o total.",
  "Desconto maior que o total.",
  "Pix já confirmado.",
  "Atendimento já estornado.",
  "Abra o caixa antes de estornar.",
  "Informe o motivo do estorno.",
  "Item de estoque não encontrado.",
  "Quantidade inválida.",
  "Produto sem preço de venda.",
  "Venda precisa de pelo menos um produto.",
]);

export function rpcError(message: string | undefined, fallback: string): string {
  return message && RPC_MESSAGES.has(message) ? message : fallback;
}
