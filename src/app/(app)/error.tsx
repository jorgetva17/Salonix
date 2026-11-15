"use client";
import { ErrorState } from "@/components/states/error-state";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState message="Não foi possível carregar esta tela." retry={reset} />;
}
