import { z } from "zod";

export const appointmentSchema = z.object({
  customerId: z.uuid({ error: "Escolha o cliente" }),
  professionalId: z.uuid({ error: "Escolha o profissional" }),
  serviceIds: z.array(z.uuid()).min(1, { error: "Escolha pelo menos um serviço" }).max(10),
  date: z.iso.date({ error: "Escolha a data" }),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Escolha um horário" }),
  notes: z.string().trim().max(300, { error: "Até 300 caracteres" }).optional(),
});
