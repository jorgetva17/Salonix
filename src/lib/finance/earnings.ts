export type EarningRow = {
  appointment_id: string;
  base_cents: number;
  status: string;
  reverses_id: string | null;
  refunded_at: string | null;
};

/** Resumo do profissional no mês: atendimentos e valor dos próprios serviços, sem estornos. */
export function earningsSummary(rows: EarningRow[]): { appointments: number; servicesCents: number } {
  // Estornado com a comissão já paga continua 'paid' (o abatimento cai no mês do
  // estorno), por isso o refunded_at do atendimento também conta.
  const own = rows.filter((r) => r.status !== "reversed" && !r.reverses_id && !r.refunded_at);
  return {
    appointments: new Set(own.map((r) => r.appointment_id)).size,
    servicesCents: own.reduce((sum, r) => sum + r.base_cents, 0),
  };
}
