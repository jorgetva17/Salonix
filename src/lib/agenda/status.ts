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
};
