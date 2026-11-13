"use client";

import { ErrorState } from "@/components/states/error-state";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ErrorState message="Não foi possível carregar esta tela. Verifique sua conexão e tente de novo." retry={reset} />
    </div>
  );
}
