"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center">
      <TriangleAlert className="size-10 text-destructive" aria-hidden />
      <p className="max-w-prose font-medium">{message}</p>
      {retry && (
        <Button variant="outline" className="h-11" onClick={retry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
