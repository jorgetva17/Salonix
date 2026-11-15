import type { Metadata } from "next";
import { LogoSettings } from "@/components/brand/logo-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/salon/active-salon";

export const metadata: Metadata = { title: "Configurações · Salonix" };

const publicUrl = (path: string | null) =>
  path && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/salon-logos/${path}`
    : null;

export default async function ConfiguracoesPage() {
  const { salon } = await requireRole(["admin"]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <Card>
        <CardHeader>
          <CardTitle>Marca do salão</CardTitle>
          <CardDescription>
            Envie a logomarca do salão (PNG, JPG ou SVG, até 2 MB). Sem logo própria, o app usa a logo do Salonix.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoSettings lightUrl={publicUrl(salon.logo_light_path)} darkUrl={publicUrl(salon.logo_dark_path)} />
        </CardContent>
      </Card>
    </div>
  );
}
