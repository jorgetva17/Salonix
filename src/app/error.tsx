"use client";

import { Button } from "@/components/ui/button";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Não foi possível carregar esta página. Tente novamente em instantes.</p>
      <Button onClick={reset}>Tentar de novo</Button>
    </main>
  );
}
