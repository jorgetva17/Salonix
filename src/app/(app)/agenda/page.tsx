import { CalendarDays } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { requireRole } from "@/lib/salon/active-salon";

export const metadata = { title: "Agenda · Salonix" };

export default async function Page() {
  await requireRole();
  return (
    <PagePlaceholder
      title="Agenda"
      icon={CalendarDays}
      description="A agenda por profissional e a fila de quem chega sem hora marcada chegam na próxima etapa."
    />
  );
}
