"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ message = "Algo deu errado. Tente novamente.", retry }: { message?: string; retry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
      <AlertTriangle className="size-10 text-destructive" aria-hidden />
      <p className="max-w-sm text-sm">{message}</p>
      {retry ? <Button variant="outline" onClick={retry}>Tentar de novo</Button> : null}
    </div>
  );
}
