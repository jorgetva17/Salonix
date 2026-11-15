import type { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { fieldErrorsOf } from "@/lib/validation/auth";

/** Lê o FormData como objeto simples (strings) e valida com o schema. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.output<S> } | { ok: false; result: ActionResult } {
  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    result: { ok: false, error: "Confira os campos", fieldErrors: fieldErrorsOf(parsed.error as z.ZodError) },
  };
}

export const failed = (error: string): ActionResult => ({ ok: false, error });
