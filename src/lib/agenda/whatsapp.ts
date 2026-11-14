import { formatDateTime } from "@/lib/format";

/** Link wa.me com lembrete pronto (o envio automático fica para depois). */
export function whatsappReminderUrl(input: {
  phone: string;
  customerName: string;
  salonName: string;
  startsAt: string;
  timeZone: string;
  professionalName: string;
  serviceNames: string[];
}): string {
  const [date, time] = formatDateTime(input.startsAt, input.timeZone).split(" ");
  const firstName = input.customerName.trim().split(/\s+/)[0];
  const message =
    `Olá, ${firstName}! Lembrete do seu horário na ${input.salonName}: ${date.slice(0, 5)} às ${time}` +
    ` com ${input.professionalName} (${input.serviceNames.join(" + ")}).`;
  return `https://wa.me/55${input.phone}?text=${encodeURIComponent(message)}`;
}
