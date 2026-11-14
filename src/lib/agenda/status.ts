export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  waiting: "Na fila",
  in_progress: "Em atendimento",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

export const APPOINTMENT_EVENT_LABELS: Record<string, string> = {
  created: "Criado",
  rescheduled: "Reagendado",
  cancelled: "Cancelado",
  no_show: "Faltou",
  called: "Chamado da fila",
  started: "Iniciado",
  completed: "Concluído",
  reverted: "Início desfeito",
  item_added: "Serviço adicionado",
  item_removed: "Serviço removido",
  paid: "Pago",
  pix_confirmed: "Pix confirmado",
  refunded: "Estornado",
};
