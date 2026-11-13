import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/salon/active-salon";
import { DEFAULT_LOGOS, resolveLogos } from "@/lib/salon/logo";
import { LogoUploader } from "./logo-uploader";

export const metadata = { title: "Configurações · Salonix" };

export default async function SettingsPage() {
  const { salon } = await requireRole(["admin"]);
  const logos = resolveLogos(salon, process.env.NEXT_PUBLIC_SUPABASE_URL!);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <Card>
        <CardHeader>
          <CardTitle>Logo do salão</CardTitle>
          <CardDescription>
            Aparece no menu e nas telas do app para toda a equipe. Sem logo própria, usamos a do Salonix.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 sm:grid-cols-2">
          <LogoUploader
            variant="light"
            title="Para fundo claro"
            hint="Versão com cores escuras."
            src={salon.logo_light_path ? logos.light : DEFAULT_LOGOS.light}
            custom={Boolean(salon.logo_light_path)}
          />
          <LogoUploader
            variant="dark"
            title="Para fundo escuro"
            hint="Opcional. Versão com cores claras, usada no menu lateral e no tema escuro."
            src={salon.logo_dark_path ? logos.dark : logos.custom ? logos.light : DEFAULT_LOGOS.dark}
            custom={Boolean(salon.logo_dark_path)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
