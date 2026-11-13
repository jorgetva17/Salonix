import { requireRole } from "@/lib/salon/active-salon";

export const metadata = { title: "Painel · Salonix" };

export default async function DashboardPage() {
  const { salon } = await requireRole();
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold">{salon.name}</h1>
    </section>
  );
}
