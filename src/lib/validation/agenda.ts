import { z } from "zod";

const uuid = (msg: string) => z.string().uuid({ error: msg });
const optionalUuid = z.string().uuid().optional().or(z.literal("").transform(() => undefined));
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Informe data e hora" });

const customerPart = {
  customerId: optionalUuid,
  guestName: z.string().trim().max(80, { error: "Máximo de 80 caracteres" }).optional(),
};
const needCustomer = (v: { customerId?: string; guestName?: string }) => !!v.customerId || !!v.guestName;
const customerError = { path: ["guestName"], error: "Escolha um cliente ou informe o nome" };

export const appointmentSchema = z
  .object({
    ...customerPart,
    professionalId: uuid("Escolha o profissional"),
    startsAt: localDateTime,
    notes: z.string().trim().max(300, { error: "Máximo de 300 caracteres" }).default(""),
  })
  .refine(needCustomer, customerError);

export const walkInSchema = z
  .object({ ...customerPart, professionalId: optionalUuid })
  .refine(needCustomer, customerError);

export const rescheduleSchema = z.object({
  id: uuid("Agendamento inválido"),
  startsAt: localDateTime,
  professionalId: optionalUuid,
});

export const serviceIdsSchema = z
  .array(z.string().uuid())
  .min(1, { error: "Escolha pelo menos um serviço" });
